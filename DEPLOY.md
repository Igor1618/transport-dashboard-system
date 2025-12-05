# 🚀 Инструкция по деплою системы тарифов

## Что нового в этом обновлении

- ✅ **Новая страница "Тарифы"** - управление ставками водителей по маршрутам
- ✅ **Исправлен расчет зарплат** - теперь `зарплата = (рейсы × тариф) - штрафы`
- ✅ **Таблица `route_rates`** - хранит тарифы для каждого маршрута
- ✅ **API `/routes`** - CRUD операции с тарифами

---

## 🔧 Ручной деплой (пошагово)

### Шаг 1: Подключение к серверу

```bash
ssh root@195.26.226.37
# или
ssh your_user@195.26.226.37
```

### Шаг 2: Переход в директорию проекта

```bash
cd /var/www/transport-dashboard-system
# или ваш путь к проекту
```

### Шаг 3: Обновление кода

```bash
# Сохраняем текущую ветку (если нужно)
git branch --show-current

# Переключаемся на ветку с изменениями
git fetch origin
git checkout claude/russian-greeting-01LD5Vq3RZxdk6qvSMUQcfdz
git pull origin claude/russian-greeting-01LD5Vq3RZxdk6qvSMUQcfdz

# Проверяем что получили последний коммит
git log -1
# Должен быть: 486077e "✨ Добавлена система тарифов для расчета зарплат водителей"
```

### Шаг 4: Миграция базы данных

**ВАЖНО:** Это создаст новую таблицу `route_rates` и заполнит её существующими маршрутами

```bash
# Вариант 1: Если PostgreSQL на локалхосте
psql -h localhost -p 5433 -U postgres -d transport_dashboard -f database/add_route_rates.sql

# Вариант 2: Если нужен пароль
PGPASSWORD="ваш_пароль" psql -h localhost -p 5433 -U postgres -d transport_dashboard -f database/add_route_rates.sql

# Вариант 3: Интерактивно (введете пароль)
psql -h localhost -p 5433 -U postgres -d transport_dashboard
# Затем в psql:
# \i database/add_route_rates.sql
# \q
```

**Проверка миграции:**
```bash
psql -h localhost -p 5433 -U postgres -d transport_dashboard -c "SELECT COUNT(*) FROM route_rates;"
# Должно вернуть количество уникальных маршрутов
```

### Шаг 5: Обновление backend

```bash
cd backend

# Установка зависимостей (если добавились новые)
npm install --production

# Перезапуск через PM2
pm2 restart backend

# Или если процесс не существует:
pm2 start server.js --name backend

# Сохранить конфигурацию PM2
pm2 save

# Проверить статус
pm2 status
pm2 logs backend --lines 50
```

**Проверка backend:**
```bash
curl http://localhost:3001/health
# Ожидаем: {"status":"ok","timestamp":"..."}

curl http://localhost:3001/routes
# Ожидаем: массив маршрутов с тарифами
```

### Шаг 6: Обновление frontend

**Вариант A: Копирование готовой сборки с локальной машины**

На **локальной машине**:
```bash
cd /home/user/transport-dashboard-system/frontend
scp -r build/* root@195.26.226.37:/var/www/transport-dashboard-system/frontend/build/
```

**Вариант B: Сборка на сервере**
```bash
cd /var/www/transport-dashboard-system/frontend
npm install
npm run build
```

### Шаг 7: Настройка Nginx (если требуется)

Проверьте конфиг Nginx, убедитесь что он отдаёт статику из правильной директории:

```bash
cat /etc/nginx/sites-available/tl196.ru
# или
cat /etc/nginx/conf.d/tl196.conf
```

Должно быть примерно так:
```nginx
server {
    listen 80;
    server_name tl196.ru www.tl196.ru 195.26.226.37;

    # Frontend
    location / {
        root /var/www/transport-dashboard-system/frontend/build;
        try_files $uri /index.html;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Перезагрузка Nginx:
```bash
nginx -t  # Проверка конфига
systemctl reload nginx  # или: service nginx reload
```

### Шаг 8: Проверка работы

```bash
# Backend API
curl http://localhost:3001/health
curl http://localhost:3001/routes

