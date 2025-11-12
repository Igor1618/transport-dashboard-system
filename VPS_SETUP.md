# 🚀 Быстрая настройка VPS

## Первый раз настраиваем VPS:

```bash
# Подключись к серверу
ssh root@195.26.226.37

# Скачай и запусти скрипт настройки
curl -sSL https://raw.githubusercontent.com/Igor1618/transport-dashboard-system/claude/explore-project-setup-011CV2KtJX9oLAaEqz7crj5G/vps-initial-setup.sh | bash
```

**ИЛИ вручную:**

```bash
ssh root@195.26.226.37

# Установка
apt-get update
apt-get install -y nginx git

# Клонирование проекта
mkdir -p /var/www/html/dashboard
cd /var/www/html/dashboard
git clone https://github.com/Igor1618/transport-dashboard-system.git .
git checkout claude/explore-project-setup-011CV2KtJX9oLAaEqz7crj5G

# Настройка nginx
cp nginx-site.conf /etc/nginx/sites-available/transport-dashboard
ln -sf /etc/nginx/sites-available/transport-dashboard /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Права доступа
chown -R www-data:www-data /var/www/html

# Перезагрузка
nginx -t
systemctl reload nginx
```

---

## После настройки:

Дашборд будет доступен по адресу:

🌐 **http://195.26.226.37/dashboard**

---

## Автодеплой:

Теперь любой `git push` автоматически обновит сайт! 🚀

Изменения появятся на сайте через 2-3 минуты после push.

---

## Проверка:

```bash
# Проверить что nginx работает
systemctl status nginx

# Проверить логи
tail -f /var/log/nginx/error.log

# Проверить что файлы на месте
ls -la /var/www/html/dashboard/
```
