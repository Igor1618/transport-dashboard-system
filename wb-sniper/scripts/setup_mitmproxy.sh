#!/bin/bash
# Setup mitmproxy inside VNC container

set -e

echo "=== Installing mitmproxy in VNC container ==="

# Install mitmproxy inside the vnc container
docker exec -u root vnc bash -c '
    # Update and install dependencies
    apt-get update
    apt-get install -y python3 python3-pip curl

    # Install mitmproxy
    pip3 install mitmproxy --break-system-packages 2>/dev/null || pip3 install mitmproxy

    echo "mitmproxy installed successfully"
'

echo "=== Setting up Firefox proxy ==="

# Create Firefox proxy configuration
docker exec vnc bash -c '
    # Find Firefox profile directory
    PROFILE_DIR="/config/profile"

    # Create user.js with proxy settings
    cat > "$PROFILE_DIR/user.js" << EOF
// Proxy settings for mitmproxy
user_pref("network.proxy.type", 1);
user_pref("network.proxy.http", "127.0.0.1");
user_pref("network.proxy.http_port", 8080);
user_pref("network.proxy.ssl", "127.0.0.1");
user_pref("network.proxy.ssl_port", 8080);
user_pref("network.proxy.no_proxies_on", "localhost, 127.0.0.1");
EOF

    echo "Firefox proxy config created at $PROFILE_DIR/user.js"
'

echo "=== Copying mitmproxy capture script ==="

# Copy the capture script into container
docker cp /root/wb-sniper/mitmproxy/capture_requests.py vnc:/config/capture_requests.py

echo "=== Installation complete ==="
echo ""
echo "Next steps:"
echo "1. Start mitmproxy: docker exec -it vnc mitmproxy --mode regular --listen-port 8080 -s /config/capture_requests.py"
echo "2. Restart Firefox in VNC to apply proxy settings"
echo "3. Install mitmproxy CA certificate in Firefox"
echo "4. Navigate to logistics.wildberries.ru/tenders"
echo "5. Check captured requests in /config/wb_requests.json"
