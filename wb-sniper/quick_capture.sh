#!/bin/bash
# One-liner to start mitmproxy capture in VNC container

echo "Starting mitmproxy in VNC container..."
echo "View captured requests at: http://83.217.212.221:8081"
echo ""
echo "Press Ctrl+C to stop"
echo ""

docker exec -it vnc mitmweb \
    --mode regular \
    --listen-port 8080 \
    -s /config/capture_requests.py \
    --web-host 0.0.0.0 \
    --web-port 8081 \
    --set web_open_browser=false
