#!/usr/bin/env node
/**
 * Historical Data Loader
 * Загружает все данные contracts и driver_reports с 2021-01-01 по текущую дату
 *
 * Особенности:
 * - Contracts: загружаются помесячно
 * - Driver Reports: загружаются понедельно (API ограничение)
 * - Checkpoint: сохраняется прогресс для возобновления
 * - Retry: автоматические повторы при ошибках
 * - Upsert: ON CONFLICT DO UPDATE
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

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
  },
  sync: {
    startDate: process.env.SYNC_START_DATE || '2021-01-01',
    requestDelayMs: parseInt(process.env.REQUEST_DELAY_MS || '1000'),
    maxRetries: parseInt(process.env.MAX_RETRIES || '3')
  }
};

const CHECKPOINT_FILE = path.join(__dirname, '.checkpoint.json');

// PostgreSQL Pool
const pool = new Pool(CONFIG.pg);

// Axios instance with Basic Auth
const api = axios.create({
  baseURL: CONFIG.api.baseUrl,
  auth: {
    username: CONFIG.api.username,
    password: CONFIG.api.password
  },
  timeout: 60000 // 60 seconds
});

/**
 * Sleep helper
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Format date to YYYY-MM-DD
 */
function formatDate(date) {
  return date.toISOString().split('T')[0];
}

/**
 * Generate monthly periods from startDate to endDate
 */
function generateMonthlyPeriods(startDate, endDate) {
  const periods = [];
  let current = new Date(startDate);
  const end = new Date(endDate);

  while (current <= end) {
    const periodStart = new Date(current);
    const periodEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0); // Last day of month

    if (periodEnd > end) {
      periods.push({
        from: formatDate(periodStart),
        to: formatDate(end)
      });
    } else {
      periods.push({
        from: formatDate(periodStart),
        to: formatDate(periodEnd)
      });
    }

    // Move to first day of next month
    current = new Date(current.getFullYear(), current.getMonth() + 1, 1);
  }

  return periods;
}

/**
 * Generate weekly periods from startDate to endDate
 */
function generateWeeklyPeriods(startDate, endDate) {
  const periods = [];
  let current = new Date(startDate);
  const end = new Date(endDate);

  while (current <= end) {
    const periodStart = new Date(current);
    const periodEnd = new Date(current);
    periodEnd.setDate(periodEnd.getDate() + 6); // 7 days period

    if (periodEnd > end) {
      periods.push({
        from: formatDate(periodStart),
        to: formatDate(end)
      });
    } else {
      periods.push({
        from: formatDate(periodStart),
        to: formatDate(periodEnd)
      });
    }

    // Move to next week
    current.setDate(current.getDate() + 7);
  }

  return periods;
}

/**
 * Fetch data from 1C API with retry logic
 */
async function fetchFromAPI(endpoint, dateFrom, dateTo, retries = CONFIG.sync.maxRetries) {
  const url = `/${endpoint}?date_from=${dateFrom}&date_to=${dateTo}`;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await api.get(url);
      return response.data || [];
    } catch (error) {
      const status = error.response?.status;
      const message = error.response?.data?.message || error.message;

      console.log(`  [!] Attempt ${attempt}/${retries} failed: ${message}`);

      if (attempt < retries) {
        const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
        console.log(`  [!] Retrying in ${delay/1000}s...`);
        await sleep(delay);
      } else {
        console.log(`  [X] All ${retries} attempts failed for ${url}`);
        return [];
      }
    }
  }
  return [];
}

/**
 * Upsert contracts to PostgreSQL
 */
