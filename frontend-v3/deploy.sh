#!/bin/bash
set -e

FRONTEND="/var/www/transport-dashboard-system/frontend-v3"
PORT=3005

echo "==> [1/3] Building..."
cd $FRONTEND
npm run build

echo "==> [2/3] Stopping all processes on port $PORT..."
# Kill ANY process holding the port (pm2, orphaned nohup, etc)
sudo fuser -k $PORT/tcp 2>/dev/null || true
sleep 2

echo "==> [3/3] Restarting via pm2..."
pm2 restart tl196-v3 || pm2 start "npx next start -p $PORT" --name tl196-v3 --cwd $FRONTEND

echo "Done. Port: $PORT"
pm2 list
