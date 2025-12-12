# Backend синхронизации 1C → PostgreSQL

## Проблема с портом (РЕШЕНИЕ)

### Причина проблемы

Библиотека `pg` (node-postgres) автоматически читает переменные окружения:
- `PGPORT` - порт PostgreSQL
- `PGHOST` - хост
- `PGUSER` - пользователь
- `PGPASSWORD` - пароль
- `PGDATABASE` - база данных

**Эти переменные ПЕРЕОПРЕДЕЛЯЮТ значения, переданные в конструктор `new Pool()`!**

Если на сервере установлена `PGPORT=5432` (например в `/etc/environment`, `~/.bashrc` или системно), то даже жёстко прописанный `port: 5433` будет проигнорирован.

### Решение

В начале скрипта **удаляем** эти переменные:

```javascript
// ОБЯЗАТЕЛЬНО в начале файла, ДО require('pg')!
['PGPORT', 'PGHOST', 'PGUSER', 'PGPASSWORD', 'PGDATABASE'].forEach(key => {
  delete process.env[key];
});

const { Pool } = require('pg');
```

## Запуск

### 1. Диагностика (выявление проблемы)

```bash
cd /var/www/transport-dashboard-system/backend
npm install
node scripts/diagnose-db-connection.js
```

Этот скрипт покажет:
- Какие PG* переменные установлены
- Какие .env файлы найдены
- Какие sync*.js файлы существуют
- Какие сервисы слушают порты 5432/5433
- Реальный тест подключения

### 2. Синхронизация данных

```bash
node scripts/sync-1c-data.js
```

Или через npm:

```bash
npm run sync
```

### 3. Быстрый тест подключения

```bash
npm run test-db
```

## Как найти где установлена PGPORT

```bash
# Проверить текущие переменные
env | grep PG

# Поиск в системных файлах
grep -r "PGPORT" /etc/environment /etc/profile /etc/profile.d/ ~/.bashrc ~/.bash_profile ~/.profile 2>/dev/null

# Проверить в Docker
docker exec -it supabase-db printenv | grep PG
```

## Структура проекта

```
backend/
├── .env                          # Конфигурация (НЕ используйте PG* переменные!)
├── package.json                  # Зависимости
├── README.md                     # Этот файл
└── scripts/
    ├── diagnose-db-connection.js # Диагностика проблем с подключением
    ├── sync-1c-data.js           # Главный скрипт синхронизации
    └── load-driver-reports-nov.js # Загрузка отчётов
```

## PostgreSQL Connection (Supabase Docker)

- **Host:** localhost
- **Port:** 5433 (НЕ 5432!)
- **Database:** postgres
- **User:** postgres
- **Password:** см. .env файл

## 1C API

- **URL:** http://192.168.33.250/tk/hs/TransportAPI/api/v1
- **Auth:** Basic Authentication
- **Доступ:** Только через VPN
