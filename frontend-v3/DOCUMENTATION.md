# TL196 — Транспортная система

> Система управления транспортной компанией: отчёты водителей, рейсы WB/РФ, топливо, зарплаты

**URL:** https://tl196.ru  
**GitHub:** https://github.com/Igor1618/transport-dashboard-system  
**Организация:** ООО "ТРАНСПОРТНАЯ ЛОГИСТИКА"

---

## 📋 Оглавление

1. [Архитектура](#архитектура)
2. [Установка и запуск](#установка-и-запуск)
3. [База данных](#база-данных)
4. [API Endpoints](#api-endpoints)
5. [Модули системы](#модули-системы)
6. [Внешние интеграции](#внешние-интеграции)
7. [Деплой](#деплой)
8. [Troubleshooting](#troubleshooting)

---

## 🏗 Архитектура

```
┌─────────────────────────────────────────────────────────────┐
│                      NGINX (reverse proxy)                   │
│                         tl196.ru:443                         │
└──────────────┬────────────────────────────┬─────────────────┘
               │                            │
               ▼                            ▼
┌──────────────────────────┐  ┌──────────────────────────────┐
│   Frontend (Next.js 15)  │  │    Backend (Node/Express)    │
│        Port 3000         │  │         Port 3001            │
│   PM2: tl196-frontend    │  │    PM2: tl196-backend        │
└──────────────────────────┘  └──────────────┬───────────────┘
                                             │
                              ┌──────────────┴───────────────┐
                              │                              │
                              ▼                              ▼
                 ┌────────────────────┐        ┌─────────────────────┐
                 │  PostgreSQL 5433   │        │   External APIs     │
                 │  (Supabase local)  │        │  - Locarus (GPS)    │
                 └────────────────────┘        │  - 1С (contracts)   │
                                               └─────────────────────┘
```

| Компонент | Технология | Порт | PM2 | Путь |
|-----------|------------|------|-----|------|
| Frontend | Next.js 15 + React 19 | 3000 | tl196-frontend | `/var/www/transport-dashboard-system/frontend-v3` |
| Backend | Node.js + Express | 3001 | tl196-backend | `/var/www/tl196/backend` |
| Database | PostgreSQL (Supabase) | 5433 | — | localhost |
| Reverse Proxy | NGINX | 443 | — | `/etc/nginx/sites-enabled/tl196` |

---

## 🚀 Установка и запуск

### Требования
- Node.js 20+
- PostgreSQL 15+ (или Supabase)
- PM2
- NGINX

### Backend

```bash
cd /var/www/tl196/backend
cp .env.example .env  # настроить переменные
npm install
pm2 start server.js --name tl196-backend
```

**Переменные окружения (.env):**
```env
DB_HOST=localhost
DB_PORT=5433
DB_NAME=postgres
DB_USER=postgres
DB_PASSWORD=your_password

# Locarus API (телематика)
LOCARUS_LOGIN=your_login
LOCARUS_PASSWORD=your_password

# JWT
JWT_SECRET=your_jwt_secret
```

### Frontend

```bash
cd /var/www/transport-dashboard-system/frontend-v3
cp .env.example .env.local
npm install
npm run build
pm2 start npm --name tl196-frontend -- start
```

**Переменные окружения (.env.local):**
```env
NEXT_PUBLIC_API_URL=https://tl196.ru/api
```

---

## 🗄 База данных

### Подключение

```bash
psql -h localhost -p 5433 -U postgres -d postgres
```

### Схема таблиц

#### `vehicles` — Машины
| Колонка | Тип | Описание |
|---------|-----|----------|
| id | serial | PK |
| number | varchar(20) | Гос. номер (уникальный) |
| brand | varchar(50) | Марка |
| model | varchar(50) | Модель |
| vin | varchar(50) | VIN |
| year | int | Год выпуска |
| vehicle_type | varchar(50) | Тип (Камаз 4308, Scania и т.д.) |
| fuel_card_numbers | text[] | Привязанные топливные карты |
| osago_date | date | Срок ОСАГО |
| to_date | date | Срок ТО |
| skzi_date | date | Срок СКЗИ |

#### `drivers` — Водители
| Колонка | Тип | Описание |
|---------|-----|----------|
| id | serial | PK |
| name | varchar(100) | ФИО |
| full_name | varchar(255) | Полное ФИО (для сопоставления) |
| phone | varchar(20) | Телефон |
| license_number | varchar(50) | Номер ВУ |
| license_expiry | date | Срок ВУ |
| med_cert_expiry | date | Срок мед. справки |

#### `driver_reports` — Отчёты водителей
| Колонка | Тип | Описание |
|---------|-----|----------|
| id | serial | PK |
| driver_name | varchar(100) | ФИО водителя |
| vehicle_number | varchar(20) | Номер машины |
| date_from | date | Начало периода |
| date_to | date | Конец периода |
| mileage | int | Пробег (км) |
| fuel_quantity | numeric | Топливо (л) |
| fuel_amount | numeric | Топливо (₽) |
| fuel_start | numeric | Остаток в баке (начало) |
| fuel_end | numeric | Остаток в баке (конец) |
| total_earnings | numeric | Общий заработок |
| total_deductions | numeric | Удержания |
| total_to_pay | numeric | К выплате |
| status | varchar(20) | Статус (draft/approved/paid) |
| vehicle_type | varchar(50) | Тип машины |
| season | varchar(20) | Сезон (Зима/Лето/Межсезон) |
| rate_per_km | numeric | Ставка за км |
| rf_periods | jsonb | Периоды РФ [{from, to, mileage}] |
| expense_categories | jsonb | Все данные отчёта (см. ниже) |
| created_by | varchar(100) | Автор |
| created_at | timestamp | Дата создания |

**Структура `expense_categories` (jsonb):**
```json
{
  "rf_mileage": 10208,
  "rf_rate": 6,
  "rf_days": 16,
  "rf_daily_rate": 800,
  "rf_fuel_start": 150,
  "rf_fuel_end": 120,
  "fuel_rf": { "liters": 500, "amount": 25000 },
  "wb_totals": { "driver_rate": 15000, "trips": 5 },
  "bonus_enabled": true,
  "bonus_rate": 1.5,
  "extra_works": [{ "name": "Погрузка", "count": 2, "rate": 500 }],
  "expenses": [{ "name": "Ремонт", "amount": 3000 }],
  "payments": [{ "date": "2026-01-15", "amount": 5000, "type": "advance" }],
  "comment": "Примечание"
}
```

#### `trips` — Рейсы WB
| Колонка | Тип | Описание |
|---------|-----|----------|
| id | serial | PK |
| loading_date | date | Дата погрузки |
| loading_time | time | Время погрузки |
| unloading_date | date | Дата разгрузки |
| unloading_time | time | Время разгрузки |
| route_name | varchar(255) | Маршрут |
| vehicle_number | varchar(20) | Номер машины |
| driver_name | varchar(100) | ФИО водителя |
| driver_rate | numeric | Ставка водителю |
| client_rate | numeric | Ставка клиента |
| source | varchar(50) | Источник (wb_import) |

#### `contracts` — Заявки РФ Транспорт
| Колонка | Тип | Описание |
|---------|-----|----------|
| id | serial | PK |
| number | varchar(50) | Номер заявки |
| date | date | Дата |
| route | varchar(255) | Маршрут |
| vehicle_number | varchar(20) | Номер машины |
| driver_name | varchar(100) | ФИО водителя |
| client_rate | numeric | Ставка клиента |
| driver_rate | numeric | Ставка водителю |
| status | varchar(20) | Статус |

#### `fuel_transactions` — Топливо
| Колонка | Тип | Описание |
|---------|-----|----------|
| id | serial | PK |
| date | date | Дата заправки |
| source | varchar(50) | Компания (Татнефть, E100, Газпромнефть) |
| card_number | varchar(50) | Номер карты |
| vehicle_number | varchar(20) | Номер машины |
| quantity | numeric | Литры |
| amount | numeric | Сумма (₽) |
| fuel_type | varchar(20) | Тип топлива |

#### `fuel_cards` — Привязка карт
| Колонка | Тип | Описание |
|---------|-----|----------|
| id | serial | PK |
| card_number | varchar(50) | Номер карты |
| source | varchar(50) | Компания |
| vehicle_number | varchar(20) | Номер машины |

#### `salary_registers` — Зарплатные ведомости
| Колонка | Тип | Описание |
|---------|-----|----------|
| id | serial | PK |
| register_number | varchar(50) | Номер реестра |
| register_date | date | Дата реестра |
| organization | varchar(255) | Организация |
| inn | varchar(20) | ИНН |
| total_amount | numeric | Сумма итого |
| employees_count | int | Кол-во сотрудников |
| file_name | varchar(255) | Имя файла |

#### `salary_payments` — Выплаты
| Колонка | Тип | Описание |
|---------|-----|----------|
| id | serial | PK |
| register_id | int | FK → salary_registers |
| full_name | varchar(255) | ФИО сотрудника |
| bank_account | varchar(50) | Лицевой счёт |
| amount | numeric | Сумма |
| driver_id | varchar(100) | ID водителя (для связи) |

#### `fuel_rate_tariffs` — Тарифы топлива
| Колонка | Тип | Описание |
|---------|-----|----------|
| id | serial | PK |
| vehicle_type | varchar(50) | Тип машины |
| season | varchar(20) | Сезон |
| fuel_consumption | numeric | Расход (л/100км) |
| rate | numeric | Ставка (₽/км) |

---

## 🔌 API Endpoints

### Отчёты водителей `/api/reports/`

| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/drivers` | Список водителей |
| GET | `/vehicles` | Список машин |
| GET | `/driver-vehicles?driver=...&from=...&to=...` | Машины водителя за период |
| GET | `/trips-detail-v2?vehicle=...&from=...&to=...` | Рейсы WB |
| GET | `/contracts-rf-v2?vehicle=...&from=...&to=...` | Заявки РФ |
| GET | `/telematics/mileage?vehicle=...&from=...&to=...` | GPS пробег |
| GET | `/telematics/fuel-level?vehicle=...&datetime=...` | Уровень топлива в баке |
| GET | `/fuel/detail?vehicle=...&from=...&to=...` | Топливо по машине |
| GET | `/tariffs/vehicle-types` | Типы машин |
| GET | `/tariffs/rates?type=...&season=...` | Тарифы |
| POST | `/save` | Сохранить отчёт |

### Топливо `/api/fuel/`

| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/list?from=...&to=...&vehicle=...` | Список заправок |
| POST | `/upload` | Загрузка Excel |

### Зарплаты `/api/salary/`

| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/registers` | Список ведомостей |
| GET | `/registers/:id` | Детали ведомости |
| POST | `/upload` | Загрузка XML из 1С |
| DELETE | `/registers/:id` | Удалить ведомость |

### Машины `/api/vehicles/`

| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/` | Список машин |
| GET | `/:id` | Детали машины |
| PUT | `/:id` | Обновить машину |
| GET | `/by-number?number=...` | Машина по номеру |

---

## 📦 Модули системы

### 1. Отчёты водителей (`/reports`)

**Функционал:**
- Создание отчёта за период
- Два блока: WB (рейсы) и РФ (GPS пробег)
- Автоматический расчёт:
  - Пробег из GPS (Locarus API)
  - Топливо из карт
  - Суточные (дни × ставка)
  - Премия ТК (км × бонус)
- Ручные корректировки:
  - Дополнительные работы
  - Компенсации
  - Выданные авансы
- Формула расчёта:
  ```
  К выплате = WB рейсы + (РФ км × ставка) + Суточные + Премия + Доп.работы + Компенсации - Авансы
  ```

**Особенности:**
- Периоды РФ с разбивкой (для командировок с перерывами)
- Тарифная сетка по типу машины и сезону
- Контроль расхода топлива (норма vs факт)
- Сохранение всех данных в `expense_categories` (jsonb)

### 2. Зарплатные ведомости (`/salary`)

**Функционал:**
- Импорт XML из 1С (формат СчетаПК)
- Проверка дубликатов по номеру + дате
- Привязка выплат к водителям
- Статистика: всего ведомостей, выплат, сумма

**Формат XML:**
```xml
<?xml version="1.0" encoding="windows-1251"?>
<СчетаПК НомерРеестра="9" ДатаРеестра="23.01.2026" ...>
  <ЗачислениеЗарплаты>
    <Сотрудник Нпп="1">
      <Фамилия>Иванов</Фамилия>
      <Имя>Иван</Имя>
      <Отчество>Иванович</Отчество>
      <ЛицевойСчет>40817810...</ЛицевойСчет>
      <Сумма>7000,00</Сумма>
    </Сотрудник>
  </ЗачислениеЗарплаты>
</СчетаПК>
```

### 3. Импорт WB (`/import-wb`)

**Функционал:**
- Загрузка Excel с рейсами Wildberries
- Парсинг колонок: дата, время, маршрут, машина, водитель, ставка
- Нормализация номеров машин
- Обновление существующих / создание новых

**Формат Excel:**
| Дата погрузки | Время | Маршрут | Номер машины | Водитель | Ставка |
|---------------|-------|---------|--------------|----------|--------|
| 15.01.2026 | 08:30 | Коледино - Подольск | В990ТК43 | Иванов | 5000 |

### 4. Топливо (`/fuel`)

**Источники:**
| Компания | Формат | Особенности |
|----------|--------|-------------|
| Татнефть | XLSX | Машина в колонке "Закреплена за" |
| E100 | XLS | Требуется привязка карт в `fuel_cards` |
| Газпромнефть | XLSX | Блоки по картам, только операции "Дебет" |

### 5. Машины (`/vehicles`)

**Функционал:**
- Список машин с фильтрами
- Карточка машины:
  - Основные данные (номер, марка, модель, VIN)
  - Документы (ОСАГО, ТО, СКЗИ) с датами
  - Привязанные топливные карты
  - История рейсов
- Контроль сроков документов (подсветка просроченных)

---

## 🔗 Внешние интеграции

### Locarus (GPS телематика)

**URL:** `https://online.locarus.ru/api`  
**Авторизация:** Basic Auth

**Эндпоинты:**
```
GET /telematics/mileage?vehicle=В990ТК43&from=2026-01-01T00:00&to=2026-01-31T23:59
→ { "mileage": 10208 }

GET /telematics/fuel-level?vehicle=В990ТК43&datetime=2026-01-01T08:00
→ { "level": 150, "hasSensor": true }
```

### 1С (заявки РФ Транспорт)

Синхронизация через API:
```
GET /api-rf-transport.php?from=2026-01-01&to=2026-01-31
→ [{ "number": "123", "date": "2026-01-15", "route": "Москва-Киров", ... }]
```

---

## 🚢 Деплой

### Обновление Frontend

```bash
cd /var/www/transport-dashboard-system/frontend-v3
git pull origin main
npm run build
pm2 restart tl196-frontend
```

### Обновление Backend

```bash
cd /var/www/tl196/backend
git pull origin main
npm install  # если добавились зависимости
pm2 restart tl196-backend
```

### Логи

```bash
pm2 logs tl196-frontend --lines 100
pm2 logs tl196-backend --lines 100
```

### Статус

```bash
pm2 status
```

---

## 🔧 Troubleshooting

### Проблема: "Ведомость уже загружена"
**Причина:** Реестр с таким номером и датой уже есть в БД.  
**Решение:** Найти в списке и удалить, затем загрузить заново.

### Проблема: Начисления РФ = 0
**Причина:** `rfGpsMileage` не заполнен при загрузке.  
**Решение:** Исправлено в v2 — сумма пересчитывается из `rf_periods`.

### Проблема: GPS пробег не загружается
**Причина:** Locarus API недоступен или неверные креды.  
**Проверка:**
```bash
curl -u login:password "https://online.locarus.ru/api/telematics/mileage?vehicle=В990ТК43&from=2026-01-01&to=2026-01-31"
```

### Проблема: Топливо не привязывается к машине
**Причина:** Карта не привязана в таблице `fuel_cards`.  
**Решение:** Добавить запись:
```sql
INSERT INTO fuel_cards (card_number, source, vehicle_number) 
VALUES ('1234567890', 'E100', 'В990ТК43');
```

### Проблема: Frontend не обновляется
**Причина:** Кэш браузера.  
**Решение:** Ctrl+Shift+R или очистить кэш.

---

## 📞 Контакты

- **Сервер:** 195.26.226.37
- **SSH:** `clawdbot@195.26.226.37`
- **GitHub:** https://github.com/Igor1618/transport-dashboard-system

---

*Документация обновлена: 2026-02-05*
