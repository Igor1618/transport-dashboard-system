#!/usr/bin/env node
/**
 * СИНХРОНИЗАЦИЯ ДАННЫХ ИЗ 1C ERP В POSTGRESQL
 *
 * ВАЖНО: Этот скрипт ПРИНУДИТЕЛЬНО очищает переменные PGPORT/PGHOST
 * чтобы гарантировать подключение к порту 5433
 *
 * Версия: 2.0 (исправлена проблема с портом)
 * Файл: sync-1c-data.js
 * UUID: a1b2c3d4-sync-v2-fixed-port-5433
 */

// ==========================================
// КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Очищаем PG* переменные окружения
// Библиотека pg читает их и ПЕРЕОПРЕДЕЛЯЕТ конфиг Pool!
// ==========================================
console.log('🔧 [INIT] Очистка переменных окружения PG*...');
const pgEnvVars = ['PGPORT', 'PGHOST', 'PGUSER', 'PGPASSWORD', 'PGDATABASE'];
pgEnvVars.forEach(key => {
  if (process.env[key]) {
    console.log(`   ⚠️  Удаляем ${key}=${key.includes('PASSWORD') ? '***' : process.env[key]}`);
    delete process.env[key];
  }
});

const { Pool } = require('pg');
const https = require('https');
const http = require('http');

// ==========================================
// КОНФИГУРАЦИЯ БАЗЫ ДАННЫХ (ЖЁСТКО ПРОПИСАНА)
// ==========================================
const DB_CONFIG = {
  host: 'localhost',
  port: 5433,  // SUPABASE Docker PostgreSQL
  database: 'postgres',
  user: 'postgres',
  password: '5+NMkUPabjFbh5vGZtWx5ea0QAX2NSR3G1k0sfAedms=',
  // Дополнительные параметры для надёжности
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
  max: 10
};

// ==========================================
// КОНФИГУРАЦИЯ 1C API
// ==========================================
const API_CONFIG = {
  baseUrl: 'http://192.168.33.250/tk/hs/TransportAPI/api/v1',
  username: 'TransportAPI',
  password: 'TransportAPI_SecretPass',
  timeout: 30000
};

// ==========================================
// ЛОГИРОВАНИЕ И ПРОВЕРКА
// ==========================================
console.log('');
console.log('='.repeat(60));
console.log('🚀 ЗАПУСК СИНХРОНИЗАЦИИ 1C -> PostgreSQL');
console.log('='.repeat(60));
console.log(`📅 Время запуска: ${new Date().toISOString()}`);
console.log(`📄 Скрипт: ${__filename}`);
console.log(`📁 Директория: ${__dirname}`);
console.log(`🔢 PID: ${process.pid}`);
console.log('');
console.log('📊 КОНФИГУРАЦИЯ БД:');
console.log(`   host: ${DB_CONFIG.host}`);
console.log(`   port: ${DB_CONFIG.port} ← ПОРТ ДОЛЖЕН БЫТЬ 5433!`);
console.log(`   database: ${DB_CONFIG.database}`);
console.log(`   user: ${DB_CONFIG.user}`);
console.log('');

// ==========================================
// СОЗДАНИЕ ПУЛА ПОДКЛЮЧЕНИЙ
// ==========================================
console.log('🔌 Создание Pool подключения...');
const pool = new Pool(DB_CONFIG);

// Проверяем реальные настройки pool
console.log(`   ✅ Pool создан`);
console.log(`   ✅ pool.options.port = ${pool.options.port}`);
if (pool.options.port !== 5433) {
  console.error('');
  console.error('❌ КРИТИЧЕСКАЯ ОШИБКА: pool.options.port !== 5433!');
  console.error('   Это значит что библиотека pg где-то взяла другой порт');
  console.error('   Проверьте: ~/.pgpass, /etc/postgresql/*/main/postgresql.conf');
  process.exit(1);
}
console.log('');

// ==========================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ==========================================

/**
 * Выполнение HTTP запроса к 1C API
 */
async function fetch1CApi(endpoint) {
  return new Promise((resolve, reject) => {
    const url = `${API_CONFIG.baseUrl}${endpoint}`;
    console.log(`   📡 Запрос к API: ${endpoint}`);

    const auth = Buffer.from(`${API_CONFIG.username}:${API_CONFIG.password}`).toString('base64');

    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || 80,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json'
      },
      timeout: API_CONFIG.timeout
    };

    const client = urlObj.protocol === 'https:' ? https : http;

    const req = client.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error(`Ошибка парсинга JSON: ${e.message}`));
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data.substring(0, 200)}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Timeout'));
    });

    req.end();
  });
}

/**
 * Тестовое подключение к БД
 */
