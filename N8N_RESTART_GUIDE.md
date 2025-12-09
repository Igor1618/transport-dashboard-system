# Инструкция по перезапуску и настройке n8n

## Где находится n8n

**URL**: https://n8n1618ru.ru
**Сервер**: 95.26.226.37

## Как перезапустить n8n

### 1. Подключитесь к серверу

```bash
ssh root@95.26.226.37
```

### 2. Найдите процесс n8n

Попробуйте разные способы:

**Вариант A: Если n8n запущен через Docker**
```bash
# Посмотреть все контейнеры
docker ps -a | grep n8n

# Перезапустить контейнер
docker restart <container_id>

# Или остановить и запустить заново
docker stop <container_id>
docker start <container_id>
```

**Вариант B: Если n8n запущен через PM2**
```bash
# Посмотреть список процессов
pm2 list

# Перезапустить n8n
pm2 restart n8n

# Или остановить и запустить заново
pm2 stop n8n
pm2 start n8n
```

**Вариант C: Если n8n запущен через systemd**
```bash
# Проверить статус
systemctl status n8n

# Перезапустить
systemctl restart n8n

# Или остановить и запустить заново
systemctl stop n8n
systemctl start n8n
```

**Вариант D: Если n8n запущен вручную**
```bash
# Найти процесс
ps aux | grep n8n

# Убить процесс
kill -9 <PID>

# Запустить заново (обычно из домашней директории)
cd ~ && n8n start &
```

### 3. Проверьте, что n8n запустился

```bash
# Проверить процесс
ps aux | grep n8n

# Проверить порт (n8n обычно на порту 5678)
netstat -tlnp | grep 5678

# Или через ss
ss -tlnp | grep 5678
```

### 4. Проверьте логи

**Docker:**
```bash
docker logs <container_id>
```

**PM2:**
```bash
pm2 logs n8n
```

**systemd:**
```bash
journalctl -u n8n -f
```

### 5. Проверьте доступность через браузер

Откройте: https://n8n1618ru.ru

Если видите ошибку 502 Bad Gateway:
- n8n не запущен
- nginx не может подключиться к n8n
- проверьте конфигурацию nginx

Проверить конфигурацию nginx:
```bash
# Найти конфиг для n8n
grep -r "n8n1618ru.ru" /etc/nginx/

# Проверить синтаксис
nginx -t

# Перезапустить nginx если нужно
systemctl restart nginx
```

---

## Настройка workflow для синхронизации с 1C

### Шаг 1: Импортировать workflow

1. Откройте https://n8n1618ru.ru
2. Войдите в систему
3. Нажмите **Workflows** → **Import from File**
4. Выберите файл: `/home/user/transport-dashboard-system/database/n8n_workflow_1c_sync.json`
5. Нажмите **Import**

### Шаг 2: Создать учетные данные для 1C API

1. Перейдите в **Settings** → **Credentials**
2. Нажмите **Add Credential**
3. Выберите **HTTP Basic Auth**
4. Заполните:
   - **Credential Name**: `1C TransportAPI`
   - **User**: `TransportAPI`
   - **Password**: `TransportAPI_SecretPass`
5. Нажмите **Save**

### Шаг 3: Создать учетные данные для PostgreSQL

1. В **Settings** → **Credentials**
2. Нажмите **Add Credential**
3. Выберите **Postgres**
4. Заполните:
   - **Credential Name**: `TL196 PostgreSQL`
   - **Host**: `localhost`
   - **Port**: `5432`
   - **Database**: `postgres`
   - **User**: `postgres`
   - **Password**: `postgres123`
   - **SSL**: Off
5. Нажмите **Save**

### Шаг 4: Настроить узлы workflow

1. Откройте импортированный workflow "1C Data Sync"
2. Для каждого HTTP Request узла (GET: Vehicles, GET: Drivers, и т.д.):
   - Кликните на узел
   - В поле **Credential for Basic Auth** выберите `1C TransportAPI`
   - Сохраните
3. Для каждого Postgres узла:
   - Кликните на узел
   - В поле **Credential to connect with** выберите `TL196 PostgreSQL`
   - Сохраните

### Шаг 5: Активировать workflow

1. Убедитесь, что все узлы настроены
2. Нажмите **Active** (переключатель в верхнем правом углу)
3. Workflow будет запускаться автоматически каждый день в 2:00

### Шаг 6: Запустить вручную для теста

1. Нажмите **Execute Workflow**
2. Следите за выполнением
3. Проверьте, что данные появились в базе:

```bash
cd /home/user/transport-dashboard-system/backend
psql -U postgres -d postgres -c "SELECT COUNT(*) FROM vehicles;"
psql -U postgres -d postgres -c "SELECT COUNT(*) FROM drivers;"
psql -U postgres -d postgres -c "SELECT COUNT(*) FROM contracts;"
psql -U postgres -d postgres -c "SELECT COUNT(*) FROM driver_reports;"
```

---

## Альтернативный способ: Запуск без n8n

Если не хотите возиться с n8n, можете запускать синхронизацию вручную:

```bash
cd /home/user/transport-dashboard-system/backend
node scripts/sync-1c-data.js 2024-11
```

**Важно**: Скрипт должен запускаться на машине, которая имеет доступ к 1C API по адресу 192.168.33.250.

Если сервер 95.26.226.37 не имеет доступа к внутренней сети 1C, нужно:
1. Запустить скрипт с локальной машины, которая имеет доступ к 1C
2. Или настроить VPN/туннель между сервером и сетью 1C

---

## Проверка работоспособности

После настройки проверьте:

1. **Backend API работает:**
   ```bash
   curl http://localhost:3001/health
   ```

2. **Данные загружены:**
   ```bash
   curl http://localhost:3001/drivers | jq
   curl http://localhost:3001/contracts | jq
   curl http://localhost:3001/driver-reports | jq
   curl http://localhost:3001/analytics/dashboard | jq
   ```

3. **n8n доступен:**
   - Откройте https://n8n1618ru.ru
   - Проверьте статус workflow

---

## Полезные команды для диагностики

```bash
# Проверить PostgreSQL
systemctl status postgresql
pg_lsclusters

# Проверить backend
ps aux | grep node
netstat -tlnp | grep 3001

# Проверить n8n
ps aux | grep n8n
netstat -tlnp | grep 5678

# Проверить nginx
nginx -t
systemctl status nginx

# Посмотреть логи nginx
tail -f /var/log/nginx/error.log
tail -f /var/log/nginx/access.log
```

---

## Контакты для поддержки

Если возникнут проблемы:
1. Проверьте логи (см. команды выше)
2. Убедитесь, что все сервисы запущены
3. Проверьте подключение к 1C API (должна быть доступна сеть 192.168.33.250)
