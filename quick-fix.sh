#!/bin/bash
set -e

echo "🚀 Очистка и настройка дашборда..."

# Очищаем директорию
cd /var/www/html
rm -rf dashboard
mkdir -p dashboard
cd dashboard

# Клонируем проект
echo "📥 Клонирование проекта..."
git clone https://github.com/Igor1618/transport-dashboard-system.git .
git checkout claude/explore-project-setup-011CV2KtJX9oLAaEqz7crj5G

# Настройка nginx
echo "⚙️ Настройка nginx..."
cp nginx-site.conf /etc/nginx/sites-available/transport-dashboard
ln -sf /etc/nginx/sites-available/transport-dashboard /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Права доступа
echo "🔐 Настройка прав..."
chown -R www-data:www-data /var/www/html

# Перезагрузка nginx
echo "🔄 Перезагрузка nginx..."
nginx -t && systemctl reload nginx

echo "✅ Готово! Дашборд доступен на http://195.26.226.37/dashboard"
