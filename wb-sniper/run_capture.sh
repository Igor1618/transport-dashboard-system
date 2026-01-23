#!/bin/bash
# Quick start script for capturing WB Logistics API

set -e

echo "========================================"
echo "WB Logistics API Capture Setup"
echo "========================================"

# Check if we're on the server
if [ ! -d "/root" ]; then
    echo "ERROR: This script should be run on the server (83.217.212.221)"
    exit 1
fi

# Check Docker
if ! docker ps | grep -q vnc; then
    echo "ERROR: VNC container not running"
    echo "Start it with: docker start vnc"
    exit 1
fi

echo ""
echo "Step 1: Installing mitmproxy in VNC container..."
echo "------------------------------------------------"

docker exec -u root vnc bash -c '
    command -v mitmproxy >/dev/null 2>&1 && echo "mitmproxy already installed" && exit 0

    echo "Installing mitmproxy..."
    apt-get update -qq
    apt-get install -y -qq python3 python3-pip >/dev/null

    pip3 install mitmproxy --break-system-packages 2>/dev/null || pip3 install mitmproxy
    echo "Done!"
'

echo ""
echo "Step 2: Copying capture script to container..."
echo "-----------------------------------------------"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
docker cp "$SCRIPT_DIR/mitmproxy/capture_requests.py" vnc:/config/capture_requests.py
echo "Done!"

echo ""
echo "Step 3: Setting up Firefox proxy..."
echo "------------------------------------"

docker exec vnc bash -c '
    PROFILE_DIR="/config/profile"

    cat > "$PROFILE_DIR/user.js" << EOF
user_pref("network.proxy.type", 1);
user_pref("network.proxy.http", "127.0.0.1");
user_pref("network.proxy.http_port", 8080);
user_pref("network.proxy.ssl", "127.0.0.1");
user_pref("network.proxy.ssl_port", 8080);
user_pref("network.proxy.no_proxies_on", "localhost, 127.0.0.1");
EOF
    echo "Proxy config written to $PROFILE_DIR/user.js"
'

echo ""
echo "========================================"
echo "SETUP COMPLETE!"
echo "========================================"
echo ""
echo "NOW DO THESE STEPS MANUALLY:"
echo ""
echo "1. Open terminal in VNC container:"
echo "   docker exec -it vnc bash"
echo ""
echo "2. Start mitmproxy with web interface:"
echo "   mitmweb --mode regular --listen-port 8080 -s /config/capture_requests.py --web-host 0.0.0.0 --web-port 8081"
echo ""
echo "3. Open VNC in browser: http://83.217.212.221:6080"
echo "   Password: wb123"
echo ""
echo "4. In Firefox (inside VNC):"
echo "   a) Go to about:preferences#privacy"
echo "   b) Scroll to Certificates -> View Certificates"
echo "   c) Import: /root/.mitmproxy/mitmproxy-ca-cert.pem"
echo "   d) Check 'Trust for websites'"
echo ""
echo "5. Navigate to https://logistics.wildberries.ru/tenders"
echo ""
echo "6. Check captured requests:"
echo "   - Web: http://83.217.212.221:8081"
echo "   - JSON: docker exec vnc cat /config/wb_requests.json"
echo ""
echo "7. Copy captured data to host:"
echo "   docker cp vnc:/config/wb_requests.json /root/wb-sniper/data/"
echo ""
echo "8. Analyze captured requests:"
echo "   python3 /root/wb-sniper/api/auto_config.py /root/wb-sniper/data/wb_requests.json"
echo ""
