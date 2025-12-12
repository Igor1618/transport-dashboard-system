#!/usr/bin/env node
/**
 * ДИАГНОСТИЧЕСКИЙ СКРИПТ
 * Запустите его на сервере: node diagnose-db-connection.js
 * Он покажет истинную причину проблемы с портом
 */

const path = require('path');
const fs = require('fs');

console.log('='.repeat(70));
console.log('🔍 ДИАГНОСТИКА ПОДКЛЮЧЕНИЯ К POSTGRESQL');
console.log('='.repeat(70));
console.log('');

// 1. Информация о текущем процессе
console.log('📋 1. ИНФОРМАЦИЯ О ПРОЦЕССЕ');
console.log('-'.repeat(50));
console.log('   PID:', process.pid);
console.log('   Node версия:', process.version);
console.log('   Платформа:', process.platform);
console.log('   Текущая директория:', process.cwd());
console.log('   Путь к скрипту:', __filename);
console.log('   Директория скрипта:', __dirname);
console.log('');

// 2. Проверяем переменные окружения связанные с БД
console.log('📋 2. ПЕРЕМЕННЫЕ ОКРУЖЕНИЯ (DB-related)');
console.log('-'.repeat(50));
const dbEnvVars = [
  'DB_PORT', 'DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME', 'DB_DATABASE',
  'PGPORT', 'PGHOST', 'PGUSER', 'PGPASSWORD', 'PGDATABASE',
  'DATABASE_URL', 'POSTGRES_PORT'
];
dbEnvVars.forEach(key => {
  const value = process.env[key];
  if (value !== undefined) {
    // Маскируем пароли
    const masked = key.toLowerCase().includes('password')
      ? '***HIDDEN***'
      : value;
    console.log(`   ✅ ${key} = ${masked}`);
  }
});
console.log('');

// 3. Проверяем наличие .env файлов
console.log('📋 3. ПОИСК .ENV ФАЙЛОВ');
console.log('-'.repeat(50));
const possibleEnvPaths = [
  path.join(__dirname, '.env'),
  path.join(__dirname, '../.env'),
  path.join(__dirname, '../../.env'),
  path.join(process.cwd(), '.env'),
  '/var/www/transport-dashboard-system/.env',
  '/var/www/transport-dashboard-system/backend/.env',
  '/var/www/transport-dashboard-system/backend/scripts/.env',
];
possibleEnvPaths.forEach(envPath => {
  const exists = fs.existsSync(envPath);
  if (exists) {
    console.log(`   ✅ НАЙДЕН: ${envPath}`);
    try {
      const content = fs.readFileSync(envPath, 'utf8');
      const portMatch = content.match(/.*PORT.*=.*/gi);
      if (portMatch) {
        portMatch.forEach(line => {
          console.log(`      └─ ${line.trim()}`);
        });
      }
    } catch (e) {
      console.log(`      └─ Ошибка чтения: ${e.message}`);
    }
  } else {
    console.log(`   ❌ не найден: ${envPath}`);
  }
});
console.log('');

// 4. Проверяем наличие скомпилированных версий
console.log('📋 4. ПОИСК СКОМПИЛИРОВАННЫХ/ДУБЛИРОВАННЫХ ФАЙЛОВ');
console.log('-'.repeat(50));
const searchDirs = [
  __dirname,
  path.join(__dirname, '..'),
  path.join(__dirname, '../dist'),
  path.join(__dirname, '../build'),
  path.join(__dirname, '../.next'),
  path.join(__dirname, '../node_modules/.cache'),
  '/var/www/transport-dashboard-system',
  '/var/www/transport-dashboard-system/backend',
  '/var/www/transport-dashboard-system/backend/dist',
  '/var/www/transport-dashboard-system/backend/build',
];

function findSyncFiles(dir, depth = 0) {
  if (depth > 3 || !fs.existsSync(dir)) return [];
  const results = [];
  try {
    const items = fs.readdirSync(dir);
    for (const item of items) {
      if (item === 'node_modules' && depth > 0) continue;
      if (item === '.git') continue;
      const fullPath = path.join(dir, item);
      try {
        const stat = fs.statSync(fullPath);
        if (stat.isFile() && item.includes('sync') && item.endsWith('.js')) {
          results.push(fullPath);
        } else if (stat.isDirectory() && depth < 3) {
          results.push(...findSyncFiles(fullPath, depth + 1));
        }
      } catch (e) {}
    }
  } catch (e) {}
  return results;
}

const syncFiles = new Set();
searchDirs.forEach(dir => {
  findSyncFiles(dir).forEach(f => syncFiles.add(f));
});

