#!/bin/bash

# 🚀 Скрипт деплоя для сервера tl196.ru
# Запускать ПРЯМО НА СЕРВЕРЕ: bash deploy-to-server.sh

set -e  # Остановка при ошибке

echo "════════════════════════════════════════════════════════════"
echo "  🚛 TL196 - Деплой системы тарифов"
echo "════════════════════════════════════════════════════════════"
echo ""

# Определяем путь к проекту
PROJECT_PATH="/var/www/tl196"
BRANCH="claude/russian-greeting-01LD5Vq3RZxdk6qvSMUQcfdz"

echo "📂 Путь к проекту: $PROJECT_PATH"
echo "🌿 Ветка: $BRANCH"
echo ""

# Шаг 1: Обновление кода
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📥 [1/6] Обновление кода из GitHub..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
cd $PROJECT_PATH
git fetch origin
git checkout $BRANCH
git pull origin $BRANCH
echo "✅ Код обновлен"
echo ""

# Шаг 2: Применение миграции БД
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "💾 [2/6] Применение миграции базы данных..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Проверяем существует ли файл миграции
if [ ! -f "database/add_route_rates.sql" ]; then
    echo "❌ Файл миграции не найден: database/add_route_rates.sql"
    exit 1
fi

# Загружаем переменные окружения
if [ -f "backend/.env" ]; then
    export $(cat backend/.env | grep -v '^#' | xargs)
    echo "Подключение к БД: $DB_HOST:$DB_PORT/$DB_NAME"
    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f database/add_route_rates.sql
    echo "✅ Миграция применена"
else
    echo "⚠️  Файл .env не найден, применяю миграцию с дефолтными параметрами..."
    PGPASSWORD="${DB_PASSWORD:-postgres}" psql -h localhost -p 5433 -U postgres -d transport_dashboard -f database/add_route_rates.sql
    echo "✅ Миграция применена"
fi
echo ""

# Шаг 3: Проверка таблицы
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔍 [3/6] Проверка таблицы route_rates..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
ROUTE_COUNT=$(PGPASSWORD="$DB_PASSWORD" psql -h "${DB_HOST:-localhost}" -p "${DB_PORT:-5433}" -U "${DB_USER:-postgres}" -d "${DB_NAME:-transport_dashboard}" -t -c "SELECT COUNT(*) FROM route_rates;")
echo "✅ Найдено маршрутов с тарифами: $ROUTE_COUNT"
echo ""

# Шаг 4: Обновление backend
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔧 [4/6] Обновление backend..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
cd backend
npm install --production
echo "✅ Зависимости обновлены"
echo ""

# Шаг 5: Перезапуск backend
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔄 [5/6] Перезапуск backend..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
pm2 restart tl196-api
pm2 save
echo "✅ Backend перезапущен"
echo ""
sleep 2

# Шаг 6: Сборка frontend
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎨 [6/6] Сборка frontend..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
cd $PROJECT_PATH/frontend
npm install --legacy-peer-deps
npm run build
echo "✅ Frontend собран"
echo ""

# Проверка работоспособности
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔍 Проверка работоспособности..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Проверка backend
echo "→ Проверка backend API..."
if curl -s http://localhost:3001/health | grep -q "ok"; then
    echo "  ✅ Backend работает"
else
    echo "  ⚠️  Backend может не работать"
fi

# Проверка нового роута
echo "→ Проверка API тарифов..."
ROUTES_RESPONSE=$(curl -s http://localhost:3001/routes)
if echo "$ROUTES_RESPONSE" | grep -q "route_name"; then
    echo "  ✅ API /routes работает"
else
    echo "  ⚠️  API /routes не отвечает правильно"
fi

# Статус PM2
echo "→ Статус процессов:"
pm2 list | grep tl196-api

echo ""
echo "════════════════════════════════════════════════════════════"
echo "✅ Деплой завершен!"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "📋 Что было сделано:"
echo "  ✓ Код обновлен с GitHub (ветка $BRANCH)"
echo "  ✓ Создана таблица route_rates в базе данных"
echo "  ✓ Добавлено $ROUTE_COUNT маршрутов с тарифами"
echo "  ✓ Backend API обновлен и перезапущен"
echo "  ✓ Frontend пересобран"
echo ""
echo "🌐 Откройте в браузере: http://tl196.ru"
echo "  → Залогинься"
echo "  → В меню появилась вкладка 'Тарифы' (иконка карты 🗺️)"
echo ""
echo "📖 Что нового:"
echo "  • Страница 'Тарифы' - управление ставками водителей"
echo "  • Зарплата = (кол-во рейсов × тариф маршрута) - штрафы"
echo ""
echo "🔍 Логи backend:"
echo "  pm2 logs tl196-api"
echo ""
