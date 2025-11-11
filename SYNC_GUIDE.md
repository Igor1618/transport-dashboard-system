# 📚 Руководство по синхронизации данных 1С → Supabase

## 🎯 Что делает скрипт?

Скрипт автоматически:
1. Забирает данные из API 1С
2. Обрабатывает и группирует их
3. Загружает в Supabase для отображения в дашборде

---

## 🚀 Быстрый старт

### Вариант 1: PHP (рекомендуется)

```bash
# Простой запуск (текущий месяц)
php sync-1c-to-supabase.php

# С указанием периода
php sync-1c-to-supabase.php 2024-11-01 2024-11-30
```

### Вариант 2: Node.js

```bash
# Установить зависимости (один раз)
npm install @supabase/supabase-js node-fetch

# Простой запуск (текущий месяц)
node sync-1c-to-supabase.js

# С указанием периода
node sync-1c-to-supabase.js --date-from=2024-11-01 --date-to=2024-11-30
```

---

## ⚙️ Что синхронизируется?

### 1. Транспортные средства (`vehicles`)

**API 1С:** `GET /api/v1/vehicles`

**Таблица Supabase:** `vehicles`

| Поле | Тип | Описание |
|------|-----|----------|
| id | uuid/text | Уникальный идентификатор |
| number | text | Гос. номер (например: "А123БВ77") |
| model | text | Модель машины (например: "MAN TGX") |

### 2. Водители (`drivers`)

**API 1С:** `GET /api/v1/drivers`

**Таблица Supabase:** `drivers`

| Поле | Тип | Описание |
|------|-----|----------|
| id | uuid/text | Уникальный идентификатор |
| full_name | text | ФИО водителя |

### 3. Договор-заявки (`contracts`)

**API 1С:** `GET /api/v1/contracts?date_from=YYYY-MM-DD&date_to=YYYY-MM-DD`

**Таблица Supabase:** `vehicle_monthly_data`

Данные группируются по машинам и месяцам:

| Поле | Тип | Описание |
|------|-----|----------|
| vehicle_id | uuid/text | ID машины (FK → vehicles.id) |
| year | integer | Год (например: 2025) |
| month | integer | Месяц (1-12, где 1 = Январь) |
| income | decimal | Доход в рублях |
| expenses | decimal | Расходы в рублях |
| trips | integer | Количество рейсов |
| efficiency | integer | Эффективность в % (0-100) |

**Формула эффективности:**
```
efficiency = ((income - expenses) / income) * 100
```

### 4. Отчеты водителей (`driver-reports`)

**API 1С:** `GET /api/v1/driver-reports?date_from=YYYY-MM-DD&date_to=YYYY-MM-DD`

*В разработке - пока только загружается, обработка зависит от структуры данных*

---

## 🔧 Настройка под ваш API

### Шаг 1: Проверьте структуру данных из 1С

Сначала посмотрите, что возвращает ваш API:

```bash
# Транспортные средства
curl -H "Authorization: Bearer transport_api_2024_secret_key" \
  http://192.168.33.250/tk/hs/TransportAPI/api/v1/vehicles

# Пример ответа (ВАША структура может отличаться!):
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "regNumber": "А123БВ77",
    "vehicleModel": "MAN TGX",
    "brand": "MAN"
  }
]
```

### Шаг 2: Адаптируйте маппинг полей

Откройте файл `sync-1c-to-supabase.php` (или `.js`) и найдите секции с комментарием:
```php
// Предполагаемая структура - АДАПТИРУЙ под реальную!
```

Измените маппинг полей в соответствии с реальной структурой:

**Пример ДО:**
```php
'number' => $v['number'] ?? $v['regNumber'] ?? '',
```

**Пример ПОСЛЕ** (если в вашем API поле называется `registrationNumber`):
```php
'number' => $v['registrationNumber'] ?? '',
```

### Шаг 3: Создайте таблицы в Supabase

Если таблиц еще нет, создайте их в Supabase SQL Editor:

```sql
-- Таблица транспортных средств
CREATE TABLE vehicles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    number TEXT NOT NULL,
    model TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Таблица водителей
CREATE TABLE drivers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Таблица месячных данных по машинам
CREATE TABLE vehicle_monthly_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id UUID REFERENCES vehicles(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
    income DECIMAL(15, 2) DEFAULT 0,
    expenses DECIMAL(15, 2) DEFAULT 0,
    trips INTEGER DEFAULT 0,
    efficiency INTEGER DEFAULT 0 CHECK (efficiency >= 0 AND efficiency <= 100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(vehicle_id, year, month)
);

-- Индексы для быстрого поиска
CREATE INDEX idx_vehicle_monthly_year_month ON vehicle_monthly_data(year, month);
CREATE INDEX idx_vehicle_monthly_vehicle ON vehicle_monthly_data(vehicle_id);
```

---

