#!/bin/bash
set -e

FRONTEND="/var/www/transport-dashboard-system/frontend-v3"
PORT=3005

echo "==> [1/3] Building..."
cd $FRONTEND
npm run build

echo "==> [2/2] Restarting via sudo pm2 (root owns tl196-v3)..."
sudo pm2 restart tl196-v3

echo "Done. Port: $PORT"
sudo pm2 list
