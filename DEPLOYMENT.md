# 🚀 Руководство по развертыванию на VPS

## 📋 Предварительные требования

### Сервер
- **OS:** Ubuntu 20.04+ / Debian 11+
- **RAM:** Минимум 2GB
- **Диск:** Минимум 10GB свободного места
- **IP:** 195.26.226.37

### Установленное ПО
- nginx (веб-сервер)
- PHP 7.4+ с расширениями: php-fpm, php-pgsql, php-curl, php-json
- PostgreSQL 13+ (на порту 5433)
- Git
- Supabase (опционально, для REST API)

---

## 🔧 Подготовка сервера

### 1. Подключение к серверу

```bash
ssh root@195.26.226.37
```

### 2. Установка необходимого ПО

```bash
# Обновление системы
apt-get update && apt-get upgrade -y

# Установка nginx
apt-get install -y nginx

# Установка PHP
apt-get install -y php8.1-fpm php8.1-pgsql php8.1-curl php8.1-json php8.1-mbstring php8.1-xml

# Установка PostgreSQL клиента
apt-get install -y postgresql-client

# Установка Git
apt-get install -y git
```

### 3. Проверка PostgreSQL

```bash
# Проверить что PostgreSQL работает на порту 5433
psql -h 127.0.0.1 -p 5433 -U postgres -l

# Если база transport_dashboard не существует, создайте её:
createdb -h 127.0.0.1 -p 5433 -U postgres transport_dashboard
```

---

## 📦 Развертывание проекта

### Вариант 1: Автоматический деплой через скрипт

```bash
# Подключаемся к серверу
ssh root@195.26.226.37

# Переходим в директорию проекта
cd /var/www/html

# Клонируем репозиторий (если еще не склонирован)
git clone https://github.com/Igor1618/transport-dashboard-system.git .

# Запускаем скрипт деплоя
bash deploy.sh
```

### Вариант 2: Ручная установка

```bash
# 1. Создание директории проекта
mkdir -p /var/www/html
cd /var/www/html

# 2. Клонирование репозитория
git clone https://github.com/Igor1618/transport-dashboard-system.git .

# 3. Настройка прав доступа
chown -R www-data:www-data /var/www/html
chmod -R 755 /var/www/html

# 4. Копирование конфигурации nginx
cp nginx-site.conf /etc/nginx/sites-available/transport-dashboard
ln -s /etc/nginx/sites-available/transport-dashboard /etc/nginx/sites-enabled/

# 5. Проверка конфигурации nginx
nginx -t

# 6. Настройка .env файла
cp .env.production .env
nano .env  # Отредактируйте параметры

# 7. Создание таблиц в базе данных
psql -h 127.0.0.1 -p 5433 -U postgres -d transport_dashboard -f database-setup.sql

# 8. Перезагрузка сервисов
systemctl reload php8.1-fpm
systemctl reload nginx

# 9. Проверка
curl http://localhost/index.html
```

---

## 🗄️ Настройка базы данных

### 1. Подключение к PostgreSQL

```bash
psql -h 127.0.0.1 -p 5433 -U postgres -d transport_dashboard
```

### 2. Применение миграций

```bash
# Из директории проекта
psql -h 127.0.0.1 -p 5433 -U postgres -d transport_dashboard -f database-setup.sql
```

### 3. Проверка таблиц

```sql
-- В psql консоли
\dt

-- Должны быть созданы таблицы:
-- - vehicles
-- - drivers
-- - vehicle_monthly_data
-- - driver_monthly_data
```

### 4. Вставка тестовых данных (опционально)

```sql
-- Раскомментируйте секцию с тестовыми данными в database-setup.sql
-- Или выполните вручную:

INSERT INTO vehicles (number, model, brand, year, status) VALUES
('А123БВ77', 'TGX', 'MAN', 2020, 'active'),
('В456ГД78', 'Actros', 'Mercedes-Benz', 2021, 'active');
```

---

## 🔄 Настройка автоматического деплоя (GitHub Actions)

### 1. Добавление SSH ключа в GitHub

```bash
# На сервере генерируем SSH ключ (если нет)
ssh-keygen -t ed25519 -C "deploy@transport-dashboard"

# Копируем публичный ключ в authorized_keys
cat ~/.ssh/id_ed25519.pub >> ~/.ssh/authorized_keys

# Копируем приватный ключ (он будет добавлен в GitHub Secrets)
cat ~/.ssh/id_ed25519
```

### 2. Настройка GitHub Secrets

1. Откройте репозиторий на GitHub
2. Перейдите: Settings → Secrets and variables → Actions
3. Добавьте секрет:
   - **Name:** `SSH_PRIVATE_KEY`
   - **Value:** содержимое файла `~/.ssh/id_ed25519` (приватный ключ)

### 3. Проверка автодеплоя

После push в ветку `main` автоматически запустится деплой:

```bash
git add .
git commit -m "Update dashboard"
git push origin main
```

Следите за прогрессом в Actions вкладке GitHub.

---

## 🔐 Настройка HTTPS (опционально)

### Использование Let's Encrypt

```bash
# Установка certbot
apt-get install -y certbot python3-certbot-nginx

# Получение SSL сертификата
certbot --nginx -d transport-dashboard.yourdomain.com

# Автоматическое обновление сертификата
certbot renew --dry-run
```

