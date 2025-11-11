# 🚛 Дашборд Транспортной Компании

> Компактный дашборд для управления транспортной компанией с микросервисной архитектурой

[![Demo](https://img.shields.io/badge/Demo-Live-brightgreen)](https://transport-dashboard-system.manus.im)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/Version-3.0-orange.svg)](CHANGELOG.md)

## 🎯 Особенности

### ✅ **Все данные видны без скроллбаров**
- **KPI блок:** 4 ключевых показателя с трендами
- **Транспорт блок:** 5 транспортных средств с эффективностью
- **Графики блок:** Динамика прибыли и структура расходов
- **Аналитика блок:** Умные инсайты и рекомендации
- **Водители блок:** 6 водителей с рейтингами и наградами

### 🎨 **Современный дизайн**
- Градиентный фон с blur эффектами
- Полупрозрачные блоки
- Компактная сетка 3x2
- Адаптивная верстка
- Минималистичный интерфейс

### ⚡ **Высокая производительность**
- Статический HTML/CSS/JS
- Минимальные зависимости
- Быстрая загрузка
- Responsive дизайн

## 🚀 Демо

**[🌐 Посмотреть живую демонстрацию](https://transport-dashboard-system.manus.im)**

## 🛠️ Технологии

- **Frontend:** HTML5, CSS3, JavaScript (ES6+)
- **Графики:** Chart.js
- **Backend:** PHP 7.4+ (опционально)
- **Архитектура:** Микросервисы
- **Стили:** CSS Grid, Flexbox, CSS Variables

## 📦 Установка

### Быстрый старт

```bash
# Клонировать репозиторий
git clone https://github.com/Igor1618/transport-dashboard-system.git

# Перейти в директорию
cd transport-dashboard-system

# Открыть в браузере
open index.html
```

### С веб-сервером

```bash
# Python
python -m http.server 8000

# PHP
php -S localhost:8000

# Node.js
npx serve .
```

## 🏗️ Структура проекта

```
transport-dashboard-system/
├── 📄 index.html                    # Главная страница (компактный дашборд)
├── 📄 dashboard-ultra-compact.html  # Резервная копия
├── 🔧 enhanced-coordinator-v2.php   # API Gateway
├── 📊 export-csv.php               # Экспорт данных
├── ⚙️ .htaccess                    # Настройки Apache
├── 📋 README.md                    # Документация
└── 📋 README-PRODUCTION.md         # Production гайд
```

## 📊 Данные

### KPI Показатели
- **Выручка:** 1 035 244 ₽ (+5.0%)
- **Расходы:** 754 134 ₽ (-6.0%)
- **Прибыль:** 281 110 ₽ (+4.0%)
- **Маржа:** 27.2% (0.0%)

### Транспортные средства
| Номер | Модель | Прибыль | Эффективность |
|-------|--------|---------|---------------|
| Н678МН78 | MAN TGX | 237 117 ₽ | 85% |
| М345КЛ77 | Mercedes Actros | 236 117 ₽ | 82% |
| К012ИЙ50 | Scania R500 | 235 117 ₽ | 80% |
| Е789ЖЗ99 | Volvo FH | 234 117 ₽ | 78% |
| В456ГД78 | DAF XF | 233 117 ₽ | 75% |

### Рейтинг водителей
1. 🥇 **Иванов А.С.** - 66 баллов
2. 🥈 **Петров В.И.** - 64 балла
3. 🥉 **Сидоров П.П.** - 62 балла
4. 4️⃣ **Козлов И.И.** - 60 баллов
5. 5️⃣ **Новиков С.А.** - 58 баллов
6. 6️⃣ **Морозов Д.В.** - 56 баллов

## 🔧 Настройка

### Синхронизация данных из 1С

Проект поддерживает автоматическую синхронизацию данных из 1С через API.

**Быстрый старт:**

```bash
# 1. Проверьте подключение к API 1С
php test-1c-connection.php

# 2. Запустите синхронизацию
php sync-1c-to-supabase.php

# Или с указанием периода
php sync-1c-to-supabase.php 2024-11-01 2024-11-30
```

**Подробная документация:** [SYNC_GUIDE.md](SYNC_GUIDE.md)

**Доступные API эндпоинты:**
- `/api/v1/vehicles` - транспортные средства
- `/api/v1/drivers` - водители
- `/api/v1/contracts` - договор-заявки (с фильтрами date_from/date_to)
- `/api/v1/driver-reports` - отчеты водителей (с фильтрами date_from/date_to)

### Изменение данных вручную
Данные можно редактировать напрямую в Supabase или через JavaScript секцию `index.html`.

### Стилизация
CSS переменные в `:root` для быстрой настройки:

```css
:root {
  --primary-color: #6366f1;
  --success-color: #10b981;
  --warning-color: #f59e0b;
  --danger-color: #ef4444;
}
```

### API интеграция
Раскомментируйте секции с `fetch()` для подключения к реальному API.

## 🌐 Развертывание

### GitHub Pages
1. Fork репозиторий
2. Включить GitHub Pages в настройках
3. Выбрать ветку `main`

### Netlify
[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/Igor1618/transport-dashboard-system)

### Vercel
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/Igor1618/transport-dashboard-system)

## 📱 Совместимость

- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+
- ✅ Мобильные браузеры

## 🤝 Участие в разработке

1. Fork проект
2. Создать ветку (`git checkout -b feature/amazing-feature`)
3. Commit изменения (`git commit -m 'Add amazing feature'`)
4. Push в ветку (`git push origin feature/amazing-feature`)
5. Открыть Pull Request

## 📝 Лицензия

Этот проект лицензирован под MIT License - см. файл [LICENSE](LICENSE) для деталей.

## 👨‍💻 Автор

**Igor1618**
- GitHub: [@Igor1618](https://github.com/Igor1618)

## 🙏 Благодарности

- [Chart.js](https://www.chartjs.org/) за отличную библиотеку графиков
- [Manus](https://manus.im/) за платформу развертывания

---

⭐ **Поставьте звезду, если проект был полезен!**
