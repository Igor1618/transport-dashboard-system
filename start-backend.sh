#!/bin/bash
# Запуск TL196 Backend API с интеграцией 1C

cd /home/user/transport-dashboard-system/backend

echo "🚀 Запуск TL196 Backend API..."
echo "📊 База данных: PostgreSQL на порту 5432"
echo "🔌 API будет доступен на http://localhost:3001"
echo ""

# Запуск backend
node server.js &

# Сохранить PID
echo $! > /tmp/tl196-backend.pid

echo "✅ Backend запущен! PID: $(cat /tmp/tl196-backend.pid)"
echo ""
echo "Проверка работы:"
sleep 2
curl -s http://localhost:3001/health | jq . || echo "Ожидание запуска..."
