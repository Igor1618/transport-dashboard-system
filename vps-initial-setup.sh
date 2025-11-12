#!/bin/bash
###############################################################################
# Скрипт первоначальной настройки VPS для дашборда
###############################################################################

set -e

echo "╔════════════════════════════════════════╗"
echo "║   Первоначальная настройка VPS        ║"
echo "╚════════════════════════════════════════╝"
echo ""

# 1. Установка необходимого ПО
echo "📦 Установка необходимого ПО..."
apt-get update
apt-get install -y nginx git curl

# 2. Создание директории для проекта
echo "📁 Создание директорий..."
mkdir -p /var/www/html/dashboard
cd /var/www/html/dashboard

# 3. Клонирование репозитория
echo "📥 Клонирование репозитория..."
git clone https://github.com/Igor1618/transport-dashboard-system.git .
git checkout claude/explore-project-setup-011CV2KtJX9oLAaEqz7crj5G

# 4. Настройка прав доступа
echo "🔐 Настройка прав доступа..."
chown -R www-data:www-data /var/www/html

# 5. Копирование конфига nginx
echo "⚙️ Настройка nginx..."
if [ -f nginx-site.conf ]; then
    cp nginx-site.conf /etc/nginx/sites-available/transport-dashboard
    ln -sf /etc/nginx/sites-available/transport-dashboard /etc/nginx/sites-enabled/
    rm -f /etc/nginx/sites-enabled/default
fi

# 6. Проверка и перезагрузка nginx
echo "🔄 Перезагрузка nginx..."
nginx -t
systemctl reload nginx

# 7. Готово!
echo ""
echo "╔════════════════════════════════════════╗"
echo "║   ✅ Настройка завершена!             ║"
echo "╚════════════════════════════════════════╝"
echo ""
echo "🌐 Дашборд доступен по адресу:"
echo "   http://195.26.226.37/dashboard"
echo ""
echo "🔄 Автодеплой настроен - любой push будет автоматически обновлять сайт!"
echo ""
