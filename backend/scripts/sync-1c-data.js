#!/usr/bin/env node

/**
 * Скрипт для синхронизации данных из 1C REST API в PostgreSQL
 * Использование: node sync-1c-data.js [month]
 * Пример: node sync-1c-data.js 2024-11
 */

const axios = require('axios');
const { Pool } = require('pg');
require('dotenv').config({ path: '../.env' });

// Настройки 1C API
const API_BASE_URL = 'http://192.168.33.250/tk/hs/TransportAPI/api/v1';
const API_AUTH = {
  username: 'TransportAPI',
  password: 'TransportAPI_SecretPass'
};

// Подключение к БД
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'postgres',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD
});

// Получить период для загрузки
const args = process.argv.slice(2);
const month = args[0] || '2024-11'; // По умолчанию ноябрь 2024

const dateFrom = `${month}-01`;
const dateTo = month === '2024-11' ? '2024-11-30' : `${month}-30`;

console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🔄 Синхронизация данных из 1C → PostgreSQL             ║
║                                                           ║
║   Период: ${dateFrom} - ${dateTo}                   ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
`);

// Функция для запроса к 1C API
async function fetch1CData(endpoint, params = {}) {
  try {
    const response = await axios.get(`${API_BASE_URL}${endpoint}`, {
      auth: API_AUTH,
      params,
      timeout: 30000
    });
    return response.data;
  } catch (error) {
    console.error(`❌ Ошибка при запросе ${endpoint}:`, error.message);
    return null;
  }
}

// 1. Синхронизация справочников: Машины
async function syncVehicles() {
  console.log('\n📊 1. Синхронизация справочника машин...');

  const vehicles = await fetch1CData('/vehicles');

  if (!vehicles || !Array.isArray(vehicles)) {
    console.error('❌ Не удалось получить данные машин');
    return;
  }

  console.log(`   Получено: ${vehicles.length} записей`);

  // Очистка таблицы
  await pool.query('DELETE FROM vehicles');
  console.log('   Таблица очищена');

  // Вставка данных
  let inserted = 0;
  for (const vehicle of vehicles) {
    try {
      await pool.query(
        `INSERT INTO vehicles (id, license_plate, model, synced_at)
         VALUES ($1, $2, $3, NOW())`,
        [vehicle.id, vehicle.license_plate, vehicle.model]
      );
      inserted++;
    } catch (error) {
      console.error(`   ⚠️  Ошибка при вставке машины ${vehicle.id}:`, error.message);
    }
  }

  console.log(`   ✅ Вставлено: ${inserted} машин`);
}

// 2. Синхронизация справочников: Водители
async function syncDrivers() {
  console.log('\n👥 2. Синхронизация справочника водителей...');

  const drivers = await fetch1CData('/drivers');

  if (!drivers || !Array.isArray(drivers)) {
    console.error('❌ Не удалось получить данные водителей');
    return;
  }

  console.log(`   Получено: ${drivers.length} записей`);

  // Очистка таблицы
  await pool.query('DELETE FROM drivers');
  console.log('   Таблица очищена');

  // Вставка данных
  let inserted = 0;
  for (const driver of drivers) {
    try {
      await pool.query(
        `INSERT INTO drivers (id, full_name, synced_at)
         VALUES ($1, $2, NOW())`,
        [driver.id, driver.full_name]
      );
      inserted++;
    } catch (error) {
      console.error(`   ⚠️  Ошибка при вставке водителя ${driver.id}:`, error.message);
    }
  }

  console.log(`   ✅ Вставлено: ${inserted} водителей`);
}

// 3. Синхронизация договоров
async function syncContracts() {
  console.log('\n📄 3. Синхронизация договоров...');

  const contracts = await fetch1CData('/contracts', {
    date_from: dateFrom,
    date_to: dateTo
  });

  if (!contracts || !Array.isArray(contracts)) {
    console.error('❌ Не удалось получить данные договоров');
    return;
  }

  console.log(`   Получено: ${contracts.length} записей`);

  let inserted = 0;
  let updated = 0;

  for (const contract of contracts) {
    try {
      const result = await pool.query(
        `INSERT INTO contracts (
          number, date, organization, contractor_id, contractor_name,
          vehicle_id, vehicle_number, driver_id, driver_name,
          responsible_logist, route, payment_term, payment_condition,
          amount, synced_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())
        ON CONFLICT (number, date) DO UPDATE SET
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
        RETURNING (xmax = 0) as inserted`,
        [
          contract.number,
          contract.date,
          contract.organization,
          contract.contractor_id,
          contract.contractor_name,
          contract.vehicle_id,
          contract.vehicle_number,
          contract.driver_id,
          contract.driver_name,
          contract.responsible_logist,
          contract.route,
          contract.payment_term,
          contract.payment_condition,
          contract.amount
        ]
      );

      if (result.rows[0].inserted) {
        inserted++;
      } else {
        updated++;
      }
    } catch (error) {
      console.error(`   ⚠️  Ошибка при обработке договора ${contract.number}:`, error.message);
    }
  }

  console.log(`   ✅ Вставлено: ${inserted}, Обновлено: ${updated}`);
}

// 4. Синхронизация отчетов водителей
async function syncDriverReports() {
  console.log('\n📋 4. Синхронизация отчетов водителей...');

  // Разбиваем период на недельные интервалы для обхода ограничения API (макс. 1000 записей)
  const weeklyRanges = [];
  const startDate = new Date(dateFrom);
  const endDate = new Date(dateTo);

  let currentStart = new Date(startDate);
  while (currentStart <= endDate) {
    let currentEnd = new Date(currentStart);
    currentEnd.setDate(currentEnd.getDate() + 6); // +6 дней = неделя

    if (currentEnd > endDate) {
      currentEnd = new Date(endDate);
    }

    weeklyRanges.push({
      from: currentStart.toISOString().split('T')[0],
      to: currentEnd.toISOString().split('T')[0]
    });

    currentStart.setDate(currentStart.getDate() + 7);
  }

  console.log(`   Период разбит на ${weeklyRanges.length} недельных интервалов`);

  let allReports = [];

  // Загружаем данные по неделям
  for (let i = 0; i < weeklyRanges.length; i++) {
    const range = weeklyRanges[i];
    console.log(`   Загрузка ${i + 1}/${weeklyRanges.length}: ${range.from} - ${range.to}`);

    const reports = await fetch1CData('/driver-reports', {
      date_from: range.from,
      date_to: range.to
    });

    if (!reports || !Array.isArray(reports)) {
      console.error(`   ⚠️  Не удалось получить отчеты за период ${range.from} - ${range.to}`);
      continue;
    }

    console.log(`   Получено: ${reports.length} записей`);
    allReports = allReports.concat(reports);
  }

  if (allReports.length === 0) {
    console.error('❌ Не удалось получить отчеты водителей');
    return;
  }

  console.log(`   Всего получено: ${allReports.length} записей`);

  let inserted = 0;
  let updated = 0;

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
          report.id,
          report.number,
          report.date_from,
          report.date_to,
          report.driver_id,
          report.driver_name,
          report.vehicle_id,
          report.vehicle_number,
          report.fuel_start,
          report.fuel_end,
          report.mileage,
          report.fuel_quantity,
          report.fuel_amount,
          report.total_expenses,
          report.driver_accruals,
          report.driver_payments
        ]
      );

      if (result.rows[0].inserted) {
        inserted++;
      } else {
        updated++;
      }

      // Обработка категорий расходов
      if (report.expense_categories && Array.isArray(report.expense_categories)) {
        // Удалить старые категории для этого отчета
        await pool.query('DELETE FROM expense_categories WHERE driver_report_id = $1', [report.id]);

        // Вставить новые
        for (const category of report.expense_categories) {
          await pool.query(
            `INSERT INTO expense_categories (driver_report_id, category, amount)
             VALUES ($1, $2, $3)`,
            [report.id, category.category, category.amount]
          );
        }
      }
    } catch (error) {
      console.error(`   ⚠️  Ошибка при обработке отчета ${report.id}:`, error.message);
    }
  }

  console.log(`   ✅ Вставлено: ${inserted}, Обновлено: ${updated}`);
}

// Главная функция
async function main() {
  try {
    await syncVehicles();
    await syncDrivers();
    await syncContracts();
    await syncDriverReports();

    console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   ✅ Синхронизация завершена успешно!                    ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
    `);

    process.exit(0);
  } catch (error) {
    console.error('\n❌ КРИТИЧЕСКАЯ ОШИБКА:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Запуск
main();
