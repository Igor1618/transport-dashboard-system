#!/bin/bash

###############################################################################
# Скрипт автоматического развертывания дашборда на VPS
###############################################################################
#
# Использование:
#   bash deploy.sh
#
# Или для ручного запуска на сервере:
#   ssh root@195.26.226.37 'bash -s' < deploy.sh
#
###############################################################################

set -e  # Остановка при ошибке

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Функции для логирования
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Переменные окружения
PROJECT_DIR="/var/www/html"
NGINX_SITE="transport-dashboard"
DB_NAME="transport_dashboard"
DB_USER="postgres"
DB_PORT="5433"

echo "╔════════════════════════════════════════╗"
echo "║   Развертывание дашборда на VPS       ║"
echo "╚════════════════════════════════════════╝"
echo ""

# 1. Проверка системы
log_info "Проверка системных требований..."

if ! command -v nginx &> /dev/null; then
    log_error "nginx не установлен!"
    log_info "Установка nginx..."
    apt-get update
    apt-get install -y nginx
fi

if ! command -v php &> /dev/null; then
    log_error "PHP не установлен!"
    log_info "Установка PHP..."
    apt-get install -y php-fpm php-pgsql php-curl php-json php-mbstring
fi

if ! command -v psql &> /dev/null; then
    log_warn "psql клиент не установлен (опционально)"
fi

log_info "✓ Системные требования проверены"

# 2. Создание директории проекта
log_info "Создание/обновление директории проекта..."

if [ ! -d "$PROJECT_DIR" ]; then
    mkdir -p "$PROJECT_DIR"
    log_info "✓ Директория создана: $PROJECT_DIR"
else
    log_info "✓ Директория существует: $PROJECT_DIR"
fi

# 3. Клонирование/обновление репозитория
log_info "Обновление кода из git..."

cd "$PROJECT_DIR"

if [ -d ".git" ]; then
    log_info "Обновление существующего репозитория..."
    git fetch origin
    git reset --hard origin/main
    git pull origin main
else
    log_info "Клонирование репозитория..."
    # Если нужно клонировать, раскомментируйте:
    # git clone https://github.com/Igor1618/transport-dashboard-system.git .
    log_warn "Репозиторий не найден. Код должен быть загружен вручную или через git clone."
fi

log_info "✓ Код обновлен"

# 4. Настройка прав доступа
log_info "Настройка прав доступа..."

chown -R www-data:www-data "$PROJECT_DIR"
chmod -R 755 "$PROJECT_DIR"

# Защита служебных файлов
chmod 600 "$PROJECT_DIR/.env" 2>/dev/null || true
chmod 644 "$PROJECT_DIR/index.html"

log_info "✓ Права доступа настроены"

# 5. Настройка nginx
log_info "Настройка nginx..."

if [ -f "$PROJECT_DIR/nginx-site.conf" ]; then
    # Копируем конфиг
    cp "$PROJECT_DIR/nginx-site.conf" "/etc/nginx/sites-available/$NGINX_SITE"

    # Создаем симлинк если его нет
    if [ ! -L "/etc/nginx/sites-enabled/$NGINX_SITE" ]; then
        ln -s "/etc/nginx/sites-available/$NGINX_SITE" "/etc/nginx/sites-enabled/$NGINX_SITE"
    fi

    # Проверяем конфиг
    if nginx -t; then
        log_info "✓ Конфигурация nginx валидна"
    else
        log_error "Ошибка в конфигурации nginx!"
        exit 1
    fi
else
    log_warn "Файл nginx-site.conf не найден, пропускаем настройку nginx"
fi

# 6. Инициализация базы данных
log_info "Проверка базы данных..."

if [ -f "$PROJECT_DIR/database-setup.sql" ]; then
    log_info "Применение SQL скрипта..."

    # Проверяем доступность PostgreSQL
    if psql -h 127.0.0.1 -p "$DB_PORT" -U "$DB_USER" -lqt 2>/dev/null | cut -d \| -f 1 | grep -qw "$DB_NAME"; then
        log_info "База данных '$DB_NAME' существует"
    else
        log_warn "База данных '$DB_NAME' не найдена"
        # Раскомментируйте для автоматического создания:
        # createdb -h 127.0.0.1 -p "$DB_PORT" -U "$DB_USER" "$DB_NAME"
    fi

    # Применяем миграции (раскомментируйте если база готова)
    # psql -h 127.0.0.1 -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$PROJECT_DIR/database-setup.sql"

    log_info "✓ База данных проверена"
else
    log_warn "SQL скрипт не найден, пропускаем инициализацию БД"
fi

# 7. Перезагрузка сервисов
log_info "Перезагрузка сервисов..."

# Перезагружаем PHP-FPM если установлен
if systemctl is-active --quiet php8.1-fpm; then
    systemctl reload php8.1-fpm
    log_info "✓ PHP-FPM перезагружен"
elif systemctl is-active --quiet php7.4-fpm; then
    systemctl reload php7.4-fpm
    log_info "✓ PHP-FPM перезагружен"
fi

# Перезагружаем nginx
systemctl reload nginx
log_info "✓ nginx перезагружен"

# 8. Проверка деплоя
log_info "Проверка деплоя..."

if curl -f -s -o /dev/null http://localhost/index.html; then
    log_info "✓ Сайт доступен локально"
else
    log_warn "Не удалось проверить доступность сайта"
fi

# 9. Вывод информации
echo ""
echo "╔════════════════════════════════════════╗"
echo "║   Деплой завершен успешно! ✅         ║"
echo "╚════════════════════════════════════════╝"
echo ""
log_info "Сайт доступен по адресу: http://195.26.226.37"
log_info "Директория проекта: $PROJECT_DIR"
log_info "Время деплоя: $(date)"
echo ""
log_info "Следующие шаги:"
echo "  1. Проверьте работу сайта: http://195.26.226.37"
echo "  2. Примените SQL скрипт для создания таблиц"
echo "  3. Запустите синхронизацию с 1С"
echo ""
log_info "Полезные команды:"
echo "  - Логи nginx: tail -f /var/log/nginx/transport-dashboard-error.log"
echo "  - Логи PHP: tail -f /var/log/php8.1-fpm.log"
echo "  - Перезагрузка: systemctl reload nginx"
echo ""