async function testDatabaseConnection() {
  console.log('🔍 Тестирование подключения к PostgreSQL...');
  try {
    const result = await pool.query('SELECT version(), current_setting(\'port\') as db_port');
    console.log(`   ✅ Подключение успешно!`);
    console.log(`   📊 PostgreSQL порт (из БД): ${result.rows[0].db_port}`);
    console.log(`   📊 Версия: ${result.rows[0].version.substring(0, 50)}...`);
    return true;
  } catch (error) {
    console.error(`   ❌ Ошибка подключения: ${error.message}`);

    // Детальная диагностика
    if (error.message.includes('5432')) {
      console.error('');
      console.error('   ⚠️  ВНИМАНИЕ: Ошибка содержит порт 5432!');
      console.error('   Но мы настроили 5433. Возможные причины:');
      console.error('   1. Где-то осталась переменная PGPORT=5432');
      console.error('   2. Выполняется другая версия скрипта');
      console.error('   3. Есть проблема с кешированием node_modules');
      console.error('');
      console.error('   Попробуйте: rm -rf node_modules && npm install');
    }

    return false;
  }
}

// ==========================================
// СИНХРОНИЗАЦИЯ ДАННЫХ
// ==========================================

/**
 * Синхронизация транспортных средств
 */
async function syncVehicles() {
  console.log('');
  console.log('🚗 СИНХРОНИЗАЦИЯ ТРАНСПОРТНЫХ СРЕДСТВ');
  console.log('-'.repeat(40));

  try {
    // Получаем данные из 1C
    const vehicles = await fetch1CApi('/vehicles');
    console.log(`   📥 Получено записей из 1C: ${vehicles.length || 0}`);

    if (!vehicles || vehicles.length === 0) {
      console.log('   ⚠️  Нет данных для синхронизации');
      return { synced: 0, errors: 0 };
    }

    // Создаём таблицу если не существует
    await pool.query(`
      CREATE TABLE IF NOT EXISTS vehicles (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255),
        reg_number VARCHAR(50),
        vehicle_type VARCHAR(100),
        status VARCHAR(50),
        driver_id VARCHAR(50),
        last_sync TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        raw_data JSONB
      )
    `);

    // Синхронизируем записи
    let synced = 0;
    let errors = 0;

    for (const vehicle of vehicles) {
      try {
        await pool.query(`
          INSERT INTO vehicles (id, name, reg_number, vehicle_type, status, driver_id, last_sync, raw_data)
          VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, $7)
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            reg_number = EXCLUDED.reg_number,
            vehicle_type = EXCLUDED.vehicle_type,
            status = EXCLUDED.status,
            driver_id = EXCLUDED.driver_id,
            last_sync = CURRENT_TIMESTAMP,
            raw_data = EXCLUDED.raw_data
        `, [
          vehicle.id || vehicle.Ref_Key,
          vehicle.name || vehicle.Description,
          vehicle.regNumber || vehicle.ГосНомер,
          vehicle.type || vehicle.ТипТС,
          vehicle.status || 'active',
          vehicle.driverId || vehicle.Водитель_Key,
          JSON.stringify(vehicle)
        ]);
        synced++;
      } catch (err) {
        console.error(`   ❌ Ошибка записи ${vehicle.id}: ${err.message}`);
        errors++;
      }
    }

    console.log(`   ✅ Синхронизировано: ${synced}`);
    if (errors > 0) console.log(`   ❌ Ошибок: ${errors}`);

    return { synced, errors };

  } catch (error) {
    console.error(`   ❌ ОШИБКА: ${error.message}`);
    return { synced: 0, errors: 1 };
  }
}

/**
 * Синхронизация водителей
 */
async function syncDrivers() {
  console.log('');
  console.log('👤 СИНХРОНИЗАЦИЯ ВОДИТЕЛЕЙ');
  console.log('-'.repeat(40));

  try {
    const drivers = await fetch1CApi('/drivers');
    console.log(`   📥 Получено записей из 1C: ${drivers.length || 0}`);

    if (!drivers || drivers.length === 0) {
      console.log('   ⚠️  Нет данных для синхронизации');
      return { synced: 0, errors: 0 };
    }

    await pool.query(`
      CREATE TABLE IF NOT EXISTS drivers (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255),
        phone VARCHAR(50),
        license_number VARCHAR(50),
        status VARCHAR(50),
        last_sync TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        raw_data JSONB
      )
    `);

    let synced = 0;
    let errors = 0;

    for (const driver of drivers) {
      try {
        await pool.query(`
          INSERT INTO drivers (id, name, phone, license_number, status, last_sync, raw_data)
          VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, $6)
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            phone = EXCLUDED.phone,
            license_number = EXCLUDED.license_number,
            status = EXCLUDED.status,
            last_sync = CURRENT_TIMESTAMP,
            raw_data = EXCLUDED.raw_data
        `, [
          driver.id || driver.Ref_Key,
          driver.name || driver.Description,
          driver.phone || driver.Телефон,
          driver.license || driver.НомерВУ,
          driver.status || 'active',
          JSON.stringify(driver)
        ]);
        synced++;
      } catch (err) {
        console.error(`   ❌ Ошибка записи ${driver.id}: ${err.message}`);
        errors++;
      }
    }

    console.log(`   ✅ Синхронизировано: ${synced}`);
    if (errors > 0) console.log(`   ❌ Ошибок: ${errors}`);

    return { synced, errors };

  } catch (error) {
    console.error(`   ❌ ОШИБКА: ${error.message}`);
    return { synced: 0, errors: 1 };
  }
}

