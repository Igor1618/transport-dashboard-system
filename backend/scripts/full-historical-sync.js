#!/usr/bin/env node
/**
 * ПОЛНАЯ ИСТОРИЧЕСКАЯ СИНХРОНИЗАЦИЯ
 * Загружает ВСЕ данные из 1C за период 2021-01 — текущий месяц
 * 
 * Запуск: node full-historical-sync.js
 */

const axios = require('axios');
const { Pool } = require('pg');

// Конфиг БД
const pool = new Pool({
  host: 'localhost',
  port: 5433,
  database: 'postgres',
  user: 'postgres',
  password: '5+NMkUPabjFbh5vGZtWx5ea0QAX2NSR3G1k0sfAedms='
});

// Конфиг API 1C
const API_BASE_URL = 'http://192.168.33.250/tk/hs/TransportAPI/api/v1';
const API_AUTH = {
  username: 'TransportAPI',
  password: 'TransportAPI_SecretPass'
};

// Генерация списка месяцев от start до end
function generateMonths(startYear, startMonth, endYear, endMonth) {
  const months = [];
  let year = startYear;
  let month = startMonth;
  
  while (year < endYear || (year === endYear && month <= endMonth)) {
    const from = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const to = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;
    months.push({ from, to, label: `${year}-${String(month).padStart(2, '0')}` });
    
    month++;
    if (month > 12) {
      month = 1;
      year++;
    }
  }
  return months;
}

