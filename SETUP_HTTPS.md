# Настройка HTTPS для tl196.ru

## Шаг 1: Установка Certbot

Подключитесь к серверу:
```bash
ssh root@195.26.226.37
```

Установите Certbot и плагин для Nginx:
```bash
apt update
apt install certbot python3-certbot-nginx -y
```

## Шаг 2: Проверка конфигурации Nginx

Убедитесь, что в конфиге Nginx указан правильный server_name:
```bash
nano /etc/nginx/sites-available/tl196
```

Должно быть:
```nginx
server {
    listen 80;
    server_name tl196.ru www.tl196.ru;

    # ... остальная конфигурация
}
```

Проверьте синтаксис:
```bash
nginx -t
```

## Шаг 3: Получение SSL сертификата

Запустите Certbot (он автоматически настроит Nginx):
```bash
certbot --nginx -d tl196.ru -d www.tl196.ru
```

При первом запуске Certbot спросит:
1. Email для уведомлений - введите свой email
2. Согласие с условиями - согласитесь (Y)
3. Подписка на новости - можете отказаться (N)

Certbot автоматически:
- Получит сертификат от Let's Encrypt
- Настроит Nginx для HTTPS
- Настроит автоматическое перенаправление с HTTP на HTTPS

## Шаг 4: Проверка автообновления

Сертификаты Let's Encrypt действуют 90 дней. Certbot настроит автообновление.

Проверьте, что автообновление работает:
```bash
certbot renew --dry-run
```

## Шаг 5: Проверка работы HTTPS

Откройте в браузере:
- https://tl196.ru
- http://tl196.ru (должно перенаправить на https)

## Проблемы и решения

### Если порт 80 закрыт:
Убедитесь, что файрвол разрешает порты 80 и 443:
```bash
ufw allow 80
ufw allow 443
ufw reload
```

### Если домен не резолвится:
Проверьте DNS записи:
```bash
dig tl196.ru
nslookup tl196.ru
```

Должны быть A-записи, указывающие на IP сервера (195.26.226.37)

### Проверка статуса сертификата:
```bash
certbot certificates
```

## После успешной настройки

1. Обновите все ссылки в приложении на HTTPS
2. Проверьте работу API через HTTPS
3. Убедитесь, что нет смешанного контента (mixed content)

## Итоговая конфигурация Nginx

После работы Certbot конфиг будет выглядеть так:
```nginx
server {
    listen 80;
    server_name tl196.ru www.tl196.ru;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name tl196.ru www.tl196.ru;

    ssl_certificate /etc/letsencrypt/live/tl196.ru/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/tl196.ru/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    root /var/www/tl196;
    index index.html;

    # API проксирование
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Frontend
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```