/**
 * Синхронизация рейсов/путевых листов
 */
async function syncTrips() {
  console.log('');
  console.log('🛣️  СИНХРОНИЗАЦИЯ РЕЙСОВ');
  console.log('-'.repeat(40));

  try {
    const trips = await fetch1CApi('/trips');
    console.log(`   📥 Получено записей из 1C: ${trips.length || 0}`);

    if (!trips || trips.length === 0) {
      console.log('   ⚠️  Нет данных для синхронизации');
      return { synced: 0, errors: 0 };
    }

    await pool.query(`
      CREATE TABLE IF NOT EXISTS trips (
        id VARCHAR(50) PRIMARY KEY,
        number VARCHAR(50),
        date DATE,
        vehicle_id VARCHAR(50),
        driver_id VARCHAR(50),
        route VARCHAR(500),
        status VARCHAR(50),
        distance_km NUMERIC(10,2),
        fuel_consumed NUMERIC(10,2),
        last_sync TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        raw_data JSONB
      )
    `);

    let synced = 0;
    let errors = 0;

    for (const trip of trips) {
      try {
        await pool.query(`
          INSERT INTO trips (id, number, date, vehicle_id, driver_id, route, status, distance_km, fuel_consumed, last_sync, raw_data)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP, $10)
          ON CONFLICT (id) DO UPDATE SET
            number = EXCLUDED.number,
            date = EXCLUDED.date,
            vehicle_id = EXCLUDED.vehicle_id,
            driver_id = EXCLUDED.driver_id,
            route = EXCLUDED.route,
            status = EXCLUDED.status,
            distance_km = EXCLUDED.distance_km,
            fuel_consumed = EXCLUDED.fuel_consumed,
            last_sync = CURRENT_TIMESTAMP,
            raw_data = EXCLUDED.raw_data
        `, [
          trip.id || trip.Ref_Key,
          trip.number || trip.Номер,
          trip.date || trip.Дата,
          trip.vehicleId || trip.ТС_Key,
          trip.driverId || trip.Водитель_Key,
          trip.route || trip.Маршрут,
          trip.status || 'completed',
          trip.distance || trip.Пробег || 0,
          trip.fuel || trip.РасходТоплива || 0,
          JSON.stringify(trip)
        ]);
        synced++;
      } catch (err) {
        console.error(`   ❌ Ошибка записи ${trip.id}: ${err.message}`);
        errors++;
      }
    }

    console.log(`   ✅ Синхронизировано: ${synced}`);
    if (errors > 0) console.log(`   ❌ Ошибок: ${errors}`);

    return { synced, errors };

  } catch (error) {
    console.error(`   ❌ ОШИБКА: ${error.message}`);
    return { synced: 0, errors: 1 };
  }
}

// ==========================================
// ГЛАВНАЯ ФУНКЦИЯ
// ==========================================
async function main() {
  const startTime = Date.now();

  try {
    // Тест подключения
    const connected = await testDatabaseConnection();
    if (!connected) {
      console.error('');
      console.error('❌ КРИТИЧЕСКАЯ ОШИБКА: Не удалось подключиться к БД');
      process.exit(1);
    }

    // Запускаем синхронизацию
    const results = {
      vehicles: await syncVehicles(),
      drivers: await syncDrivers(),
      trips: await syncTrips()
    };

    // Итоговый отчёт
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log('');
    console.log('='.repeat(60));
    console.log('📊 ИТОГОВЫЙ ОТЧЁТ');
    console.log('='.repeat(60));
    console.log(`   Транспорт: ${results.vehicles.synced} синхр. / ${results.vehicles.errors} ошибок`);
    console.log(`   Водители:  ${results.drivers.synced} синхр. / ${results.drivers.errors} ошибок`);
    console.log(`   Рейсы:     ${results.trips.synced} синхр. / ${results.trips.errors} ошибок`);
    console.log('-'.repeat(60));
    console.log(`   ⏱️  Время выполнения: ${duration} сек`);
    console.log(`   📅 Завершено: ${new Date().toISOString()}`);
    console.log('='.repeat(60));
    console.log('');
    console.log('✅ СИНХРОНИЗАЦИЯ ЗАВЕРШЕНА УСПЕШНО');

  } catch (error) {
    console.error('');
    console.error('❌ КРИТИЧЕСКАЯ ОШИБКА:', error.message);
    console.error(error.stack);
    process.exit(1);

  } finally {
    await pool.end();
  }
}

// Запуск
main();
