# TL196 Deployment Guide

## Архитектура

```
tl196.ru (nginx 443/80)
├── /* → frontend-v3 Next.js (127.0.0.1:3005)
├── /api/* → backend Express (127.0.0.1:3001)  
└── /rest/v1/* → supabase (127.0.0.1:8000)
```

## ⚠️ ВАЖНО — НЕ ТРОГАТЬ!

**ПРОДАКШН ФРОНТЕНД:**
- `/var/www/transport-dashboard-system/frontend-v3`
- Next.js 15, тёмная тема, Wildberries/РФ Транспорт
- PM2: `tl196-frontend` (порт 3005)

**СТАРЫЙ ФРОНТЕНД (не используется):**
- `/var/www/tl196/frontend` — Create React App, светлая тема
- ⛔ НЕ БИЛДИТЬ! `npm run build` там затрёт продакшн!

## PM2 команды

```bash
pm2 list                     # Статус
pm2 logs tl196-frontend      # Логи фронта
pm2 restart tl196-frontend   # Рестарт фронта
pm2 restart tl196-backend    # Рестарт бэка
```

## Деплой

### Frontend:
```bash
cd /var/www/transport-dashboard-system/frontend-v3
git pull
npm run build
pm2 restart tl196-frontend
```

### Backend:
```bash
cd /var/www/tl196/backend
git pull  
pm2 restart tl196-backend
```

## Если сломалось

```bash
# 1. Проверить Next.js
curl -I http://127.0.0.1:3005

# 2. Рестарт
pm2 restart tl196-frontend

# 3. Nginx
sudo systemctl reload nginx
```

---
Обновлено: 2026-01-29
