# 🚛 TL196 - Система управления транспортной логистикой

> Полнофункциональная веб-система для управления транспортной компанией с автоматическим расчетом зарплат водителей

[![Version](https://img.shields.io/badge/Version-2.0-blue.svg)](CHANGELOG.md)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Node](https://img.shields.io/badge/Node-18+-green.svg)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-18-blue.svg)](https://reactjs.org)

## 🎯 Основные возможности

### ✨ Функциональность

- **📊 Дашборд со статистикой** - Общая информация о рейсах, выручке, водителях
- **🚛 Управление рейсами** - Просмотр, фильтрация и поиск по рейсам
- **💰 Автоматический расчет зарплат** - Расчет зарплаты водителей с учетом штрафов
- **📤 Загрузка Excel файлов** - Импорт путевых листов от Wildberries
- **👥 Управление пользователями** - Разграничение доступа по ролям
- **📈 История импорта** - Отслеживание всех загрузок данных

### 🎨 Интерфейс

- Современный React UI с TypeScript
- Адаптивный дизайн с Tailwind CSS
- Интуитивное боковое меню
- Поиск и фильтрация данных

### 🔐 Роли и права доступа

1. **Директор** - Полный доступ ко всем функциям
2. **Управленец** - Рейсы, зарплаты, машины, загрузка
3. **Экономист** - Просмотр рейсов и зарплат
4. **Бухгалтер** - Рейсы и зарплаты
5. **Механик** - Управление машинами
6. **Диспетчер** - Рейсы, загрузка, машины

## 🛠️ Технологический стек

### Frontend
- **React 18** - UI библиотека
- **TypeScript** - Типизация
- **React Router** - Роутинг
- **Tailwind CSS** - Стилизация
- **Axios** - HTTP клиент
- **Lucide React** - Иконки

### Backend
- **Node.js** - Runtime
- **Express** - Веб-фреймворк
- **PostgreSQL** - База данных (Supabase)
- **Multer** - Загрузка файлов
- **XLSX** - Парсинг Excel

### DevOps
- **Nginx** - Веб-сервер и прокси
- **PM2** - Process manager
- **Git** - Контроль версий

## 📦 Быстрый старт

### Требования

- Node.js 18+
- PostgreSQL 14+ (или Supabase)
- npm или yarn

### Установка

```bash
# Клонирование репозитория
git clone https://github.com/Igor1618/transport-dashboard-system.git
cd transport-dashboard-system

# Установка Backend
cd backend
npm install
cp .env.example .env
# Отредактировать .env с настройками БД
npm run dev

# Установка Frontend (в новом терминале)
cd frontend
npm install
npm start
```

## 🌐 Production развертывание

Полное руководство по развертыванию см. в [DEPLOYMENT.md](./DEPLOYMENT.md)

### Быстрая установка на сервер

```bash
# Backend
cd /var/www/tl196-api
npm install --production
pm2 start server.js --name tl196-api

# Frontend
cd /var/www/tl196/frontend
npm install
npm run build
cp -r build/* /var/www/tl196/
```

## 📊 База данных

### Структура

```sql
-- Пользователи системы
users (id, email, password_hash, full_name, role_id)

-- Роли
roles (id, name, display_name)

-- Рейсы
trips (id, wb_trip_number, loading_date, driver_name, vehicle_number,
       trip_amount, distance_km, has_penalty, penalty_amount, ...)

-- История импорта
import_log (id, filename, imported_at, rows_imported, rows_skipped, status)
```

### Подключение к БД

```bash
# Локально на сервере
psql -h localhost -p 5433 -U postgres -d postgres

# Удаленно
psql -h 195.26.226.37 -p 5433 -U postgres -d postgres
```

## 🔑 API Endpoints

### Авторизация
```
POST /api/auth/login
```

### Статистика
```
GET /api/stats
```

### Рейсы
```
GET /api/trips
```

### Зарплаты
```
GET /api/salary?month=YYYY-MM
```

### Загрузка файлов
```
POST /api/upload
```

### История импорта
```
GET /api/import-history
```

## 📝 Формат Excel файла

Файл от Wildberries должен содержать колонки:

- № рейса WB
- Дата погрузки
- Дата выгрузки
- Номер машины
- ФИО водителя
- Маршрут
- Сумма рейса
- Километраж
- Штраф (есть/нет)
- Сумма штрафа
- Контейнеры
- РЦ (распределительный центр)

## 🔧 Конфигурация

### Backend (.env)

```env
PORT=3001
NODE_ENV=production
DB_HOST=localhost
DB_PORT=5433
DB_NAME=postgres
DB_USER=postgres
DB_PASSWORD=your_password
```

### Frontend (.env)

```env
REACT_APP_API_URL=/api
```

### Nginx

```nginx
location /api/ {
    proxy_pass http://localhost:3001/;
}

location / {
    try_files $uri $uri/ /index.html;
}
```

## 🧪 Тестирование

### Тестовый пользователь

```
Логин: IgorL
Пароль: Director123!
Роль: Директор
```

### Проверка API

```bash
# Health check
curl http://localhost:3001/health

# Авторизация
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"IgorL","password":"Director123!"}'
```

## 📂 Структура проекта

```
transport-dashboard-system/
├── frontend/
│   ├── src/
│   │   ├── components/    # React компоненты
│   │   ├── pages/         # Страницы приложения
│   │   ├── context/       # React Context (Auth)
│   │   ├── services/      # API сервисы
│   │   ├── types/         # TypeScript типы
│   │   └── styles/        # CSS стили
│   ├── public/
│   └── package.json
├── backend/
│   ├── routes/            # API endpoints
│   ├── config/            # Конфигурация (БД)
│   ├── uploads/           # Загруженные файлы
│   ├── server.js          # Главный файл
│   └── package.json
├── DEPLOYMENT.md          # Руководство по развертыванию
└── README.md              # Этот файл
```

## 🔄 Обновление

```bash
# Получить последние изменения
git pull origin main

# Обновить backend
cd backend
npm install
pm2 restart tl196-api

# Обновить frontend
cd frontend
npm install
npm run build
```

## 🐛 Troubleshooting

### Backend не запускается

```bash
pm2 logs tl196-api
```

### Frontend не отображается

```bash
nginx -t
tail -f /var/log/nginx/error.log
```

### Проблемы с БД

```bash
psql -h localhost -p 5433 -U postgres -d postgres -c "SELECT version();"
```

## 🤝 Участие в разработке

1. Fork проекта
2. Создать ветку (`git checkout -b feature/amazing-feature`)
3. Commit изменений (`git commit -m 'Add amazing feature'`)
4. Push в ветку (`git push origin feature/amazing-feature`)
5. Открыть Pull Request

## 📄 Лицензия

Этот проект лицензирован под MIT License.

## 👨‍💻 Автор

**Igor1618**
- GitHub: [@Igor1618](https://github.com/Igor1618)

## 📞 Поддержка

- 📧 Email: support@tl196.ru
- 🌐 Website: https://tl196.ru
- 📱 Telegram: @tl196support

## 🙏 Благодарности

- Wildberries за API и Excel формат
- Supabase за PostgreSQL хостинг
- React и Node.js сообщества

---

⭐ **Поставьте звезду, если проект был полезен!**

**Версия:** 2.0
**Дата:** Ноябрь 2025
**Статус:** Production Ready ✅
