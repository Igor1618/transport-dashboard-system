#!/bin/bash

# 🚀 Скрипт деплоя системы тарифов TL196
# Использование: bash deploy.sh

set -e  # Остановка при ошибке

echo "════════════════════════════════════════════════════════════"
echo "  🚛 TL196 - Деплой системы тарифов"
echo "════════════════════════════════════════════════════════════"
echo ""

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Конфигурация сервера
SERVER_IP="195.26.226.37"
SERVER_USER="root"  # или ваш пользователь
PROJECT_PATH="/var/www/transport-dashboard-system"  # путь к проекту на сервере
DB_NAME="transport_dashboard"
DB_USER="postgres"
DB_PORT="5433"

echo -e "${BLUE}📋 Конфигурация:${NC}"
echo "  Сервер: $SERVER_USER@$SERVER_IP"
echo "  Проект: $PROJECT_PATH"
echo "  База данных: $DB_NAME (порт $DB_PORT)"
echo ""

# Функция для выполнения команд на сервере
run_remote() {
    echo -e "${YELLOW}→ $1${NC}"
    ssh "$SERVER_USER@$SERVER_IP" "$1"
}

# Шаг 1: Проверка подключения к серверу
echo -e "${GREEN}[1/7] Проверка подключения к серверу...${NC}"
if ssh -o ConnectTimeout=5 "$SERVER_USER@$SERVER_IP" "echo 'OK'" &>/dev/null; then
    echo -e "${GREEN}✓ Подключение успешно${NC}"
else
    echo -e "${RED}✗ Не удалось подключиться к серверу${NC}"
    echo "  Проверьте SSH доступ: ssh $SERVER_USER@$SERVER_IP"
    exit 1
fi
echo ""

# Шаг 2: Обновление кода на сервере
echo -e "${GREEN}[2/7] Обновление кода из репозитория...${NC}"
run_remote "cd $PROJECT_PATH && git fetch origin"
run_remote "cd $PROJECT_PATH && git checkout claude/russian-greeting-01LD5Vq3RZxdk6qvSMUQcfdz"
run_remote "cd $PROJECT_PATH && git pull origin claude/russian-greeting-01LD5Vq3RZxdk6qvSMUQcfdz"
echo -e "${GREEN}✓ Код обновлен${NC}"
echo ""

# Шаг 3: Применение миграции базы данных
echo -e "${GREEN}[3/7] Применение миграции базы данных...${NC}"
run_remote "cd $PROJECT_PATH && PGPASSWORD=\$DB_PASSWORD psql -h localhost -p $DB_PORT -U $DB_USER -d $DB_NAME -f database/add_route_rates.sql"
echo -e "${GREEN}✓ Миграция применена${NC}"
echo ""

# Шаг 4: Установка зависимостей backend (если нужно)
echo -e "${GREEN}[4/7] Проверка зависимостей backend...${NC}"
run_remote "cd $PROJECT_PATH/backend && npm install --production"
echo -e "${GREEN}✓ Зависимости backend обновлены${NC}"
echo ""

# Шаг 5: Сборка frontend
echo -e "${GREEN}[5/7] Сборка frontend...${NC}"
echo -e "${YELLOW}  Копирование собранного frontend на сервер...${NC}"
scp -r ./frontend/build/* "$SERVER_USER@$SERVER_IP:$PROJECT_PATH/frontend/build/"
echo -e "${GREEN}✓ Frontend обновлен${NC}"
echo ""

# Шаг 6: Перезапуск backend
echo -e "${GREEN}[6/7] Перезапуск backend сервиса...${NC}"
run_remote "cd $PROJECT_PATH/backend && pm2 restart backend || pm2 start server.js --name backend"
run_remote "pm2 save"
echo -e "${GREEN}✓ Backend перезапущен${NC}"
echo ""

# Шаг 7: Проверка работоспособности
echo -e "${GREEN}[7/7] Проверка работоспособности...${NC}"
echo -e "${YELLOW}  Проверка backend API...${NC}"
if run_remote "curl -s http://localhost:3001/health" | grep -q "ok"; then
    echo -e "${GREEN}✓ Backend работает${NC}"
else
    echo -e "${RED}⚠ Backend может не работать, проверьте логи: pm2 logs backend${NC}"
fi
echo ""

# Финальный вывод
echo "════════════════════════════════════════════════════════════"
echo -e "${GREEN}✅ Деплой завершен!${NC}"
echo "════════════════════════════════════════════════════════════"
echo ""
echo -e "${BLUE}📋 Что было сделано:${NC}"
echo "  ✓ Код обновлен с ветки claude/russian-greeting-01LD5Vq3RZxdk6qvSMUQcfdz"
echo "  ✓ Создана таблица route_rates в базе данных"
echo "  ✓ Добавлен API эндпоинт /routes для управления тарифами"
echo "  ✓ Frontend обновлен (новая страница 'Тарифы' в меню)"
echo "  ✓ Backend перезапущен"
echo ""
echo -e "${BLUE}🌐 Доступ к системе:${NC}"
echo "  • Сайт: http://tl196.ru"
echo "  • Backend API: http://tl196.ru/api"
echo ""
echo -e "${BLUE}🔍 Проверка логов:${NC}"
echo "  • Backend: ssh $SERVER_USER@$SERVER_IP 'pm2 logs backend'"
echo "  • База данных: ssh $SERVER_USER@$SERVER_IP 'tail -f /var/log/postgresql/postgresql.log'"
echo ""
echo -e "${BLUE}📖 Что нового:${NC}"
echo "  • Новая вкладка 'Тарифы' в меню (иконка карты)"
echo "  • Зарплата теперь считается: (кол-во рейсов × тариф маршрута) - штрафы"
echo "  • Можно настроить тариф для каждого маршрута отдельно"
echo ""