// Экранирование для SQL
function esc(val) {
  if (val === null || val === undefined) return null;
  return String(val).replace(/'/g, "''");
}

// Загрузка contracts за месяц
async function loadContracts(dateFrom, dateTo) {
  try {
    const response = await axios.get(`${API_BASE_URL}/contracts`, {
      auth: API_AUTH,
      params: { date_from: dateFrom, date_to: dateTo },
      timeout: 60000
    });
    return response.data || [];
  } catch (e) {
    console.error(`    ❌ Ошибка загрузки contracts: ${e.message}`);
    return [];
  }
}

// Загрузка driver_reports за неделю (лимит 1000)
async function loadDriverReports(dateFrom, dateTo) {
  try {
    const response = await axios.get(`${API_BASE_URL}/driver-reports`, {
      auth: API_AUTH,
      params: { date_from: dateFrom, date_to: dateTo },
      timeout: 60000
    });
    return response.data || [];
  } catch (e) {
    if (e.response?.data?.code === 'TOO_MANY_RECORDS') {
      console.log(`    ⚠️ Слишком много записей, пробуем разбить...`);
      return null; // Сигнал что нужно разбить период
    }
    console.error(`    ❌ Ошибка загрузки driver_reports: ${e.message}`);
    return [];
  }
}

// Upsert contract
async function upsertContract(c) {
  const sql = `
    INSERT INTO contracts (number, date, organization, contractor_id, contractor_name, 
      vehicle_id, vehicle_number, driver_id, driver_name, responsible_logist, 
      route, payment_term, payment_condition, amount, synced_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())
    ON CONFLICT (number) WHERE number IS NOT NULL AND number != '' DO UPDATE SET
      organization = EXCLUDED.organization,
      contractor_id = EXCLUDED.contractor_id,
      contractor_name = EXCLUDED.contractor_name,
      vehicle_id = EXCLUDED.vehicle_id,
      vehicle_number = EXCLUDED.vehicle_number,
      driver_id = EXCLUDED.driver_id,
      driver_name = EXCLUDED.driver_name,
      responsible_logist = EXCLUDED.responsible_logist,
      route = EXCLUDED.route,
      payment_term = EXCLUDED.payment_term,
      payment_condition = EXCLUDED.payment_condition,
      amount = EXCLUDED.amount,
      synced_at = NOW()
  `;
  
  await pool.query(sql, [
    c.number, c.date, c.organization, c.contractor_id, c.contractor_name,
    c.vehicle_id, c.vehicle_number, c.driver_id, c.driver_name, c.responsible_logist,
    c.route, c.payment_term, c.payment_condition, parseFloat(c.amount) || 0
  ]);
}

// Upsert driver_report
async function upsertDriverReport(r) {
  const sql = `
    INSERT INTO driver_reports (id, number, date_from, date_to, driver_id, driver_name,
      vehicle_id, vehicle_number, fuel_start, fuel_end, mileage, fuel_quantity, fuel_amount,
      total_expenses, driver_accruals, driver_payments, expense_categories, synced_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW())
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
      expense_categories = EXCLUDED.expense_categories,
      synced_at = NOW()
  `;
  
  await pool.query(sql, [
    r.id, r.number, r.date_from, r.date_to, r.driver_id, r.driver_name,
    r.vehicle_id, r.vehicle_number,
    parseFloat(r.fuel_start) || 0, parseFloat(r.fuel_end) || 0,
    parseInt(r.mileage) || 0, parseFloat(r.fuel_quantity) || 0, parseFloat(r.fuel_amount) || 0,
    parseFloat(r.total_expenses) || 0, parseFloat(r.driver_accruals) || 0, parseFloat(r.driver_payments) || 0,
    JSON.stringify(r.expense_categories || [])
  ]);
}

// Основная функция
async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  📦 ПОЛНАЯ ИСТОРИЧЕСКАЯ СИНХРОНИЗАЦИЯ 1C → PostgreSQL     ║');
  console.log('║  Период: 2021-01 — текущий месяц                          ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');

  // Сначала обновляем справочники
  console.log('📊 1. Синхронизация справочников...');
  
  try {
    // Vehicles
    const vehiclesResp = await axios.get(`${API_BASE_URL}/vehicles`, { auth: API_AUTH, timeout: 30000 });
    const vehicles = vehiclesResp.data || [];
    console.log(`   Машины: ${vehicles.length} записей`);
    
    await pool.query('DELETE FROM vehicles');
    for (const v of vehicles) {
      await pool.query(
        `INSERT INTO vehicles (id, license_plate, model, synced_at) VALUES ($1, $2, $3, NOW())
         ON CONFLICT (id) DO UPDATE SET license_plate = EXCLUDED.license_plate, model = EXCLUDED.model, synced_at = NOW()`,
        [String(v.id || v.Ref_Key || ''), String(v.license_plate || v.ГосНомер || ''), String(v.model || v.Модель || v.Description || '')]
      );
    }
    
    // Drivers
    const driversResp = await axios.get(`${API_BASE_URL}/drivers`, { auth: API_AUTH, timeout: 30000 });
    const drivers = driversResp.data || [];
    console.log(`   Водители: ${drivers.length} записей`);
    
    await pool.query('DELETE FROM drivers');
    for (const d of drivers) {
      await pool.query(
        `INSERT INTO drivers (id, full_name, synced_at) VALUES ($1, $2, NOW())
         ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, synced_at = NOW()`,
        [String(d.id || d.Ref_Key || d.full_name || ''), String(d.full_name || d.ФИО || d.Description || '')]
      );
    }
  } catch (e) {
    console.error(`   ❌ Ошибка справочников: ${e.message}`);
  }

  // Генерируем месяцы
  const now = new Date();
  const months = generateMonths(2021, 1, now.getFullYear(), now.getMonth() + 1);
  
  console.log('');
  console.log(`📄 2. Синхронизация CONTRACTS (${months.length} месяцев)...`);
  
  let totalContracts = 0;
  for (let i = 0; i < months.length; i++) {
    const m = months[i];
    process.stdout.write(`   [${i + 1}/${months.length}] ${m.label}... `);
    
    const contracts = await loadContracts(m.from, m.to);
    
    for (const c of contracts) {
      try {
        await upsertContract(c);
        totalContracts++;
      } catch (e) {
        // Игнорируем ошибки дубликатов
      }
    }
    
    console.log(`${contracts.length} записей`);
    
    // Пауза чтобы не перегружать API
    await new Promise(r => setTimeout(r, 100));
  }
  
  console.log(`   ✅ Всего contracts: ${totalContracts}`);

  // Driver Reports — нужно разбивать на недели
  console.log('');
  console.log(`📋 3. Синхронизация DRIVER_REPORTS (${months.length} месяцев, по неделям)...`);
  
  let totalReports = 0;
  for (let i = 0; i < months.length; i++) {
    const m = months[i];
    process.stdout.write(`   [${i + 1}/${months.length}] ${m.label}... `);
    
    // Разбиваем месяц на недели
    const weeks = [];
    const startDate = new Date(m.from);
    const endDate = new Date(m.to);
    
    let weekStart = new Date(startDate);
    while (weekStart <= endDate) {
      let weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      if (weekEnd > endDate) weekEnd = new Date(endDate);
      
      weeks.push({
        from: weekStart.toISOString().split('T')[0],
        to: weekEnd.toISOString().split('T')[0]
      });
      
      weekStart = new Date(weekEnd);
      weekStart.setDate(weekStart.getDate() + 1);
    }
    
    let monthReports = 0;
    for (const week of weeks) {
      const reports = await loadDriverReports(week.from, week.to);
      if (reports) {
        for (const r of reports) {
          try {
            await upsertDriverReport(r);
            monthReports++;
            totalReports++;
          } catch (e) {
            // Игнорируем ошибки
          }
        }
      }
      await new Promise(r => setTimeout(r, 50));
    }
    
    console.log(`${monthReports} записей`);
  }
  
  console.log(`   ✅ Всего driver_reports: ${totalReports}`);

  // Итоговая статистика
  console.log('');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  ✅ СИНХРОНИЗАЦИЯ ЗАВЕРШЕНА!                               ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  
  const stats = await pool.query(`
    SELECT 
      (SELECT COUNT(*) FROM vehicles) as vehicles,
      (SELECT COUNT(*) FROM drivers) as drivers,
      (SELECT COUNT(*) FROM contracts) as contracts,
      (SELECT COUNT(*) FROM driver_reports) as reports,
      (SELECT MIN(date) FROM contracts) as min_date,
      (SELECT MAX(date) FROM contracts) as max_date
  `);
  
  const s = stats.rows[0];
  console.log('');
  console.log(`📊 Итого в базе:`);
  console.log(`   Машины:         ${s.vehicles}`);
  console.log(`   Водители:       ${s.drivers}`);
  console.log(`   Договоры:       ${s.contracts} (${s.min_date?.toISOString().split('T')[0]} — ${s.max_date?.toISOString().split('T')[0]})`);
  console.log(`   Отчёты водит.:  ${s.reports}`);
  
  await pool.end();
}

main().catch(e => {
  console.error('💥 Критическая ошибка:', e);
  process.exit(1);
});