### Обновление nginx конфига

Раскомментируйте HTTPS секцию в `nginx-site.conf`:

```nginx
server {
    listen 443 ssl http2;
    server_name 195.26.226.37;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # ... остальные настройки
}
```

---

## 🔄 Синхронизация с 1С

### 1. Настройка cron для автоматической синхронизации

```bash
# Открыть crontab
crontab -e

# Добавить задачу (синхронизация каждый день в 3:00)
0 3 * * * cd /var/www/html && php sync-1c-to-supabase.php >> /var/log/sync-1c.log 2>&1
```

### 2. Ручной запуск синхронизации

```bash
cd /var/www/html
php sync-1c-to-supabase.php 2024-11-01 2024-11-30
```

### 3. Проверка логов синхронизации

```bash
tail -f /var/log/sync-1c.log
```

---

## 🐛 Решение проблем

### Сайт не открывается

```bash
# Проверить статус nginx
systemctl status nginx

# Проверить логи nginx
tail -f /var/log/nginx/transport-dashboard-error.log

# Проверить права доступа
ls -la /var/www/html/

# Проверить конфигурацию nginx
nginx -t
```

### PHP скрипты не выполняются

```bash
# Проверить статус PHP-FPM
systemctl status php8.1-fpm

# Проверить логи PHP
tail -f /var/log/php8.1-fpm.log

# Перезапустить PHP-FPM
systemctl restart php8.1-fpm
```

### База данных недоступна

```bash
# Проверить подключение к PostgreSQL
psql -h 127.0.0.1 -p 5433 -U postgres -l

# Проверить статус Supabase (если используется)
systemctl status supabase

# Проверить логи PostgreSQL
tail -f /var/log/postgresql/postgresql-13-main.log
```

### Данные не отображаются в дашборде

1. Откройте браузер DevTools (F12)
2. Перейдите на вкладку Console
3. Проверьте ошибки JavaScript
4. Проверьте Network вкладку для ошибок API

```bash
# Проверить подключение к Supabase
curl http://127.0.0.1:8000/rest/v1/vehicles \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

---

## 📊 Мониторинг

### Проверка работоспособности

```bash
# Проверка доступности сайта
curl -I http://195.26.226.37

# Проверка API Supabase
curl http://127.0.0.1:8000/rest/v1/

# Проверка PostgreSQL
psql -h 127.0.0.1 -p 5433 -U postgres -d transport_dashboard -c "SELECT COUNT(*) FROM vehicles;"
```

### Логи

```bash
# Логи nginx (доступ)
tail -f /var/log/nginx/transport-dashboard-access.log

# Логи nginx (ошибки)
tail -f /var/log/nginx/transport-dashboard-error.log

# Логи PHP
tail -f /var/log/php8.1-fpm.log

# Логи PostgreSQL
tail -f /var/log/postgresql/postgresql-13-main.log

# Логи синхронизации 1С
tail -f /var/log/sync-1c.log
```

### Полезные команды

```bash
# Перезагрузка nginx
systemctl reload nginx

# Перезагрузка PHP-FPM
systemctl reload php8.1-fpm

# Проверка портов
netstat -tulpn | grep -E '(80|443|5433|8000)'

# Использование диска
df -h

# Использование памяти
free -h

# Процессы
top
htop
```

---

## 🔄 Обновление проекта

### Через GitHub Actions (автоматически)

Просто сделайте push в ветку `main`:

```bash
git push origin main
```

### Вручную

```bash
ssh root@195.26.226.37
cd /var/www/html
git pull origin main
bash deploy.sh
```

---

## 🔐 Безопасность

### Рекомендации

1. **Измените пароли:**
   - PostgreSQL пользователь
   - Supabase ключи
   - SSH ключи

2. **Настройте файрвол:**
   ```bash
   ufw allow 22/tcp    # SSH
   ufw allow 80/tcp    # HTTP
   ufw allow 443/tcp   # HTTPS
   ufw enable
   ```

3. **Ограничьте доступ к PostgreSQL:**
   - Разрешите подключения только с localhost
   - В `/etc/postgresql/13/main/pg_hba.conf`:
     ```
     host    all    all    127.0.0.1/32    md5
     ```

4. **Регулярно обновляйте систему:**
   ```bash
   apt-get update && apt-get upgrade -y
   ```

5. **Настройте бэкапы базы данных:**
   ```bash
   # Добавьте в cron
   0 2 * * * pg_dump -h 127.0.0.1 -p 5433 -U postgres transport_dashboard > /backup/db_$(date +\%Y\%m\%d).sql
   ```

---

## 📞 Поддержка

При возникновении проблем:

1. Проверьте логи (см. секцию "Мониторинг")
2. Убедитесь что все сервисы запущены
3. Проверьте права доступа к файлам
4. Проверьте конфигурацию nginx и PHP

---

## 🎉 Готово!

После успешного развертывания:

- **Дашборд:** http://195.26.226.37
- **Supabase REST API:** http://195.26.226.37:8000
- **Директория проекта:** /var/www/html

Следующие шаги:
1. Настройте синхронизацию с 1С
2. Добавьте реальные данные
3. Настройте мониторинг
4. Настройте HTTPS (рекомендуется)

**Удачного использования! 🚀**
