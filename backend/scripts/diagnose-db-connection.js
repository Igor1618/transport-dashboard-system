#!/usr/bin/env node
/**
 * Database Connection Diagnostics
 * Проверка подключения к PostgreSQL и структуры таблиц
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');

const CONFIG = {
  host: process.env.PG_HOST || 'localhost',
  port: parseInt(process.env.PG_PORT || '5433'),
  database: process.env.PG_DATABASE || 'postgres',
  user: process.env.PG_USER || 'postgres',
  password: process.env.PG_PASSWORD
};

console.log('='.repeat(50));
console.log('PostgreSQL Connection Diagnostics');
console.log('='.repeat(50));
console.log(`Host: ${CONFIG.host}`);
console.log(`Port: ${CONFIG.port}`);
console.log(`Database: ${CONFIG.database}`);
console.log(`User: ${CONFIG.user}`);
console.log('='.repeat(50));

async function diagnose() {
  const pool = new Pool(CONFIG);

  try {
    // Test connection
    console.log('\n[1] Testing connection...');
    const timeResult = await pool.query('SELECT NOW() as time, version() as version');
    console.log(`    [OK] Connected at ${timeResult.rows[0].time}`);
    console.log(`    PostgreSQL: ${timeResult.rows[0].version.split(',')[0]}`);

    // Check tables
    console.log('\n[2] Checking tables...');
    const tablesResult = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    console.log(`    Found ${tablesResult.rows.length} tables:`);
    tablesResult.rows.forEach(r => console.log(`    - ${r.table_name}`));

    // Check required tables
    console.log('\n[3] Checking required tables...');
    const requiredTables = ['vehicles', 'drivers', 'contracts', 'driver_reports'];
    const existingTables = tablesResult.rows.map(r => r.table_name);

    for (const table of requiredTables) {
      if (existingTables.includes(table)) {
        const countResult = await pool.query(`SELECT COUNT(*) as count FROM ${table}`);
        console.log(`    [OK] ${table}: ${countResult.rows[0].count} records`);
      } else {
        console.log(`    [X] ${table}: NOT FOUND`);
      }
    }

    // Check contracts date range
    if (existingTables.includes('contracts')) {
      console.log('\n[4] Contracts date range...');
      const dateResult = await pool.query(`
        SELECT MIN(date) as min_date, MAX(date) as max_date, COUNT(*) as total
        FROM contracts
      `);
      const { min_date, max_date, total } = dateResult.rows[0];
      console.log(`    From: ${min_date || 'N/A'}`);
      console.log(`    To: ${max_date || 'N/A'}`);
      console.log(`    Total: ${total} records`);
    }

    // Check driver_reports date range
    if (existingTables.includes('driver_reports')) {
      console.log('\n[5] Driver Reports date range...');
      const dateResult = await pool.query(`
        SELECT MIN(date_from) as min_date, MAX(date_to) as max_date, COUNT(*) as total
        FROM driver_reports
      `);
      const { min_date, max_date, total } = dateResult.rows[0];
      console.log(`    From: ${min_date || 'N/A'}`);
      console.log(`    To: ${max_date || 'N/A'}`);
      console.log(`    Total: ${total} records`);
    }

    // Check sync_log if exists
    if (existingTables.includes('sync_log')) {
      console.log('\n[6] Last sync log...');
      const logResult = await pool.query(`
        SELECT * FROM sync_log ORDER BY synced_at DESC LIMIT 1
      `);
      if (logResult.rows.length > 0) {
        console.log(`    Last sync: ${logResult.rows[0].synced_at}`);
        console.log(`    Status: ${logResult.rows[0].status}`);
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log('[OK] Diagnostics complete');
    console.log('='.repeat(50));

  } catch (error) {
    console.error(`\n[X] Error: ${error.message}`);
    console.log('\nPossible issues:');
    console.log('1. PostgreSQL is not running');
    console.log('2. Wrong port (should be 5433 for Supabase Docker)');
    console.log('3. Wrong credentials');
    console.log('4. Tables not created yet');
  } finally {
    await pool.end();
  }
}

diagnose();