## 🔄 Автоматическая синхронизация

### Настройка cron (Linux/Mac)

Добавьте задачу в crontab для автоматической синхронизации:

```bash
# Открыть crontab
crontab -e

# Синхронизация каждый день в 3:00 ночи
0 3 * * * cd /path/to/project && php sync-1c-to-supabase.php >> /var/log/sync-1c.log 2>&1

# Синхронизация каждый час
0 * * * * cd /path/to/project && php sync-1c-to-supabase.php >> /var/log/sync-1c.log 2>&1
```

### Настройка Task Scheduler (Windows)

1. Откройте "Планировщик заданий"
2. Создайте новую задачу
3. Укажите расписание (например, каждый день в 3:00)
4. Добавьте действие: `php.exe C:\path\to\sync-1c-to-supabase.php`

---

## 📊 Примеры использования

### Синхронизация за один месяц

```bash
# Ноябрь 2024
php sync-1c-to-supabase.php 2024-11-01 2024-11-30
```

### Синхронизация за несколько месяцев

```bash
# Загрузить данные за 3 месяца
php sync-1c-to-supabase.php 2024-09-01 2024-09-30
php sync-1c-to-supabase.php 2024-10-01 2024-10-31
php sync-1c-to-supabase.php 2024-11-01 2024-11-30
```

Или создайте bash скрипт:

```bash
#!/bin/bash
# sync-multiple-months.sh

for month in {9..11}; do
    start_date="2024-$(printf "%02d" $month)-01"
    end_date=$(date -d "$start_date +1 month -1 day" +%Y-%m-%d)

    echo "Синхронизация: $start_date - $end_date"
    php sync-1c-to-supabase.php "$start_date" "$end_date"

    sleep 2  # Пауза между запросами
done
```

---

## 🐛 Решение проблем

### Ошибка: "Access denied"

**Проблема:** API 1С недоступен

**Решение:**
1. Проверьте, что вы запускаете скрипт из локальной сети (192.168.x.x)
2. Проверьте правильность токена авторизации
3. Попробуйте выполнить запрос вручную:
   ```bash
   curl -H "Authorization: Bearer transport_api_2024_secret_key" \
     http://192.168.33.250/tk/hs/TransportAPI/api/v1/vehicles
   ```

### Ошибка: "Supabase API ошибка: 400"

**Проблема:** Неверная структура данных

**Решение:**
1. Проверьте соответствие полей в маппинге
2. Убедитесь, что обязательные поля заполнены
3. Проверьте типы данных (например, UUID должен быть валидным)

### Ошибка: "No data to sync"

**Проблема:** API вернул пустой массив

**Решение:**
1. Проверьте период запроса (date_from/date_to)
2. Убедитесь, что в 1С есть данные за указанный период
3. Проверьте права доступа API ключа

### Данные не отображаются в дашборде

**Проблема:** Данные загружены, но не видны

**Решение:**
1. Проверьте формат месяца в таблице (должен быть 1-12, а не 0-11)
2. Откройте браузер DevTools → Console и посмотрите ошибки
3. Убедитесь, что в селекторе месяца выбран правильный период
4. Проверьте, что `vehicle_id` в `vehicle_monthly_data` соответствует ID в `vehicles`

---

## 📝 Логирование

### Сохранение логов в файл

```bash
# PHP
php sync-1c-to-supabase.php 2>&1 | tee sync-log-$(date +%Y%m%d).txt

# Node.js
node sync-1c-to-supabase.js 2>&1 | tee sync-log-$(date +%Y%m%d).txt
```

### Просмотр последних логов

```bash
tail -f /var/log/sync-1c.log
```

---

## 🔐 Безопасность

### Важно!

1. **Не коммитьте токены в git!** Используйте `.env` файлы
2. Храните API ключи в переменных окружения
3. Ограничьте доступ к скрипту только нужным пользователям
4. Регулярно меняйте токены доступа

### Использование .env файла

Создайте файл `.env`:

```bash
API_1C_TOKEN=transport_api_2024_secret_key
SUPABASE_ANON_KEY=eyJhbGci...
```

В скрипте замените константы на:

```php
// PHP
$apiToken = getenv('API_1C_TOKEN');

// Node.js
require('dotenv').config();
const apiToken = process.env.API_1C_TOKEN;
```

---

## 📞 Поддержка

Если у вас возникли проблемы:

1. Проверьте секцию "Решение проблем" выше
2. Посмотрите логи ошибок
3. Убедитесь, что структура данных из API соответствует ожидаемой
4. Создайте issue в репозитории проекта

---

## 🎉 Готово!

После настройки и первого запуска:
1. Откройте дашборд: http://localhost:8000 (или https://transport-dashboard-system.manus.im)
2. Выберите месяц в селекторе
3. Проверьте, что данные отображаются корректно

**Удачной синхронизации! 🚀**
