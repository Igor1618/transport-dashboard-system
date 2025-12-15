#!/usr/bin/env node
/**
 * Regular Data Sync
 * Синхронизирует данные за последние 30 дней для поддержания актуальности
 * Предназначен для запуска по расписанию (cron или n8n)
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');
const axios = require('axios');

// Configuration
const CONFIG = {
  pg: {
    host: process.env.PG_HOST || 'localhost',
    port: parseInt(process.env.PG_PORT || '5433'),
    database: process.env.PG_DATABASE || 'postgres',
    user: process.env.PG_USER || 'postgres',
    password: process.env.PG_PASSWORD
  },
  api: {
    baseUrl: process.env.API_BASE_URL || 'http://192.168.33.250/tk/hs/TransportAPI/api/v1',
    username: process.env.API_USERNAME || 'TransportAPI',
    password: process.env.API_PASSWORD || 'TransportAPI_SecretPass'
  }
};

const pool = new Pool(CONFIG.pg);
const api = axios.create({
  baseURL: CONFIG.api.baseUrl,
  auth: {
    username: CONFIG.api.username,
    password: CONFIG.api.password
  },
  timeout: 60000
});

function formatDate(date) {
  return date.toISOString().split('T')[0];
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Sync vehicles (full)
 */
async function syncVehicles() {
  console.log('[VEHICLES] Starting sync...');

  try {
    const response = await api.get('/vehicles');
    const vehicles = response.data || [];

    if (vehicles.length === 0) {
      console.log('[VEHICLES] No data returned from API');
      return 0;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (const v of vehicles) {
        await client.query(`
          INSERT INTO vehicles (id, license_plate, model, created_at, synced_at)
          VALUES ($1, $2, $3, NOW(), NOW())
          ON CONFLICT (id) DO UPDATE SET
            license_plate = EXCLUDED.license_plate,
            model = EXCLUDED.model,
            synced_at = NOW()
        `, [v.id, v.license_plate, v.model]);
      }

      await client.query('COMMIT');
      console.log(`[VEHICLES] Synced ${vehicles.length} records`);
      return vehicles.length;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error(`[VEHICLES] Error: ${error.message}`);
    return 0;
  }
}

/**
 * Sync drivers (full)
 */
async function syncDrivers() {
  console.log('[DRIVERS] Starting sync...');

  try {
    const response = await api.get('/drivers');
    const drivers = response.data || [];

    if (drivers.length === 0) {
      console.log('[DRIVERS] No data returned from API');
      return 0;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (const d of drivers) {
        await client.query(`
          INSERT INTO drivers (id, full_name, created_at, synced_at)
          VALUES ($1, $2, NOW(), NOW())
          ON CONFLICT (id) DO UPDATE SET
            full_name = EXCLUDED.full_name,
            synced_at = NOW()
        `, [d.id, d.full_name || d.name]);
      }

      await client.query('COMMIT');
      console.log(`[DRIVERS] Synced ${drivers.length} records`);
      return drivers.length;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error(`[DRIVERS] Error: ${error.message}`);
    return 0;
  }
}

/**
 * Sync contracts (last 30 days)
 */
async function syncContracts() {
  console.log('[CONTRACTS] Starting sync (last 30 days)...');

  const dateTo = new Date();
  const dateFrom = new Date();
  dateFrom.setDate(dateFrom.getDate() - 30);

  try {
    const response = await api.get(`/contracts?date_from=${formatDate(dateFrom)}&date_to=${formatDate(dateTo)}`);
    const contracts = response.data || [];

    if (contracts.length === 0) {
      console.log('[CONTRACTS] No data for period');
      return 0;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (const c of contracts) {
        await client.query(`
          INSERT INTO contracts (
            number, date, organization, contractor_id, contractor_name,
            vehicle_id, vehicle_number, driver_id, driver_name,
            responsible_logist, route, payment_term, payment_condition,
            amount, created_at, synced_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW(), NOW())
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
            synced_at = NOW(),
            updated_at = NOW()
        `, [
          c.number, c.date ? new Date(c.date) : null, c.organization,
          c.contractor_id, c.contractor_name, c.vehicle_id, c.vehicle_number,
          c.driver_id, c.driver_name, c.responsible_logist, c.route,
          c.payment_term, c.payment_condition, parseFloat(c.amount) || 0
        ]);
      }

      await client.query('COMMIT');
      console.log(`[CONTRACTS] Synced ${contracts.length} records`);
      return contracts.length;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error(`[CONTRACTS] Error: ${error.message}`);
    return 0;
  }
}

/**
 * Sync driver reports (last 30 days, weekly chunks)
 */
async function syncDriverReports() {
  console.log('[DRIVER_REPORTS] Starting sync (last 30 days)...');

  const dateTo = new Date();
  const dateFrom = new Date();
  dateFrom.setDate(dateFrom.getDate() - 30);

  let totalRecords = 0;
  let current = new Date(dateFrom);

  while (current < dateTo) {
    const weekEnd = new Date(current);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const periodEnd = weekEnd > dateTo ? dateTo : weekEnd;

    try {
      const response = await api.get(`/driver-reports?date_from=${formatDate(current)}&date_to=${formatDate(periodEnd)}`);
      const reports = response.data || [];

      if (reports.length > 0) {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');

          for (const r of reports) {
            await client.query(`
              INSERT INTO driver_reports (
                id, number, date_from, date_to, driver_id, driver_name,
                vehicle_id, vehicle_number, fuel_start, fuel_end, mileage,
                fuel_quantity, fuel_amount, total_expenses, driver_accruals,
                driver_payments, expense_categories, created_at, synced_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW(), NOW())
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
            `, [
              r.id, r.number, r.date_from ? new Date(r.date_from) : null,
              r.date_to ? new Date(r.date_to) : null, r.driver_id, r.driver_name,
              r.vehicle_id, r.vehicle_number, parseFloat(r.fuel_start) || 0,
              parseFloat(r.fuel_end) || 0, parseFloat(r.mileage) || 0,
              parseFloat(r.fuel_quantity) || 0, parseFloat(r.fuel_amount) || 0,
              parseFloat(r.total_expenses) || 0, parseFloat(r.driver_accruals) || 0,
              parseFloat(r.driver_payments) || 0, JSON.stringify(r.expense_categories || [])
            ]);
          }

          await client.query('COMMIT');
          totalRecords += reports.length;
        } finally {
          client.release();
        }
      }

      await sleep(500); // Small delay between weeks
    } catch (error) {
      console.error(`[DRIVER_REPORTS] Error for ${formatDate(current)}-${formatDate(periodEnd)}: ${error.message}`);
    }

    current.setDate(current.getDate() + 7);
  }

  console.log(`[DRIVER_REPORTS] Synced ${totalRecords} records`);
  return totalRecords;
}

/**
 * Log sync result
 */
async function logSyncResult(results) {
  try {
    await pool.query(`
      INSERT INTO sync_log (sync_type, vehicles_count, drivers_count, contracts_count, driver_reports_count, synced_at, status)
      VALUES ($1, $2, $3, $4, $5, NOW(), $6)
    `, ['daily', results.vehicles, results.drivers, results.contracts, results.driverReports, 'success']);
  } catch (error) {
    // Table might not exist, ignore
  }
}

async function main() {
  console.log('='.repeat(50));
  console.log('1C to PostgreSQL - Regular Sync');
  console.log(`Time: ${new Date().toISOString()}`);
  console.log('='.repeat(50));

  // Test connection
  try {
    await pool.query('SELECT 1');
    console.log('[OK] Database connected\n');
  } catch (error) {
    console.error(`[X] Database error: ${error.message}`);
    process.exit(1);
  }

  const results = {
    vehicles: 0,
    drivers: 0,
    contracts: 0,
    driverReports: 0
  };

  results.vehicles = await syncVehicles();
  await sleep(1000);

  results.drivers = await syncDrivers();
  await sleep(1000);

  results.contracts = await syncContracts();
  await sleep(1000);

  results.driverReports = await syncDriverReports();

  await logSyncResult(results);

  console.log('\n' + '='.repeat(50));
  console.log('SYNC COMPLETE');
  console.log(`Vehicles: ${results.vehicles}`);
  console.log(`Drivers: ${results.drivers}`);
  console.log(`Contracts: ${results.contracts}`);
  console.log(`Driver Reports: ${results.driverReports}`);
  console.log('='.repeat(50));

  await pool.end();
}

main().catch(console.error);
