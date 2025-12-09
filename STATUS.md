# Статус интеграции 1C с TL196

**Дата**: 9 декабря 2025
**Ветка**: `claude/check-github-branches-01NDV8xwsebuH6cPKQ4X3pmn`

---

## ✅ Что готово

### 1. База данных
- ✅ Таблицы для интеграции 1C созданы (`database/migration_1c_integration.sql`)
  - `vehicles` - справочник машин
  - `drivers` - справочник водителей
  - `contracts` - договоры
  - `driver_reports` - отчеты водителей
  - `expense_categories` - категории расходов

- ✅ Аналитические представления созданы (`database/analytics_views.sql`)
  - `v_driver_expenses` - расходы по водителям
  - `v_vehicle_fuel_analytics` - аналитика топлива по машинам
  - `v_route_analytics` - аналитика по маршрутам
  - `v_expense_categories_summary` - сводка по категориям расходов
  - `v_driver_performance` - производительность водителей
  - `v_vehicle_utilization` - использование транспорта
  - `v_monthly_statistics` - ежемесячная статистика
  - `v_top_performers` - топ-показатели

### 2. Backend API
- ✅ Маршруты API для 1C данных (`backend/routes/`)
  - `/drivers` - водители (список, статистика)
  - `/contracts` - договоры (список, фильтры, статистика)
  - `/driver-reports` - отчеты водителей (список, категории расходов)
  - `/analytics/*` - аналитические данные (дашборд, расходы, топливо, маршруты)

- ✅ Скрипт синхронизации данных (`backend/scripts/sync-1c-data.js`)
  - Загружает справочники (машины, водители)
  - Загружает транзакционные данные (договоры, отчеты)
  - Поддерживает параметр месяца
  - Использование: `node sync-1c-data.js 2024-11`

### 3. Автоматизация
- ✅ n8n Workflow (`database/n8n_workflow_1c_sync.json`)
  - Ежедневная синхронизация в 2:00
  - Полная перезагрузка справочников
  - Инкрементальная загрузка транзакций
  - Обработка ошибок

### 4. Документация
- ✅ Инструкция по интеграции (`database/1C_INTEGRATION_README.md`)
- ✅ Инструкция по перезапуску n8n (`N8N_RESTART_GUIDE.md`)

---

## 📋 Что нужно сделать

### Шаг 1: Перезапустить n8n
Используйте инструкцию в файле `N8N_RESTART_GUIDE.md`.

**Краткая версия**:
1. Подключитесь к серверу: `ssh root@95.26.226.37`
2. Найдите, как запущен n8n (Docker/PM2/systemd)
3. Перезапустите сервис
4. Проверьте доступность: https://n8n1618ru.ru

### Шаг 2: Настроить n8n workflow
1. Импортировать workflow из `database/n8n_workflow_1c_sync.json`
2. Создать учетные данные:
   - **1C API Basic Auth**:
     - User: `TransportAPI`
     - Password: `TransportAPI_SecretPass`
   - **PostgreSQL**:
     - Host: `localhost`
     - Port: `5432`
     - Database: `postgres`
     - User: `postgres`
     - Password: `postgres123`
3. Привязать учетные данные к узлам workflow
4. Активировать workflow

### Шаг 3: Загрузить данные за ноябрь 2024
**Вариант A: Через n8n**
1. Запустить workflow вручную для теста
2. Проверить, что данные появились в базе

**Вариант B: Вручную (если n8n не работает)**
```bash
cd /home/user/transport-dashboard-system/backend
node scripts/sync-1c-data.js 2024-11
```

**⚠️ ВАЖНО**: Скрипт должен запускаться на машине с доступом к 1C API (192.168.33.250).
Если сервер 95.26.226.37 не имеет доступа к внутренней сети 1C, запустите скрипт локально.

### Шаг 4: Проверить данные
```bash
# Подключиться к базе
psql -U postgres -d postgres

# Проверить количество записей
SELECT COUNT(*) FROM vehicles;
SELECT COUNT(*) FROM drivers;
SELECT COUNT(*) FROM contracts;
SELECT COUNT(*) FROM driver_reports;

# Проверить API
curl http://localhost:3001/drivers
curl http://localhost:3001/analytics/dashboard
```

