# Transport Dashboard Backend

Скрипты для синхронизации данных между 1C API и PostgreSQL.

## Структура

```
backend/
├── .env                    # Конфигурация (credentials)
├── package.json            # Зависимости
├── README.md               # Документация
└── scripts/
    ├── load-historical-data.js   # Историческая выгрузка (2021+)
    ├── sync-1c-data.js           # Ежедневная синхронизация
    └── diagnose-db-connection.js # Диагностика БД
```

## Установка

```bash
cd /var/www/transport-dashboard-system/backend
npm install
```

## Команды

### Историческая выгрузка (первый запуск)

Загружает все данные с 2021-01-01:

```bash
# Полная загрузка (contracts + driver_reports)
node scripts/load-historical-data.js

# Только contracts
node scripts/load-historical-data.js contracts

# Только driver_reports
node scripts/load-historical-data.js reports
```

**Особенности:**
- Contracts: загружаются помесячно
- Driver Reports: загружаются понедельно (ограничение API)
- Checkpoint: прогресс сохраняется в `.checkpoint.json`
- При прерывании можно продолжить с того же места

### Ежедневная синхронизация

Синхронизирует данные за последние 30 дней:

```bash
node scripts/sync-1c-data.js
```

### Диагностика

Проверка подключения к БД и состояния таблиц:

```bash
node scripts/diagnose-db-connection.js
```

## Конфигурация (.env)

```env
# PostgreSQL (Supabase Docker)
PG_HOST=localhost
PG_PORT=5433
PG_DATABASE=postgres
PG_USER=postgres
PG_PASSWORD=your_password

# 1C API
API_BASE_URL=http://192.168.33.250/tk/hs/TransportAPI/api/v1
API_USERNAME=TransportAPI
API_PASSWORD=TransportAPI_SecretPass

# Sync settings
SYNC_START_DATE=2021-01-01
REQUEST_DELAY_MS=1000
MAX_RETRIES=3
```

## Создание таблиц

SQL скрипт находится в `/n8n-workflows/setup-tables.sql`:

```bash
PGPASSWORD='password' psql -h localhost -p 5433 -U postgres -d postgres -f ../n8n-workflows/setup-tables.sql
```

## API Endpoints

| Endpoint | Описание |
|----------|----------|
| GET /vehicles | Все ТС |
| GET /drivers | Все водители |
| GET /contracts?date_from=&date_to= | Договоры за период |
| GET /driver-reports?date_from=&date_to= | Отчёты водителей |

## Ограничения API

- Максимум 1000 записей за запрос
- Нужна пауза между запросами (1 сек)
- Driver reports: при большом периоде возвращает ошибку

## Cron (альтернатива n8n)

```bash
# Ежедневно в 2:00
0 2 * * * cd /var/www/transport-dashboard-system/backend && /usr/bin/node scripts/sync-1c-data.js >> /var/log/transport-sync.log 2>&1
```