if (syncFiles.size > 0) {
  console.log('   Найдены файлы с "sync" в названии:');
  syncFiles.forEach(file => {
    const stat = fs.statSync(file);
    console.log(`   📄 ${file}`);
    console.log(`      └─ Размер: ${stat.size} bytes, Изменён: ${stat.mtime}`);
    // Читаем первые строки и ищем port
    try {
      const content = fs.readFileSync(file, 'utf8');
      const portMatches = content.match(/port.*?(\d{4})/gi);
      if (portMatches) {
        console.log(`      └─ Порты в файле: ${[...new Set(portMatches)].join(', ')}`);
      }
    } catch (e) {}
  });
} else {
  console.log('   Файлы с sync* не найдены');
}
console.log('');

// 5. Проверяем PM2
console.log('📋 5. ПРОВЕРКА PM2');
console.log('-'.repeat(50));
const { execSync } = require('child_process');
try {
  const pm2List = execSync('pm2 list 2>/dev/null || echo "PM2 не установлен"', { encoding: 'utf8' });
  console.log(pm2List);
} catch (e) {
  console.log('   PM2 не доступен или не установлен');
}
console.log('');

// 6. Проверяем что слушает на портах 5432 и 5433
console.log('📋 6. КАКИЕ СЕРВИСЫ СЛУШАЮТ ПОРТЫ');
console.log('-'.repeat(50));
try {
  const netstat = execSync('netstat -tlnp 2>/dev/null | grep -E "543[23]" || ss -tlnp 2>/dev/null | grep -E "543[23]" || echo "Не удалось проверить порты"', { encoding: 'utf8' });
  console.log(netstat || '   Ничего не найдено на портах 5432/5433');
} catch (e) {
  console.log('   Ошибка проверки портов:', e.message);
}
console.log('');

// 7. ГЛАВНЫЙ ТЕСТ - создаём Pool и смотрим реальный конфиг
console.log('📋 7. ТЕСТ ПОДКЛЮЧЕНИЯ К POSTGRESQL');
console.log('-'.repeat(50));

// Жёсткий конфиг - игнорируем все переменные окружения
const HARDCODED_CONFIG = {
  host: 'localhost',
  port: 5433,  // ВАЖНО: Именно 5433!
  database: 'postgres',
  user: 'postgres',
  password: '5+NMkUPabjFbh5vGZtWx5ea0QAX2NSR3G1k0sfAedms='
};

console.log('   Конфиг который МЫ передаём:');
console.log('   ', JSON.stringify({ ...HARDCODED_CONFIG, password: '***' }, null, 2).replace(/\n/g, '\n   '));

try {
  const { Pool } = require('pg');

  // Создаём pool
  const pool = new Pool(HARDCODED_CONFIG);

  // Проверяем реальные настройки pool
  console.log('');
  console.log('   Реальные настройки Pool после создания:');
  console.log(`   - pool.options.host: ${pool.options.host}`);
  console.log(`   - pool.options.port: ${pool.options.port}`);
  console.log(`   - pool.options.database: ${pool.options.database}`);
  console.log(`   - pool.options.user: ${pool.options.user}`);

  // Пытаемся подключиться
  console.log('');
  console.log('   Попытка подключения...');

  pool.query('SELECT version(), current_setting(\'port\') as pg_port')
    .then(result => {
      console.log('   ✅ УСПЕХ! Подключились к PostgreSQL');
      console.log(`   PostgreSQL порт (из БД): ${result.rows[0].pg_port}`);
      console.log(`   Версия: ${result.rows[0].version.substring(0, 60)}...`);
      pool.end();
      process.exit(0);
    })
    .catch(err => {
      console.log('   ❌ ОШИБКА ПОДКЛЮЧЕНИЯ:');
      console.log(`   ${err.message}`);

      // Проверяем стек ошибки на предмет порта
      if (err.message.includes('5432')) {
        console.log('');
        console.log('   ⚠️  ВАЖНО: Ошибка упоминает порт 5432, хотя мы указали 5433!');
        console.log('   Возможные причины:');
        console.log('   1. Переменная окружения PGPORT=5432 переопределяет конфиг');
        console.log('   2. Библиотека pg использует defaults из ~/.pgpass или pg_hba.conf');
        console.log('   3. Docker сеть перенаправляет порты');
      }

      // Проверяем PGPORT
      if (process.env.PGPORT) {
        console.log(`   ⚠️  Найдена переменная PGPORT=${process.env.PGPORT}`);
        console.log('   Она ПЕРЕОПРЕДЕЛЯЕТ port в конфиге Pool!');
      }

      pool.end();
      process.exit(1);
    });

} catch (e) {
  console.log('   ❌ Ошибка при создании Pool:', e.message);
  console.log('   Убедитесь что модуль pg установлен: npm install pg');
  process.exit(1);
}
