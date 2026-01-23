# WB Tender Sniper - Fast API Client

Быстрый HTTP-клиент для WB Logistics API, обходящий защиту от ботов.

## Проблема

WB Logistics использует многоуровневую защиту:
- Cookies привязаны к fingerprint браузера
- Простые HTTP запросы возвращают HTML страницу логина
- Selenium/Chrome детектится как бот

## Решение

1. Используем Firefox в VNC контейнере (уже авторизован)
2. Перехватываем реальные API запросы через mitmproxy
3. Воспроизводим эти запросы через Python httpx

## Быстрый старт

### 1. Скопировать на сервер

```bash
ssh root@83.217.212.221
cd /root
git clone <repo> wb-sniper
# или скопировать файлы
```

### 2. Запустить настройку

```bash
cd /root/wb-sniper
chmod +x run_capture.sh
./run_capture.sh
```

### 3. Перехватить запросы (в VNC контейнере)

```bash
# Войти в контейнер
docker exec -it vnc bash

# Запустить mitmproxy с веб-интерфейсом
mitmweb --mode regular --listen-port 8080 \
        -s /config/capture_requests.py \
        --web-host 0.0.0.0 --web-port 8081
```

### 4. Настроить Firefox в VNC

1. Открыть VNC: http://83.217.212.221:6080 (пароль: wb123)
2. В Firefox: about:preferences#privacy -> Certificates -> View Certificates
3. Import: `/root/.mitmproxy/mitmproxy-ca-cert.pem`
4. Отметить "Trust this CA to identify websites"
5. Перейти на https://logistics.wildberries.ru/tenders

### 5. Проанализировать перехваченные запросы

```bash
# Скопировать данные из контейнера
docker cp vnc:/config/wb_requests.json /root/wb-sniper/data/

# Запустить анализ
python3 /root/wb-sniper/api/auto_config.py /root/wb-sniper/data/wb_requests.json
```

### 6. Обновить API клиент

Посмотреть найденные endpoints в отчёте и обновить `api/wb_client.py`:

```python
ENDPOINTS = {
    "tenders_list": "/api/v1/xxx/tenders",  # Реальный путь из mitmproxy
    "place_bid": "/api/v1/xxx/bid",          # Реальный путь из mitmproxy
}
```

### 7. Использовать API клиент

```python
from api.wb_client import WBLogisticsAPI

# Загрузить токены из Firefox
client = WBLogisticsAPI.from_tokens_file("/root/wb-sniper/data/tokens.json")

# Тест подключения
result = client.test_connection()
print(result)

# Получить тендеры
tenders = client.get_tenders()
print(f"Время: {client.last_request_time:.0f}ms")

# Разместить ставку
result = client.place_bid("tender-123", price=1000)
```

## Структура файлов

```
wb-sniper/
├── api/
│   ├── __init__.py
│   ├── wb_client.py      # Основной API клиент
│   └── auto_config.py    # Автоанализ захваченных запросов
├── mitmproxy/
│   └── capture_requests.py  # Addon для перехвата
├── scripts/
│   ├── setup_mitmproxy.sh   # Установка в VNC
│   └── extract_tokens.py    # Извлечение токенов из Firefox
├── data/                    # Данные (tokens, captures)
├── run_capture.sh           # Быстрый старт
├── requirements.txt
└── README.md
```

## Порты

- VNC (Firefox): http://83.217.212.221:6080
- mitmproxy web: http://83.217.212.221:8081 (после запуска)

## Токены

### Извлечь токены из Firefox:

```bash
python3 scripts/extract_tokens.py
```

Результат в `/root/wb-sniper/data/tokens.json`:
- `x_wbaas_token` - JWT cookie
- `_wbauid` - User ID
- `accessToken` - Bearer token (из localStorage)
- `refreshToken` - Refresh token

## Troubleshooting

### mitmproxy не видит HTTPS

Firefox не доверяет сертификату mitmproxy:
1. В Firefox: about:preferences#privacy
2. Certificates -> View Certificates -> Authorities -> Import
3. Выбрать `/root/.mitmproxy/mitmproxy-ca-cert.pem`
4. Отметить "Trust for websites"

### Запросы возвращают HTML вместо JSON

Токены expired или неправильные headers. Нужно:
1. Перезайти в WB Logistics в Firefox
2. Заново извлечь токены: `python3 scripts/extract_tokens.py`
3. Проверить headers в mitmproxy capture

### Нет файла cookies.sqlite

Firefox запущен и держит блокировку. Закрыть Firefox в VNC перед извлечением.

## Performance Target

- GET tenders: ~50-100ms
- POST bid: ~50-100ms

Текущий Selenium: ~2000-5000ms
