#!/usr/bin/env node

const axios = require('axios');
const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5433,
  database: 'postgres',
  user: 'postgres',
  password: '5+NMkUPabjFbh5vGZtWx5ea0QAX2NSR3G1k0sfAedms='
});

const API_BASE_URL = 'http://192.168.33.250/tk/hs/TransportAPI/api/v1';
const API_AUTH = {
  username: 'TransportAPI',
  password: 'TransportAPI_SecretPass'
};

function parseNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return value;
  const cleaned = String(value).replace(/\s/g, '').replace(',', '.');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? null : parsed;
}

const weeks = [
  { from: '2024-11-01', to: '2024-11-07' },
  { from: '2024-11-08', to: '2024-11-14' },
  { from: '2024-11-15', to: '2024-11-21' },
  { from: '2024-11-22', to: '2024-11-28' },
  { from: '2024-11-29', to: '2024-11-30' }
];

console.log('\n📋 Загрузка отчетов водителей за ноябрь 2024');
console.log('Период разбит на', weeks.length, 'недельных интервалов\n');

async function loadReports() {
  let allReports = [];

  for (let i = 0; i < weeks.length; i++) {
    const week = weeks[i];
    console.log(`[${i + 1}/${weeks.length}] Загрузка ${week.from} — ${week.to}...`);

    try {
      const response = await axios.get(`${API_BASE_URL}/driver-reports`, {
        auth: API_AUTH,
        params: { date_from: week.from, date_to: week.to },
        timeout: 30000
      });

      if (response.data && Array.isArray(response.data)) {
        console.log(`    ✅ Получено ${response.data.length} записей`);
        allReports = allReports.concat(response.data);
      } else {
        console.log('    ⚠️  Нет данных');
      }
    } catch (error) {
      console.error(`    ❌ Ошибка: ${error.message}`);
    }
  }

  console.log(`\n📊 Всего получено: ${allReports.length} отчетов`);
  if (allReports.length === 0) return;

  console.log('\n💾 Загрузка в базу данных...');
  let inserted = 0, updated = 0, errors = 0;

  for (const report of allReports) {
    try {
      const result = await pool.query(
        `INSERT INTO driver_reports (
          id, number, date_from, date_to, driver_id, driver_name,
          vehicle_id, vehicle_number, fuel_start, fuel_end,
          mileage, fuel_quantity, fuel_amount, total_expenses,
          driver_accruals, driver_payments, synced_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW())
        ON CONFLICT (id) DO UPDATE SET
          number = EXCLUDED.number,
          date_from = EXCLUDED.date_from,
          date_to = EXCLUDED.date_to,
          driver_id = EXCLUDED.driver_id,
          driver_name = EXCLUDED.driver_name,
          vehicle_id = EXCLUDED.vehicle_id,
          vehicle_number = EXCLUDED.vehicle_number,
          fuel_start = EXCLUDED.fuel_start,
          fuel_end = EXCLUDED.fuel_end,
          mileage = EXCLUDED.mileage,
          fuel_quantity = EXCLUDED.fuel_quantity,
          fuel_amount = EXCLUDED.fuel_amount,
          total_expenses = EXCLUDED.total_expenses,
          driver_accruals = EXCLUDED.driver_accruals,
          driver_payments = EXCLUDED.driver_payments,
          synced_at = NOW()
        RETURNING (xmax = 0) as inserted`,
        [
          report.id, report.number, report.date_from, report.date_to,
          report.driver_id, report.driver_name, report.vehicle_id, report.vehicle_number,
          parseNumber(report.fuel_start), parseNumber(report.fuel_end),
          parseNumber(report.mileage), parseNumber(report.fuel_quantity),
          parseNumber(report.fuel_amount), parseNumber(report.total_expenses),
          parseNumber(report.driver_accruals), parseNumber(report.driver_payments)
        ]
      );

      if (result.rows[0].inserted) inserted++; else updated++;

      if (report.expense_categories && Array.isArray(report.expense_categories)) {
        await pool.query('DELETE FROM expense_categories WHERE driver_report_id = $1', [report.id]);
        for (const category of report.expense_categories) {
          await pool.query(
            'INSERT INTO expense_categories (driver_report_id, category, amount) VALUES ($1, $2, $3)',
            [report.id, category.category, parseNumber(category.amount)]
          );
        }
      }
    } catch (error) {
      errors++;
      console.error(`⚠️  Ошибка при обработке отчета ${report.id}:`, error.message);
    }
  }

  console.log(`\n✅ Готово!\n   Вставлено: ${inserted}\n   Обновлено: ${updated}`);
  if (errors > 0) console.log(`   Ошибок: ${errors}`);
}

async function main() {
  try {
    await loadReports();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ КРИТИЧЕСКАЯ ОШИБКА:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
