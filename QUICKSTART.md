# 🚀 Быстрый старт TL196

## Локальная разработка (5 минут)

### 1. Клонировать репозиторий

```bash
git clone https://github.com/Igor1618/transport-dashboard-system.git
cd transport-dashboard-system
```

### 2. Запустить Backend

```bash
cd backend
npm install
cp .env.example .env
# Отредактировать .env с настройками БД
npm run dev
```

✅ Backend: `http://localhost:3001`

### 3. Запустить Frontend (новый терминал)

```bash
cd frontend
npm install
echo "REACT_APP_API_URL=http://localhost:3001" > .env
npm start
```

✅ Frontend: `http://localhost:3000`

### 4. Войти в систему

```
Логин: IgorL
Пароль: Director123!
```

---

## Production на VPS (10 минут)

### 1. Подготовка сервера

```bash
ssh root@195.26.226.37

# Установка Node.js и PM2
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs
npm install -g pm2
```

### 2. Backend

```bash
cd /var/www
git clone https://github.com/Igor1618/transport-dashboard-system.git tl196-api
cd tl196-api/backend

npm install --production

cat > .env << 'EOF'
PORT=3001
NODE_ENV=production
DB_HOST=localhost
DB_PORT=5433
DB_NAME=postgres
DB_USER=postgres
DB_PASSWORD=5+NMkUPabjFbh5vGZtWx5ea0QAX2NSR3G1k0sfAedms=
EOF

pm2 start server.js --name tl196-api
pm2 save
pm2 startup
```

### 3. Frontend

```bash
cd /var/www/tl196
git clone https://github.com/Igor1618/transport-dashboard-system.git temp
cd temp/frontend

npm install
npm run build
cp -r build/* /var/www/tl196/
cd ../..
rm -rf temp
```

### 4. Nginx

```bash
cat > /etc/nginx/sites-available/tl196.ru << 'EOF'
server {
    listen 443 ssl http2;
    server_name tl196.ru;

    ssl_certificate /etc/letsencrypt/live/tl196.ru/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/tl196.ru/privkey.pem;

    root /var/www/tl196;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://localhost:3001/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}

server {
    listen 80;
    server_name tl196.ru;
    return 301 https://$server_name$request_uri;
}
EOF

ln -sf /etc/nginx/sites-available/tl196.ru /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

### 5. Проверка

```bash
# Backend health check
curl http://localhost:3001/health

# Frontend
curl https://tl196.ru
```

✅ Готово! `https://tl196.ru`

---

## Проверка работоспособности

### Backend API

```bash
# Health check
curl http://localhost:3001/health

# Авторизация
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"IgorL","password":"Director123!"}'

# Статистика
curl http://localhost:3001/stats
```

### База данных

```bash
# Подключение
PGPASSWORD='5+NMkUPabjFbh5vGZtWx5ea0QAX2NSR3G1k0sfAedms=' \
psql -h localhost -p 5433 -U postgres -d postgres

# Проверка таблиц
\dt

# Проверка пользователей
SELECT * FROM users;

# Выход
\q
```

### PM2 мониторинг

```bash
pm2 status
pm2 logs tl196-api
pm2 monit
```

---

## Частые команды

### Перезапуск сервисов

```bash
# Backend
pm2 restart tl196-api

# Frontend (пересборка)
cd /var/www/tl196/frontend && npm run build && cp -r build/* /var/www/tl196/

# Nginx
systemctl reload nginx
```

### Обновление кода

```bash
# Backend
cd /var/www/tl196-api
git pull
cd backend && npm install
pm2 restart tl196-api

# Frontend
cd /var/www/tl196
git pull
cd frontend && npm install && npm run build
cp -r build/* /var/www/tl196/
```

### Логи

```bash
# Backend PM2
pm2 logs tl196-api

# Nginx
tail -f /var/log/nginx/tl196-error.log

# База данных
sudo journalctl -u postgresql -f
```

---

## Troubleshooting

### Backend не запускается

```bash
pm2 logs tl196-api --lines 50
cd /var/www/tl196-api/backend && npm install
pm2 restart tl196-api
```

### Frontend белый экран

```bash
# Проверить build
ls -la /var/www/tl196/
# Должен быть index.html

# Пересобрать
cd /var/www/tl196/frontend
npm run build
cp -r build/* /var/www/tl196/
```

### База данных недоступна

```bash
# Проверить статус PostgreSQL
systemctl status postgresql

# Проверить подключение
PGPASSWORD='5+NMkUPabjFbh5vGZtWx5ea0QAX2NSR3G1k0sfAedms=' \
psql -h localhost -p 5433 -U postgres -d postgres -c "SELECT version();"
```

### API возвращает 502

```bash
# Проверить Backend
pm2 status
curl http://localhost:3001/health

# Проверить Nginx
nginx -t
systemctl status nginx
```

---

## Полезные ссылки

- 📖 [Полная документация](./PROJECT_README.md)
- 🚀 [Руководство по развертыванию](./DEPLOYMENT.md)
- 🗄️ [Схема базы данных](./database/schema.sql)
- 🌐 [Production сайт](https://tl196.ru)

---

**Версия:** 2.0
**Статус:** Production Ready ✅