async function upsertContracts(contracts) {
  if (!contracts || contracts.length === 0) return 0;

  const client = await pool.connect();
  let inserted = 0;

  try {
    await client.query('BEGIN');

    for (const contract of contracts) {
      const query = `
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
      `;

      const values = [
        contract.number,
        contract.date ? new Date(contract.date) : null,
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
        parseFloat(contract.amount) || 0
      ];

      await client.query(query, values);
      inserted++;
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    console.log(`  [X] DB Error: ${error.message}`);
    throw error;
  } finally {
    client.release();
  }

  return inserted;
}

/**
 * Upsert driver reports to PostgreSQL
 */
async function upsertDriverReports(reports) {
  if (!reports || reports.length === 0) return 0;

  const client = await pool.connect();
  let inserted = 0;

  try {
    await client.query('BEGIN');

    for (const report of reports) {
      const query = `
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
      `;

      const values = [
        report.id,
        report.number,
        report.date_from ? new Date(report.date_from) : null,
        report.date_to ? new Date(report.date_to) : null,
        report.driver_id,
        report.driver_name,
        report.vehicle_id,
        report.vehicle_number,
        parseFloat(report.fuel_start) || 0,
        parseFloat(report.fuel_end) || 0,
        parseFloat(report.mileage) || 0,
        parseFloat(report.fuel_quantity) || 0,
        parseFloat(report.fuel_amount) || 0,
        parseFloat(report.total_expenses) || 0,
        parseFloat(report.driver_accruals) || 0,
        parseFloat(report.driver_payments) || 0,
        JSON.stringify(report.expense_categories || [])
      ];

      await client.query(query, values);
      inserted++;
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    console.log(`  [X] DB Error: ${error.message}`);
    throw error;
  } finally {
    client.release();
  }

  return inserted;
}

/**
 * Load checkpoint
 */
function loadCheckpoint() {
  try {
    if (fs.existsSync(CHECKPOINT_FILE)) {
      return JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf8'));
    }
  } catch (error) {
    console.log('[!] Failed to load checkpoint, starting fresh');
  }
  return {
    contracts: { lastPeriod: null, totalRecords: 0 },
    driverReports: { lastPeriod: null, totalRecords: 0 },
    startedAt: new Date().toISOString()
  };
}

/**
 * Save checkpoint
 */
function saveCheckpoint(checkpoint) {
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(checkpoint, null, 2));
}

/**
 * Progress bar helper
 */
function progressBar(current, total, width = 30) {
  const percent = Math.round((current / total) * 100);
  const filled = Math.round((current / total) * width);
  const empty = width - filled;
  return `[${'='.repeat(filled)}${' '.repeat(empty)}] ${percent}% (${current}/${total})`;
}

/**
 * Load contracts history
 */
async function loadContractsHistory(checkpoint) {
  const endDate = new Date();
  const periods = generateMonthlyPeriods(CONFIG.sync.startDate, endDate);

  console.log('\n========================================');
  console.log('CONTRACTS - Historical Load');
  console.log(`Periods: ${periods.length} months (${CONFIG.sync.startDate} to ${formatDate(endDate)})`);
  console.log('========================================\n');

  let startIndex = 0;
  if (checkpoint.contracts.lastPeriod) {
    startIndex = periods.findIndex(p => p.from === checkpoint.contracts.lastPeriod) + 1;
    if (startIndex > 0) {
      console.log(`[i] Resuming from period ${startIndex}/${periods.length}`);
    }
  }

  let totalRecords = checkpoint.contracts.totalRecords || 0;

  for (let i = startIndex; i < periods.length; i++) {
    const period = periods[i];
    process.stdout.write(`\r${progressBar(i + 1, periods.length)} ${period.from} to ${period.to}`);

    const data = await fetchFromAPI('contracts', period.from, period.to);

    if (data.length > 0) {
      const inserted = await upsertContracts(data);
      totalRecords += inserted;
      console.log(` -> ${data.length} records`);
    } else {
      console.log(` -> 0 records`);
    }

    // Save checkpoint
    checkpoint.contracts.lastPeriod = period.from;
    checkpoint.contracts.totalRecords = totalRecords;
    saveCheckpoint(checkpoint);

    // Delay between requests
    await sleep(CONFIG.sync.requestDelayMs);
  }

  console.log(`\n[OK] Contracts complete. Total: ${totalRecords} records`);
  return totalRecords;
}

/**
 * Load driver reports history
 */
async function loadDriverReportsHistory(checkpoint) {
  const endDate = new Date();
  const periods = generateWeeklyPeriods(CONFIG.sync.startDate, endDate);

  console.log('\n========================================');
  console.log('DRIVER REPORTS - Historical Load');
  console.log(`Periods: ${periods.length} weeks (${CONFIG.sync.startDate} to ${formatDate(endDate)})`);
  console.log('========================================\n');

  let startIndex = 0;
  if (checkpoint.driverReports.lastPeriod) {
    startIndex = periods.findIndex(p => p.from === checkpoint.driverReports.lastPeriod) + 1;
    if (startIndex > 0) {
      console.log(`[i] Resuming from period ${startIndex}/${periods.length}`);
    }
  }

  let totalRecords = checkpoint.driverReports.totalRecords || 0;

  for (let i = startIndex; i < periods.length; i++) {
    const period = periods[i];
    process.stdout.write(`\r${progressBar(i + 1, periods.length)} ${period.from} to ${period.to}`);

    const data = await fetchFromAPI('driver-reports', period.from, period.to);

    if (data.length > 0) {
      const inserted = await upsertDriverReports(data);
      totalRecords += inserted;
      console.log(` -> ${data.length} records`);
    } else {
      console.log(` -> 0 records`);
    }

    // Save checkpoint
    checkpoint.driverReports.lastPeriod = period.from;
    checkpoint.driverReports.totalRecords = totalRecords;
    saveCheckpoint(checkpoint);

    // Delay between requests
    await sleep(CONFIG.sync.requestDelayMs);
  }

  console.log(`\n[OK] Driver reports complete. Total: ${totalRecords} records`);
  return totalRecords;
}

/**
 * Main function
 */
async function main() {
  console.log('='.repeat(50));
  console.log('1C to PostgreSQL - Historical Data Loader');
  console.log('='.repeat(50));
  console.log(`Start Date: ${CONFIG.sync.startDate}`);
  console.log(`PostgreSQL: ${CONFIG.pg.host}:${CONFIG.pg.port}/${CONFIG.pg.database}`);
  console.log(`API: ${CONFIG.api.baseUrl}`);
  console.log('='.repeat(50));

  // Test database connection
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    console.log(`[OK] Database connected: ${result.rows[0].now}`);
    client.release();
  } catch (error) {
    console.error(`[X] Database connection failed: ${error.message}`);
    process.exit(1);
  }

  // Load checkpoint
  const checkpoint = loadCheckpoint();
  if (checkpoint.startedAt !== new Date().toISOString().split('T')[0]) {
    console.log(`[i] Checkpoint found. Started: ${checkpoint.startedAt}`);
    console.log(`    Contracts: ${checkpoint.contracts.totalRecords} records (last: ${checkpoint.contracts.lastPeriod || 'none'})`);
    console.log(`    Driver Reports: ${checkpoint.driverReports.totalRecords} records (last: ${checkpoint.driverReports.lastPeriod || 'none'})`);
  }

  const startTime = Date.now();

  try {
    // Check command line args
    const args = process.argv.slice(2);
    const loadContracts = args.length === 0 || args.includes('contracts');
    const loadReports = args.length === 0 || args.includes('reports');

    if (loadContracts) {
      await loadContractsHistory(checkpoint);
    }

    if (loadReports) {
      await loadDriverReportsHistory(checkpoint);
    }

    const duration = Math.round((Date.now() - startTime) / 1000);
    console.log('\n' + '='.repeat(50));
    console.log('SUMMARY');
    console.log('='.repeat(50));
    console.log(`Duration: ${Math.floor(duration / 60)}m ${duration % 60}s`);
    console.log(`Contracts: ${checkpoint.contracts.totalRecords} records`);
    console.log(`Driver Reports: ${checkpoint.driverReports.totalRecords} records`);
    console.log('='.repeat(50));

    // Clear checkpoint on successful completion
    if (fs.existsSync(CHECKPOINT_FILE)) {
      fs.unlinkSync(CHECKPOINT_FILE);
      console.log('[i] Checkpoint cleared');
    }

  } catch (error) {
    console.error(`\n[X] Fatal error: ${error.message}`);
    console.log('[i] Checkpoint saved. Run again to resume.');
    process.exit(1);
  }

  await pool.end();
  console.log('\n[OK] Done!');
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { generateMonthlyPeriods, generateWeeklyPeriods, fetchFromAPI };
