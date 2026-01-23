#!/bin/bash
# Install mitmproxy certificate in Firefox (inside VNC container)

echo "Installing mitmproxy certificate..."

# First, start mitmproxy briefly to generate certificates
docker exec vnc bash -c '
    # Check if cert exists
    if [ ! -f /root/.mitmproxy/mitmproxy-ca-cert.pem ]; then
        echo "Generating mitmproxy certificates..."
        timeout 5 mitmdump --mode regular --listen-port 18080 2>/dev/null || true
    fi

    if [ -f /root/.mitmproxy/mitmproxy-ca-cert.pem ]; then
        echo "Certificate found at /root/.mitmproxy/mitmproxy-ca-cert.pem"

        # Copy to accessible location
        cp /root/.mitmproxy/mitmproxy-ca-cert.pem /config/mitmproxy-ca.pem
        echo "Copied to /config/mitmproxy-ca.pem"

        # Try to install using certutil if available
        if command -v certutil &> /dev/null; then
            PROFILE_DIR="/config/profile"
            certutil -A -n "mitmproxy" -t "TC,," -i /config/mitmproxy-ca.pem -d sql:$PROFILE_DIR
            echo "Installed to Firefox cert database"
        else
            echo ""
            echo "certutil not available. Install manually in Firefox:"
            echo "1. Open Firefox in VNC"
            echo "2. Go to about:preferences#privacy"
            echo "3. Click View Certificates -> Authorities -> Import"
            echo "4. Select /config/mitmproxy-ca.pem"
            echo "5. Check \"Trust this CA to identify websites\""
        fi
    else
        echo "ERROR: Could not generate certificate"
    fi
'

echo ""
echo "Done!"
