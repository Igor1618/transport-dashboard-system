#!/bin/bash
set -e

echo "╔════════════════════════════════════════╗"
echo "║  Полная настройка дашборда на /dashboard  ║"
echo "╚════════════════════════════════════════╝"
echo ""

# 1. Очистка и создание директории
echo "📁 Очистка и создание директории..."
cd /var/www/html
rm -rf dashboard
mkdir -p dashboard

# 2. Клонирование репозитория
echo "📥 Клонирование репозитория..."
git clone https://github.com/Igor1618/transport-dashboard-system.git dashboard
cd dashboard
git checkout claude/explore-project-setup-011CV2KtJX9oLAaEqz7crj5G

# 3. Проверка что файлы на месте
echo "✅ Проверка файлов..."
if [ -f "index.html" ]; then
    echo "   ✓ index.html найден"
else
    echo "   ✗ index.html НЕ НАЙДЕН!"
    exit 1
fi

# 4. Настройка nginx
echo "⚙️  Настройка nginx..."

# Создаем конфиг для дашборда
cat > /etc/nginx/sites-available/transport-dashboard << 'EOF'
server {
    listen 80;
    server_name 195.26.226.37;

    # Корневая директория
    root /var/www/html;
    index index.html;

    # Логи
    access_log /var/log/nginx/transport-dashboard-access.log;
    error_log /var/log/nginx/transport-dashboard-error.log;

    # Дашборд на /dashboard
    location /dashboard {
        alias /var/www/html/dashboard;
        index index.html;
        try_files $uri $uri/ /dashboard/index.html;
    }

    # Дополнительные настройки
    location ~ /\.git {
        deny all;
    }

    # CORS для API
    location ~ \.php$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:/var/run/php/php8.1-fpm.sock;
    }
}
EOF

# Активируем конфиг
echo "🔗 Активация конфига nginx..."
ln -sf /etc/nginx/sites-available/transport-dashboard /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# 5. Права доступа
echo "🔐 Настройка прав доступа..."
chown -R www-data:www-data /var/www/html
chmod -R 755 /var/www/html

# 6. Тестирование и перезагрузка nginx
echo "🔄 Перезагрузка nginx..."
nginx -t
if [ $? -eq 0 ]; then
    systemctl reload nginx
    echo "   ✓ Nginx перезагружен успешно"
else
    echo "   ✗ Ошибка в конфигурации nginx!"
    exit 1
fi

# 7. Проверка что всё работает
echo ""
echo "🧪 Проверка доступности..."
if [ -f "/var/www/html/dashboard/index.html" ]; then
    echo "   ✓ Файлы на месте"
    ls -lh /var/www/html/dashboard/index.html
else
    echo "   ✗ index.html не найден!"
fi

echo ""
echo "╔════════════════════════════════════════╗"
echo "║  ✅ Настройка завершена!              ║"
echo "╚════════════════════════════════════════╝"
echo ""
echo "🌐 Дашборд доступен по адресу:"
echo "   http://195.26.226.37/dashboard"
echo ""
echo "📋 Проверка:"
echo "   curl -I http://195.26.226.37/dashboard/"
echo ""
echo "📊 Логи nginx:"
echo "   tail -f /var/log/nginx/transport-dashboard-error.log"
echo ""
