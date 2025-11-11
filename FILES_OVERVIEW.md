# 📁 Обзор файлов проекта

## 🌐 Frontend (Дашборд)

| Файл | Описание | Размер |
|------|----------|--------|
| `index.html` | Главная страница дашборда с Supabase | 25 KB |
| `dashboard-*.html` | Альтернативные версии дашборда | ~23 KB |

## 🔄 Синхронизация с 1С

| Файл | Описание | Язык |
|------|----------|------|
| `sync-1c-to-supabase.php` | Основной скрипт синхронизации | PHP (327 строк) |
| `sync-1c-to-supabase.js` | Альтернативная версия | Node.js (307 строк) |
| `test-1c-connection.php` | Тест подключения к API 1С | PHP (116 строк) |

**Что делают:**
- Забирают данные из API 1С (vehicles, drivers, contracts)
- Группируют по месяцам
- Рассчитывают KPI (доход, расход, прибыль, эффективность)
- Загружают в Supabase PostgreSQL

## 🚀 Деплой на VPS

| Файл | Описание | Размер |
|------|----------|--------|
| `deploy.sh` | Автоматический скрипт развертывания | 7.3 KB |
| `nginx-site.conf` | Конфигурация nginx | 3.1 KB |
| `.github/workflows/deploy.yml` | GitHub Actions автодеплой | ~1 KB |
| `.env.production` | Продакшен конфигурация | <1 KB |
| `.env.example` | Пример конфигурации | <1 KB |

**deploy.sh делает:**
1. Проверяет системные требования (nginx, PHP, PostgreSQL)
2. Обновляет код из git
3. Настраивает права доступа
4. Копирует конфиг nginx
5. Применяет SQL миграции (опционально)
6. Перезагружает сервисы

## 🗄️ База данных

| Файл | Описание | Размер |
|------|----------|--------|
| `database-setup.sql` | SQL скрипт создания таблиц | 11 KB |

**Создает таблицы:**
- `vehicles` - транспортные средства
- `drivers` - водители
- `vehicle_monthly_data` - месячные данные по машинам
- `driver_monthly_data` - месячные данные по водителям

**Особенности:**
- Row Level Security (RLS)
- Политики доступа
- Триггеры для updated_at
- Индексы для быстрого поиска
- Constraints для валидации

## 📖 Документация

| Файл | Описание | Строк |
|------|----------|-------|
| `QUICKSTART.md` | Быстрый старт за 5 минут | ~180 |
| `DEPLOYMENT.md` | Полное руководство по деплою | ~400 |
| `SYNC_GUIDE.md` | Полное руководство по синхронизации | ~354 |
| `README.md` | Основная документация проекта | ~175 |
| `README-PRODUCTION.md` | Production гайд | ~100 |

## 🛠️ API & Backend

| Файл | Описание |
|------|----------|
| `enhanced-coordinator-v2.php` | API Gateway | 18 KB |
| `export-csv.php` | Экспорт данных в CSV | 8.9 KB |
| `.htaccess` | Конфигурация Apache | - |

## 🎨 Другие HTML страницы

| Файл | Описание |
|------|----------|
| `kpi-service-v2*.html` | Модуль KPI показателей |
| `vehicles-service-v2*.html` | Модуль управления транспортом |
| `drivers-service-v2*.html` | Модуль водителей |
| `charts-service-v2*.html` | Модуль графиков и аналитики |
| `analytics-service-v2.html` | Модуль аналитики |

---

## 📊 Статистика проекта

**Всего файлов:** ~50+

**Строк кода:**
- PHP: ~800
- JavaScript: ~500
- SQL: ~300
- HTML/CSS: ~5000
- Документация: ~1100

**Итого:** ~7700 строк кода

---

## 🔗 Связи между файлами

```
index.html
    ↓
    ├─→ Supabase Client (CDN)
    ├─→ Chart.js (CDN)
    └─→ Supabase PostgreSQL (127.0.0.1:8000)
            ↑
            │
    sync-1c-to-supabase.php
            ↑
            │
    API 1С (192.168.33.250)
```

---

## 🎯 Какой файл использовать?

### Для локальной разработки:
```bash
# Просто открой в браузере:
index.html

# Или запусти сервер:
php -S localhost:8000
```

### Для синхронизации с 1С:
```bash
# Тест подключения:
php test-1c-connection.php

# Синхронизация:
php sync-1c-to-supabase.php 2024-11-01 2024-11-30
```

### Для деплоя на VPS:
```bash
# Автоматический деплой:
bash deploy.sh

# Или через GitHub Actions:
git push origin main
```

### Для работы с БД:
```bash
# Создание таблиц:
psql -h 127.0.0.1 -p 5433 -U postgres -d transport_dashboard -f database-setup.sql

# Проверка:
psql -h 127.0.0.1 -p 5433 -U postgres -d transport_dashboard -c "SELECT COUNT(*) FROM vehicles;"
```

---

## 📝 Шпаргалка команд

```bash
# ЛОКАЛЬНО
php -S localhost:8000              # Запустить сервер
open http://localhost:8000         # Открыть в браузере

# СИНХРОНИЗАЦИЯ (из локальной сети!)
php test-1c-connection.php         # Тест API
php sync-1c-to-supabase.php        # Синхронизация

# НА СЕРВЕРЕ (195.26.226.37)
ssh root@195.26.226.37             # Подключиться
bash deploy.sh                     # Развернуть проект
systemctl reload nginx             # Перезагрузить nginx
tail -f /var/log/nginx/*.log       # Смотреть логи

# GIT
git add -A                         # Добавить все файлы
git commit -m "Update"             # Закоммитить
git push origin main               # Запушить (автодеплой)
```

---

## 🎉 Готово!

Все файлы задокументированы и готовы к использованию.

Для быстрого старта читай: **QUICKSTART.md**
