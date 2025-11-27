# 🚀 Руководство по развертыванию TL196

## 📋 Описание

Полноценная система управления логистикой с React Frontend и Node.js Backend.

## 🛠️ Требования

- Node.js 18+ и npm
- PostgreSQL 14+ (или Supabase)
- Nginx
- PM2 (для production)
- Git

## 📦 Структура проекта

```
transport-dashboard-system/
├── frontend/          # React приложение (TypeScript)
├── backend/           # Node.js API (Express)
├── docs/             # Документация
└── deployment/       # Конфигурации для развертывания
```

## 🔧 Локальная установка

### 1. Клонирование репозитория

```bash
git clone https://github.com/Igor1618/transport-dashboard-system.git
cd transport-dashboard-system
```

### 2. Настройка Backend

```bash
cd backend
npm install

# Создать .env файл
cp .env.example .env
# Отредактировать .env с вашими настройками БД
nano .env

# Запустить сервер
npm run dev
```

Backend будет доступен на `http://localhost:3001`

### 3. Настройка Frontend

```bash
cd frontend
npm install

# Создать .env файл для React
echo "REACT_APP_API_URL=http://localhost:3001" > .env

# Запустить dev сервер
npm start
```

Frontend будет доступен на `http://localhost:3000`

## 🌐 Production развертывание на VPS

### Подготовка сервера (195.26.226.37)

```bash
# Подключение к серверу
ssh root@195.26.226.37

# Обновление системы
apt update && apt upgrade -y

# Установка Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# Установка PM2
npm install -g pm2

# Установка PostgreSQL (если нужно)
# В нашем случае используется Supabase на порту 5433
```

### Развертывание Backend

```bash
# Перейти в директорию backend
cd /var/www/tl196-api

# Клонировать репозиторий (если еще не сделано)
git clone https://github.com/Igor1618/transport-dashboard-system.git .

# Перейти в папку backend
cd backend

# Установить зависимости
npm install --production

# Создать .env файл
cat > .env << 'EOF'
PORT=3001
NODE_ENV=production
DB_HOST=localhost
DB_PORT=5433
DB_NAME=postgres
DB_USER=postgres
DB_PASSWORD=5+NMkUPabjFbh5vGZtWx5ea0QAX2NSR3G1k0sfAedms=
EOF

# Создать папку для загрузок
mkdir -p uploads

# Запустить с PM2
pm2 start server.js --name tl196-api
pm2 save
pm2 startup
```

### Развертывание Frontend

```bash
# Перейти в директорию frontend
cd /var/www/tl196/frontend

# Установить зависимости
npm install

# Создать production build
npm run build

# Скопировать build в корень веб-сервера
cp -r build/* /var/www/tl196/
```

### Настройка Nginx

Создать/обновить конфигурацию Nginx:

```bash
nano /etc/nginx/sites-available/tl196.ru
```

Содержимое файла:

```nginx
server {
    listen 443 ssl http2;
    server_name tl196.ru www.tl196.ru;

    # SSL сертификаты (certbot)
    ssl_certificate /etc/letsencrypt/live/tl196.ru/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/tl196.ru/privkey.pem;

    # Корневая директория для React build
    root /var/www/tl196;
    index index.html;

    # Логи
    access_log /var/log/nginx/tl196-access.log;
    error_log /var/log/nginx/tl196-error.log;

    # React SPA - все запросы направляем на index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API прокси на Node.js backend
    location /api/ {
        proxy_pass http://localhost:3001/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Кеширование статики
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}

# Редирект с HTTP на HTTPS
server {
    listen 80;
    server_name tl196.ru www.tl196.ru;
    return 301 https://$server_name$request_uri;
}
```

Активировать конфигурацию:

```bash
# Проверить конфигурацию
nginx -t

# Перезагрузить Nginx
systemctl reload nginx
```

## 🗄️ База данных

### Проверка подключения к БД

```bash
PGPASSWORD='5+NMkUPabjFbh5vGZtWx5ea0QAX2NSR3G1k0sfAedms=' psql -h localhost -p 5433 -U postgres -d postgres
```

### Структура таблиц

Таблицы уже созданы согласно ТЗ:
- `users` - пользователи системы
- `roles` - роли пользователей
- `trips` - рейсы
- `import_log` - история импорта

## 📝 Тестовый доступ

```
Логин: IgorL
Пароль: Director123!
Роль: Директор (полный доступ)
```

## 🔄 Обновление приложения

```bash
# Backend
cd /var/www/tl196-api/backend
git pull
npm install
pm2 restart tl196-api

# Frontend
cd /var/www/tl196/frontend
git pull
npm install
npm run build
cp -r build/* /var/www/tl196/
```

## 📊 Мониторинг

```bash
# Просмотр логов PM2
pm2 logs tl196-api

# Статус приложения
pm2 status

# Просмотр логов Nginx
tail -f /var/log/nginx/tl196-error.log
```

## 🐛 Troubleshooting

### Backend не запускается

```bash
# Проверить логи
pm2 logs tl196-api

# Проверить подключение к БД
cd /var/www/tl196-api/backend
node -e "require('./config/database').query('SELECT NOW()')"
```

### Frontend не отображается

```bash
# Проверить build
ls -la /var/www/tl196/

# Проверить конфигурацию Nginx
nginx -t

# Проверить логи Nginx
tail -f /var/log/nginx/tl196-error.log
```

### Проблемы с базой данных

```bash
# Проверить подключение
PGPASSWORD='5+NMkUPabjFbh5vGZtWx5ea0QAX2NSR3G1k0sfAedms=' psql -h localhost -p 5433 -U postgres -d postgres -c "SELECT version();"

# Проверить таблицы
PGPASSWORD='5+NMkUPabjFbh5vGZtWx5ea0QAX2NSR3G1k0sfAedms=' psql -h localhost -p 5433 -U postgres -d postgres -c "\dt"
```

## 🔒 Безопасность

- [ ] Изменить пароль БД в production
- [ ] Настроить firewall (ufw)
- [ ] Включить fail2ban
- [ ] Регулярное обновление системы
- [ ] Backup базы данных

## 📞 Поддержка

При возникновении проблем обращайтесь к разработчику или проверьте логи выше.

---

**Версия:** 1.0
**Дата:** Ноябрь 2025
**Статус:** Production Ready ✅