# Frontend (откройте в браузере)
# http://tl196.ru
```

---

## 🚀 Автоматический деплой (скрипт)

На **локальной машине** запустите:

```bash
cd /home/user/transport-dashboard-system
chmod +x deploy.sh

# Отредактируйте переменные в начале скрипта под ваш сервер:
# - SERVER_IP
# - SERVER_USER
# - PROJECT_PATH

./deploy.sh
```

---

## ✅ Проверочный чеклист

После деплоя проверьте:

- [ ] Backend запущен: `pm2 status` показывает `online`
- [ ] API отвечает: `curl http://localhost:3001/health`
- [ ] Таблица создана: `psql ... -c "SELECT COUNT(*) FROM route_rates;"`
- [ ] Nginx работает: `systemctl status nginx`
- [ ] Сайт открывается: http://tl196.ru
- [ ] Страница логина работает
- [ ] После входа видна новая вкладка **"Тарифы"** в меню (иконка карты)
- [ ] Страница "Тарифы" загружается и показывает маршруты
- [ ] Страница "Зарплаты" показывает правильные суммы (на основе тарифов)

---

## 🐛 Решение проблем

### Проблема: "Таблица route_rates уже существует"

Это нормально, если запускаете миграцию повторно. SQL скрипт использует `CREATE TABLE IF NOT EXISTS`.

### Проблема: Backend не перезапускается

```bash
# Посмотреть логи
pm2 logs backend --lines 100

# Убить процесс и запустить заново
pm2 delete backend
cd /var/www/transport-dashboard-system/backend
pm2 start server.js --name backend
pm2 save
```

### Проблема: "Cannot GET /routes" (404)

Проверьте что:
1. Backend перезапущен после обновления кода
2. Файл `backend/routes/routes.js` существует
3. В `backend/server.js` есть строка: `app.use('/routes', routesRoutes);`

### Проблема: Страница "Тарифы" не открывается

```bash
# Убедитесь что frontend пересобран
cd frontend
npm run build

# Проверьте что файл RoutesPage.tsx существует
ls -la src/pages/RoutesPage.tsx
```

### Проблема: Зарплаты показывают 0 рублей

Это нормально, если маршруты ещё не связаны с тарифами.

Решение:
1. Откройте страницу "Тарифы"
2. Установите ставки для нужных маршрутов (например, 5000₽ за рейс)
3. Вернитесь на страницу "Зарплаты" - суммы обновятся

---

## 📊 Что изменилось в базе данных

### Новая таблица `route_rates`

```sql
CREATE TABLE route_rates (
  id SERIAL PRIMARY KEY,
  route_name VARCHAR(300) NOT NULL UNIQUE,
  rate_per_trip DECIMAL(10,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Автоматическое заполнение

Миграция автоматически добавит все существующие маршруты из таблицы `trips` с дефолтной ставкой 5000₽.

### Расчет зарплат (обновленный SQL)

**Было:**
```sql
SUM(trip_amount) - SUM(penalty_amount) as net_salary
```

**Стало:**
```sql
SUM(rr.rate_per_trip) - SUM(t.penalty_amount) as net_salary
FROM trips t
LEFT JOIN route_rates rr ON t.route_name = rr.route_name
```

---

## 🎯 Следующие шаги после деплоя

1. **Войдите в систему** под своим логином
2. **Откройте вкладку "Тарифы"** (новая иконка с картой в меню)
3. **Проверьте список маршрутов** - должны быть все маршруты из вашей базы
4. **Установите правильные ставки** для каждого маршрута:
   - Например: "Москва - Казань" = 5000₽
   - "Москва - СПб" = 3500₽
   - И так далее
5. **Проверьте зарплаты** - откройте вкладку "Зарплаты", суммы должны пересчитаться

---

## 📞 Контакты и поддержка

Если что-то не работает:
- Проверьте логи: `pm2 logs backend`
- Проверьте Nginx: `tail -f /var/log/nginx/error.log`
- Проверьте PostgreSQL: `tail -f /var/log/postgresql/postgresql-*.log`

---

**Версия системы:** 2.0 с системой тарифов
**Дата обновления:** 2025-12-04
**Ветка:** `claude/russian-greeting-01LD5Vq3RZxdk6qvSMUQcfdz`
**Коммит:** `486077e`
