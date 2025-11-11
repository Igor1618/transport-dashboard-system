# ⚡ Quick Start - Быстрый старт

## 🚀 Развертывание за 5 минут

### На VPS (195.26.226.37)

```bash
# 1. Подключаемся к серверу
ssh root@195.26.226.37

# 2. Клонируем проект
cd /var/www/html
git clone https://github.com/Igor1618/transport-dashboard-system.git .

# 3. Запускаем деплой
bash deploy.sh

# 4. Создаем таблицы в базе
psql -h 127.0.0.1 -p 5433 -U postgres -d transport_dashboard -f database-setup.sql

# 5. Готово! Открываем в браузере:
# http://195.26.226.37
```

---

## 📊 Синхронизация с 1С

```bash
# 1. Проверяем подключение к API 1С (запускать из локальной сети!)
php test-1c-connection.php

# 2. Запускаем синхронизацию
php sync-1c-to-supabase.php 2024-11-01 2024-11-30

# 3. Открываем дашборд и проверяем данные
# http://195.26.226.37
```

---

## 🔄 Автоматическая синхронизация

```bash
# Добавляем в cron (на сервере)
crontab -e

# Синхронизация каждый день в 3:00
0 3 * * * cd /var/www/html && php sync-1c-to-supabase.php >> /var/log/sync-1c.log 2>&1
```

---

## 📝 Структура проекта

```
transport-dashboard-system/
├── index.html                 # 🌐 Главная страница дашборда
├── sync-1c-to-supabase.php   # 🔄 Скрипт синхронизации (PHP)
├── sync-1c-to-supabase.js    # 🔄 Скрипт синхронизации (Node.js)
├── test-1c-connection.php    # 🧪 Тест подключения к API 1С
├── deploy.sh                  # 🚀 Скрипт деплоя
├── database-setup.sql         # 🗄️ SQL скрипт создания таблиц
├── nginx-site.conf            # ⚙️ Конфигурация nginx
├── .env.example               # 📋 Пример конфигурации
├── .env.production            # 📋 Продакшен конфигурация
├── SYNC_GUIDE.md              # 📖 Полная документация по синхронизации
└── DEPLOYMENT.md              # 📖 Полная документация по деплою
```

---

## 🔗 API Эндпоинты 1С

| Эндпоинт | Описание | Параметры |
|----------|----------|-----------|
| `/api/v1/vehicles` | Транспортные средства | - |
| `/api/v1/drivers` | Водители | - |
| `/api/v1/contracts` | Договор-заявки | `date_from`, `date_to` |
| `/api/v1/driver-reports` | Отчеты водителей | `date_from`, `date_to` |

**Авторизация:** Bearer `transport_api_2024_secret_key`

---

## 📊 Таблицы БД

| Таблица | Описание |
|---------|----------|
| `vehicles` | Транспортные средства |
| `drivers` | Водители |
| `vehicle_monthly_data` | Месячные данные по машинам |
| `driver_monthly_data` | Месячные данные по водителям |

---

## 🛠️ Полезные команды

### На сервере

```bash
# Обновить код
cd /var/www/html && git pull origin main

# Перезагрузить nginx
systemctl reload nginx

# Проверить логи
tail -f /var/log/nginx/transport-dashboard-error.log
tail -f /var/log/sync-1c.log

# Проверить базу данных
psql -h 127.0.0.1 -p 5433 -U postgres -d transport_dashboard -c "SELECT COUNT(*) FROM vehicles;"
```

### Локально

```bash
# Запустить тестовый сервер
php -S localhost:8000

# Или
python -m http.server 8000

# Открыть: http://localhost:8000
```

---

## 🐛 Решение проблем

### Сайт не открывается
```bash
systemctl status nginx
nginx -t
```

### PHP не работает
```bash
systemctl status php8.1-fpm
systemctl restart php8.1-fpm
```

### База данных недоступна
```bash
psql -h 127.0.0.1 -p 5433 -U postgres -l
```

### API 1С недоступен
- Проверьте что запускаете с локальной сети (192.168.x.x)
- Проверьте токен авторизации
- Запустите: `php test-1c-connection.php`

---

## 📖 Полная документация

- **[SYNC_GUIDE.md](SYNC_GUIDE.md)** - Подробная инструкция по синхронизации
- **[DEPLOYMENT.md](DEPLOYMENT.md)** - Подробная инструкция по деплою
- **[README.md](README.md)** - Основная документация проекта

---

## 🎉 Готово!

Дашборд доступен по адресу: **http://195.26.226.37**

Следующие шаги:
1. ✅ Сайт развернут
2. ⏳ Настроить синхронизацию с 1С
3. ⏳ Добавить реальные данные
4. ⏳ Настроить автоматическую синхронизацию (cron)
5. ⏳ Настроить HTTPS (опционально)

**Удачи! 🚀**
