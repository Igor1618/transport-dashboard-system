# TL196 - Транспортная система

**URL:** https://tl196.ru  
**Репозиторий:** https://github.com/Igor1618/transport-dashboard-system

---

## Архитектура

| Компонент | Технология | Порт | PM2 | Путь |
|-----------|------------|------|-----|------|
| Backend | Node.js/Express | 3001 | tl196-backend | /var/www/tl196/backend |
| Frontend | Next.js 15 | 3000 | tl196-frontend | /var/www/transport-dashboard-system/frontend-v3 |
| Database | PostgreSQL | 5433 | - | localhost |

---

## База данных PostgreSQL

**Подключение:**
```bash
psql -h localhost -p 5433 -U postgres -d postgres
```

### Основные таблицы:

| Таблица | Описание |
|---------|----------|
| vehicles | Машины (number, brand, model, vin, year) |
| drivers | Водители (name, phone, license_number) |
| trips | Рейсы WB (loading_date, route_name, vehicle_number, driver_name, driver_rate) |
| contracts | Заявки РФ Транспорт (number, date, route, client_rate, driver_rate) |
| route_rates | Ставки по маршрутам (route_name, driver_rate) |
| driver_reports | Отчёты водителей (driver_name, date_from, date_to, mileage, fuel) |
| fuel_transactions | Топливо (source, card_number, vehicle_number, quantity, amount) |
| fuel_cards | Привязка карт к машинам (card_number, source, vehicle_number) |

---

## API Endpoints

### Отчёты водителей `/reports/`
```
GET  /reports/drivers              - список водителей
GET  /reports/vehicles             - список машин
GET  /reports/driver-vehicles      - машины водителя за период
GET  /reports/trips-detail-v2      - рейсы WB с деталями
GET  /reports/contracts-rf-v2      - заявки РФ
GET  /reports/telematics/mileage   - GPS пробег за период
POST /reports/telematics/mileage-by-dates - GPS по списку дат
GET  /reports/fuel/detail          - топливо по машине
POST /reports/save                 - сохранить отчёт
```

### Топливо `/fuel/`
```
GET  /fuel/list    - список транзакций с фильтрами
POST /fuel/upload  - загрузка Excel файла
```

---

## Топливные компании

| # | Компания | Формат | Особенности |
|---|----------|--------|-------------|
| 1 | Татнефть | XLSX | Машина в "Закреплена за" |
| 2 | E100 | XLS | Нужна привязка карт |
| 3 | Газпромнефть | XLSX | Блоки по картам, только "Дебет" |
| 4 | Локальная АЗС | XLS | Название уточнить |

---

## Внешние API

### Locarus (телематика)
- URL: `https://online.locarus.ru/api`
- Auth: Basic (login/password в .env)
- Метод: `/telematics/mileage?vehicle=...&from=...&to=...`

### РФ Транспорт (1С)
- Заявки синхронизируются в таблицу `contracts`

---

## Деплой

```bash
# Backend
cd /var/www/tl196/backend
npm install
pm2 restart tl196-backend

# Frontend  
cd /var/www/transport-dashboard-system/frontend-v3
npm run build
pm2 restart tl196-frontend

# Логи
pm2 logs tl196-backend --lines 50
pm2 logs tl196-frontend --lines 50
```

---

## Git

```bash
cd /var/www/tl196
git add .
git commit -m "описание"
git push origin HEAD

# или для transport-dashboard-system (нужны права igor)
```

---

## Changelog

### 2026-01-30
- ✅ Раздел Топливо (/fuel, /fuel/import)
- ✅ Парсеры топливных файлов (4 компании)
- ✅ Документация проекта

### 2026-01-29
- ✅ Форма отчёта водителя (/reports/new)
- ✅ Блоки WB и РФ с GPS
- ✅ Ставки по маршрутам

### 2026-01-28
- ✅ Импорт WB Excel с временем
- ✅ Нормализация номеров машин
