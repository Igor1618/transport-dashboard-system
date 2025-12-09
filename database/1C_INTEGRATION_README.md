# 🔄 Интеграция 1C REST API → Supabase

> Автоматическая синхронизация данных из 1C в PostgreSQL через n8n

## 📋 Содержание

- [Обзор](#обзор)
- [Структура данных](#структура-данных)
- [Установка](#установка)
- [Настройка n8n](#настройка-n8n)
- [Аналитика](#аналитика)
- [Тестирование](#тестирование)
- [Мониторинг](#мониторинг)

---

## 🎯 Обзор

### Источник данных: 1C REST API

**Base URL:** `http://192.168.33.250/tk/hs/TransportAPI/api/v1/`
**Authentication:** Basic Auth (`TransportAPI:TransportAPI_SecretPass`)

### Эндпоинты

| Эндпоинт | Записей | Тип синхронизации | Описание |
|----------|---------|-------------------|----------|
| `/vehicles` | 166 | Полная перезагрузка | Справочник транспортных средств |
| `/drivers` | 65 | Полная перезагрузка | Справочник водителей |
| `/contracts` | ~ | Инкрементально (30 дней) | Договоры/контракты |
| `/driver-reports` | ≤ 1000 | Инкрементально (30 дней) | Отчеты водителей |

### Назначение: Supabase PostgreSQL

**URL:** `https://supabase.likhachev.io`
**База данных:** PostgreSQL (self-hosted)

---

## 📊 Структура данных

### Таблицы

```
vehicles (справочник)
├── id (PK, varchar)         # Natural key из 1C
├── license_plate            # Гос. номер
├── model                    # Модель машины
└── synced_at               # Время синхронизации

drivers (справочник)
├── id (PK, varchar)         # Natural key (ФИО) из 1C
├── full_name               # Полное имя
└── synced_at               # Время синхронизации

contracts (транзакционная)
├── uuid (PK)               # Суррогатный ключ
├── number, date            # Номер и дата договора (UNIQUE)
├── vehicle_id (FK)         # → vehicles.id
├── driver_id (FK)          # → drivers.id
├── contractor_id/name      # Контрагент
├── route                   # Маршрут
├── amount                  # Сумма договора
└── ...

driver_reports (транзакционная)
├── id (PK, varchar)        # Natural key из 1C
├── number, date_from/to    # Период отчета
├── driver_id (FK)          # → drivers.id
├── vehicle_id (FK)         # → vehicles.id
├── fuel_start/end/quantity # Топливо
├── mileage                 # Пробег
├── total_expenses          # Расходы
└── ...

expense_categories (связанная)
├── uuid (PK)
├── driver_report_id (FK)   # → driver_reports.id (CASCADE)
├── category                # Категория расхода
└── amount                  # Сумма
```

### ER-диаграмма

```
┌──────────┐
│ vehicles │──┐
└──────────┘  │
              ├── contracts
┌──────────┐  │
│ drivers  │──┤
└──────────┘  │
              └── driver_reports ──→ expense_categories
```

---

## 🛠️ Установка

### Шаг 1: Применить миграцию

```bash
# Подключиться к Supabase PostgreSQL
psql -h supabase.likhachev.io -U postgres -d postgres

# Применить миграцию
\i /path/to/migration_1c_integration.sql

# Создать аналитические views
\i /path/to/analytics_views.sql
```

**Или через Supabase Studio:**

1. Открыть SQL Editor в Supabase Dashboard
2. Скопировать содержимое `migration_1c_integration.sql`
3. Выполнить (Run)
4. Повторить для `analytics_views.sql`

### Шаг 2: Проверка таблиц

```sql
-- Проверить созданные таблицы
SELECT table_name, table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('vehicles', 'drivers', 'contracts', 'driver_reports', 'expense_categories');

-- Проверить views
SELECT table_name
FROM information_schema.views
WHERE table_schema = 'public'
  AND table_name LIKE 'v_%';
```

---

## ⚙️ Настройка n8n

### Шаг 1: Импорт workflow

1. Открыть n8n Dashboard
2. **Workflows** → **Import from File**
3. Выбрать файл `n8n_workflow_1c_sync.json`
4. Нажать **Import**

### Шаг 2: Настроить Credentials

#### 1C TransportAPI Basic Auth

```
Тип: HTTP Basic Auth
ID: 1c-transport-api
Username: TransportAPI
Password: TransportAPI_SecretPass
```

#### Supabase PostgreSQL

```
Тип: PostgreSQL
ID: supabase-postgres
Host: supabase.likhachev.io
Port: 5432
Database: postgres
User: postgres
Password: [ваш пароль]
SSL: Enable
```

### Шаг 3: Настроить расписание

В узле **"Schedule: Daily 2 AM"**:

```
Cron Expression: 0 2 * * *
```

- Запускается ежедневно в 2:00 ночи
- Можно изменить на другое время

### Шаг 4: Тестовый запуск

1. Нажать **Execute Workflow** (Manual)
2. Проверить результаты в каждом узле
3. Проверить данные в Supabase

---

## 📈 Аналитика

### Доступные Views

| View | Описание | Основные поля |
|------|----------|---------------|
| `v_driver_expenses` | Расходы по водителям | total_expenses, fuel_cost, mileage |
| `v_vehicle_fuel_analytics` | Топливо по машинам | fuel_consumption_per_100km, fuel_cost |
| `v_route_analytics` | Суммы по маршрутам | total_amount, contracts_count |
| `v_expense_categories_summary` | Категории расходов | total_amount, occurrences |
| `v_driver_performance` | Производительность водителей | revenue_per_km, efficiency |
| `v_vehicle_utilization` | Использование машин | profit_margin, active_days |
| `v_monthly_statistics` | Ежемесячная статистика | contracts, fuel, expenses |
| `v_top_performers` | Топ-10 показателей | top drivers/vehicles/routes |

### Примеры запросов

#### Топ-5 водителей по расходам

```sql
SELECT
    driver_name,
    total_expenses,
    total_fuel_cost,
    total_mileage_km
FROM v_driver_expenses
LIMIT 5;
```

#### Расход топлива по машинам

```sql
SELECT
    license_plate,
    model,
    avg_fuel_consumption_per_100km,
    total_fuel_liters,
    fuel_cost_per_km
FROM v_vehicle_fuel_analytics
WHERE total_mileage_km > 0
ORDER BY avg_fuel_consumption_per_100km DESC;
```

#### Прибыльность маршрутов

```sql
SELECT
    route,
    total_amount,
    total_contracts,
    avg_amount,
    top_driver
FROM v_route_analytics
ORDER BY total_amount DESC
LIMIT 10;
```

#### Ежемесячная динамика

```sql
SELECT
    month,
    contracts_count,
    contracts_total_amount,
    total_fuel_cost,
    total_mileage,
    active_drivers,
    active_vehicles
FROM v_monthly_statistics
ORDER BY period DESC
LIMIT 12;
```

---

## 🧪 Тестирование

### Тест 1: Проверка подключения к 1C API

```bash
# Vehicles
curl -u "TransportAPI:TransportAPI_SecretPass" \
  "http://192.168.33.250/tk/hs/TransportAPI/api/v1/vehicles"

# Drivers
curl -u "TransportAPI:TransportAPI_SecretPass" \
  "http://192.168.33.250/tk/hs/TransportAPI/api/v1/drivers"

# Contracts (last 7 days)
curl -u "TransportAPI:TransportAPI_SecretPass" \
  "http://192.168.33.250/tk/hs/TransportAPI/api/v1/contracts?date_from=2025-12-02&date_to=2025-12-09"

# Driver Reports
curl -u "TransportAPI:TransportAPI_SecretPass" \
  "http://192.168.33.250/tk/hs/TransportAPI/api/v1/driver-reports?date_from=2025-12-02&date_to=2025-12-09"
```

### Тест 2: Проверка данных в Supabase

```sql
-- Количество записей в таблицах
SELECT 'vehicles' AS table_name, COUNT(*) AS count FROM vehicles
UNION ALL
SELECT 'drivers', COUNT(*) FROM drivers
UNION ALL
SELECT 'contracts', COUNT(*) FROM contracts
UNION ALL
SELECT 'driver_reports', COUNT(*) FROM driver_reports
UNION ALL
SELECT 'expense_categories', COUNT(*) FROM expense_categories;

-- Последняя синхронизация
SELECT
    'vehicles' AS table_name,
    MAX(synced_at) AS last_sync
FROM vehicles
UNION ALL
SELECT 'drivers', MAX(synced_at) FROM drivers
UNION ALL
SELECT 'contracts', MAX(synced_at) FROM contracts
UNION ALL
SELECT 'driver_reports', MAX(synced_at) FROM driver_reports;
```

### Тест 3: Проверка целостности данных

```sql
-- Проверить Foreign Keys
SELECT
    COUNT(*) AS contracts_with_invalid_vehicle
FROM contracts
WHERE vehicle_id IS NOT NULL
  AND vehicle_id NOT IN (SELECT id FROM vehicles);

SELECT
    COUNT(*) AS contracts_with_invalid_driver
FROM contracts
WHERE driver_id IS NOT NULL
  AND driver_id NOT IN (SELECT id FROM drivers);

-- Проверить дубликаты
SELECT number, date, COUNT(*)
FROM contracts
GROUP BY number, date
HAVING COUNT(*) > 1;
```

---

## 📊 Мониторинг

### Метрики для отслеживания

1. **Успешность синхронизации**
   - Частота ошибок
   - Время выполнения workflow
   - Количество синхронизированных записей

2. **Качество данных**
   - Отсутствующие Foreign Keys
   - Дубликаты
   - NULL значения в критичных полях

3. **Производительность**
   - Время выполнения запросов к views
   - Размер таблиц
   - Индексы

### Запросы для мониторинга

```sql
-- Статус последней синхронизации
CREATE OR REPLACE VIEW v_sync_status AS
SELECT
    'vehicles' AS entity,
    COUNT(*) AS records,
    MAX(synced_at) AS last_sync,
    NOW() - MAX(synced_at) AS time_since_sync
FROM vehicles
UNION ALL
SELECT 'drivers', COUNT(*), MAX(synced_at), NOW() - MAX(synced_at)
FROM drivers
UNION ALL
SELECT 'contracts', COUNT(*), MAX(synced_at), NOW() - MAX(synced_at)
FROM contracts
UNION ALL
SELECT 'driver_reports', COUNT(*), MAX(synced_at), NOW() - MAX(synced_at)
FROM driver_reports;

-- Использовать
SELECT * FROM v_sync_status;
```

### Alerts

Настроить уведомления в n8n для:

- ❌ Ошибки синхронизации
- ⚠️ Отсутствие синхронизации более 25 часов
- 📉 Значительное снижение количества записей

---

## 🔧 Troubleshooting

### Проблема: Синхронизация не запускается

**Решение:**
```bash
# Проверить статус n8n
pm2 status n8n

# Проверить логи
pm2 logs n8n

# Перезапустить
pm2 restart n8n
```

### Проблема: Ошибка подключения к 1C API

**Решение:**
```bash
# Проверить доступность
ping 192.168.33.250

# Проверить порт
telnet 192.168.33.250 80

# Проверить credentials
curl -v -u "TransportAPI:TransportAPI_SecretPass" \
  "http://192.168.33.250/tk/hs/TransportAPI/api/v1/vehicles"
```

### Проблема: Foreign Key Violation

**Решение:**
```sql
-- Найти проблемные записи
SELECT c.*
FROM contracts c
LEFT JOIN vehicles v ON c.vehicle_id = v.id
WHERE c.vehicle_id IS NOT NULL AND v.id IS NULL;

-- Временно отключить FK (не рекомендуется)
-- ALTER TABLE contracts DROP CONSTRAINT contracts_vehicle_id_fkey;

-- Лучше: синхронизировать справочники первыми
```

---

## 📝 Changelog

### v1.0.0 (2025-12-09)

- ✅ Создана схема БД (5 таблиц)
- ✅ Создано 8 аналитических views
- ✅ Настроен n8n workflow
- ✅ Настроена ежедневная синхронизация
- ✅ Добавлена документация

---

## 🔗 Ссылки

- [1C API Documentation](#) (если есть)
- [Supabase Dashboard](https://supabase.likhachev.io)
- [n8n Documentation](https://docs.n8n.io)
- [PostgreSQL Docs](https://www.postgresql.org/docs/)

---

## 👥 Команда

**Автор:** Igor1618
**Дата:** 2025-12-09
**Проект:** TL196 Transport Dashboard System

---

## 📄 Лицензия

MIT License - см. основной README проекта