### Шаг 5: Создать frontend для отображения данных 1C
**Страница для директора** с данными:
- Список водителей с показателями
- Список договоров
- Отчеты водителей
- Аналитические дашборды

**Требования**:
- Доступ только для роли "Директор"
- Дизайн в стиле существующего сайта TL196
- Использовать API endpoints из `backend/routes/`

---

## 🔗 Полезные ссылки

- **Backend API**: http://localhost:3001
- **n8n**: https://n8n1618ru.ru
- **Документация 1C API**: http://192.168.33.250/tk/hs/TransportAPI/api/v1/

---

## 📊 Endpoints API для frontend

### Водители
```
GET /drivers - список водителей
GET /drivers/:id - детали водителя
GET /drivers/:id/stats - статистика водителя
```

### Договоры
```
GET /contracts - список договоров (с фильтрами)
GET /contracts/:uuid - детали договора
GET /contracts/stats/summary - общая статистика
GET /contracts/stats/by-month - статистика по месяцам
GET /contracts/stats/by-route - статистика по маршрутам
```

### Отчеты водителей
```
GET /driver-reports - список отчетов (с фильтрами)
GET /driver-reports/:id - детали отчета
GET /driver-reports/:id/expenses - категории расходов
GET /driver-reports/stats/summary - общая статистика
GET /driver-reports/stats/by-month - статистика по месяцам
GET /driver-reports/stats/fuel-efficiency - эффективность расхода топлива
```

### Аналитика
```
GET /analytics/dashboard - данные для главного дашборда
GET /analytics/driver-expenses - расходы по водителям
GET /analytics/vehicle-fuel - аналитика топлива по машинам
GET /analytics/route-analytics - аналитика по маршрутам
GET /analytics/expense-categories - сводка по категориям расходов
GET /analytics/driver-performance - производительность водителей
GET /analytics/vehicle-utilization - использование транспорта
GET /analytics/monthly-statistics - ежемесячная статистика
GET /analytics/top-performers - топ-10 показателей
```

---

## ⚙️ Конфигурация

### 1C API
- **URL**: http://192.168.33.250/tk/hs/TransportAPI/api/v1
- **Auth**: Basic (TransportAPI:TransportAPI_SecretPass)

### PostgreSQL
- **Host**: localhost
- **Port**: 5432
- **Database**: postgres
- **User**: postgres
- **Password**: postgres123

### Backend
- **Port**: 3001
- **Environment**: production

---

## 🐛 Решение проблем

### n8n не запускается
См. `N8N_RESTART_GUIDE.md`

### 1C API недоступен (403 Forbidden)
Проверьте:
- Доступна ли внутренняя сеть 192.168.33.250
- Правильные ли учетные данные (TransportAPI:TransportAPI_SecretPass)
- Запускаете ли скрипт с машины, имеющей доступ к 1C

### База данных пустая
1. Запустите миграции: `psql -U postgres -d postgres -f database/migration_1c_integration.sql`
2. Создайте views: `psql -U postgres -d postgres -f database/analytics_views.sql`
3. Загрузите данные: `node backend/scripts/sync-1c-data.js 2024-11`

### Backend не отвечает
```bash
# Проверить процесс
ps aux | grep node

# Запустить backend
cd /home/user/transport-dashboard-system/backend
./start-backend.sh

# Или вручную
node server.js
```

---

## 📝 Следующие шаги разработки

1. ✅ Интеграция 1C - ГОТОВО
2. ⏳ Перезапуск n8n - В ПРОЦЕССЕ
3. ⏳ Загрузка данных за ноябрь - ОЖИДАЕТ
4. ⏳ Разработка frontend - ОЖИДАЕТ
5. ⏳ Тестирование - ОЖИДАЕТ

---

## 👤 Контакты

При возникновении вопросов проверьте:
- `N8N_RESTART_GUIDE.md` - для вопросов по n8n
- `database/1C_INTEGRATION_README.md` - для вопросов по интеграции
- Логи сервисов (см. команды в гайдах)
