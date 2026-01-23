#!/usr/bin/env python3
"""
Extract tokens from Firefox profile in VNC container

This script extracts:
- Cookies from cookies.sqlite
- localStorage from storage/default/.../ls/data.sqlite

Usage:
    python3 extract_tokens.py

Output:
    /root/wb-sniper/data/tokens.json
"""

import sqlite3
import json
import os
import subprocess
import tempfile
from datetime import datetime
from pathlib import Path

# Paths inside VNC container
COOKIES_PATH = "/config/profile/cookies.sqlite"
LOCALSTORAGE_PATH = "/config/profile/storage/default/https+++logistics.wildberries.ru/ls/data.sqlite"

# Output path on host
OUTPUT_DIR = "/root/wb-sniper/data"
OUTPUT_FILE = f"{OUTPUT_DIR}/tokens.json"


def copy_from_container(container_path: str, local_path: str) -> bool:
    """Copy file from VNC container to local filesystem"""
    try:
        result = subprocess.run(
            ["docker", "exec", "vnc", "cat", container_path],
            capture_output=True,
            check=True
        )
        with open(local_path, 'wb') as f:
            f.write(result.stdout)
        return True
    except subprocess.CalledProcessError as e:
        print(f"Error copying {container_path}: {e}")
        return False


def extract_cookies(db_path: str, domain: str = "wildberries.ru") -> dict:
    """Extract cookies for specified domain from cookies.sqlite"""
    cookies = {}

    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        # Firefox cookies schema
        cursor.execute("""
            SELECT name, value, host, path, expiry, isSecure, isHttpOnly
            FROM moz_cookies
            WHERE host LIKE ?
        """, (f"%{domain}%",))

        for row in cursor.fetchall():
            name, value, host, path, expiry, is_secure, is_http_only = row
            cookies[name] = {
                "value": value,
                "host": host,
                "path": path,
                "expiry": expiry,
                "secure": bool(is_secure),
                "httpOnly": bool(is_http_only)
            }

        conn.close()

    except Exception as e:
        print(f"Error extracting cookies: {e}")

    return cookies


def extract_localstorage(db_path: str) -> dict:
    """Extract localStorage items from Firefox storage"""
    storage = {}

    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        # Firefox localStorage schema
        cursor.execute("SELECT key, value FROM data")

        for row in cursor.fetchall():
            key, value = row
            # Values might be stored as bytes
            if isinstance(value, bytes):
                value = value.decode('utf-8', errors='ignore')
            storage[key] = value

        conn.close()

    except Exception as e:
        print(f"Error extracting localStorage: {e}")

    return storage


def decode_jwt(token: str) -> dict:
    """Decode JWT token without validation"""
    import base64
    try:
        # Split token
        parts = token.split('.')
        if len(parts) != 3:
            return {"error": "Invalid JWT format"}

        # Decode payload (second part)
        payload = parts[1]
        # Add padding if needed
        padding = 4 - len(payload) % 4
        if padding != 4:
            payload += '=' * padding

        decoded = base64.urlsafe_b64decode(payload)
        return json.loads(decoded)

    except Exception as e:
        return {"error": str(e)}


def main():
    print("=" * 60)
    print("WB Logistics Token Extractor")
    print("=" * 60)

    # Create output directory
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # Create temp directory for copied files
    with tempfile.TemporaryDirectory() as tmpdir:
        cookies_local = os.path.join(tmpdir, "cookies.sqlite")
        ls_local = os.path.join(tmpdir, "localstorage.sqlite")

        # Copy files from container
        print("\n1. Copying cookies.sqlite...")
        if not copy_from_container(COOKIES_PATH, cookies_local):
            print("   FAILED - Firefox might be running. Try closing Firefox first.")
            return

        print("2. Copying localStorage database...")
        if not copy_from_container(LOCALSTORAGE_PATH, ls_local):
            print("   WARNING - localStorage not found")
            ls_local = None

        # Extract data
        print("\n3. Extracting cookies...")
        cookies = extract_cookies(cookies_local)
        print(f"   Found {len(cookies)} cookies for wildberries.ru")

        print("\n4. Extracting localStorage...")
        localstorage = {}
        if ls_local:
            localstorage = extract_localstorage(ls_local)
            print(f"   Found {len(localstorage)} localStorage items")

        # Build output structure
        output = {
            "extracted_at": datetime.now().isoformat(),
            "cookies": {},
            "localStorage": {},
            "tokens": {},
            "analysis": {}
        }

        # Important cookies
        important_cookies = ["x_wbaas_token", "_wbauid", "wbx-validation-key", "WILDAUTHNEW_V3"]
        for name, data in cookies.items():
            if any(imp in name.lower() for imp in ["wbaas", "wbauid", "wbx", "wildauth", "token"]):
                output["cookies"][name] = data

        # Important localStorage items
        for key, value in localstorage.items():
            if any(imp in key.lower() for imp in ["token", "auth", "user", "session"]):
                output["localStorage"][key] = value

        # Extract specific tokens
        if "x_wbaas_token" in cookies:
            output["tokens"]["x_wbaas_token"] = cookies["x_wbaas_token"]["value"]
            output["analysis"]["x_wbaas_token_decoded"] = decode_jwt(cookies["x_wbaas_token"]["value"])

        if "_wbauid" in cookies:
            output["tokens"]["_wbauid"] = cookies["_wbauid"]["value"]

        if "accessToken" in localstorage:
            output["tokens"]["accessToken"] = localstorage["accessToken"]
            output["analysis"]["accessToken_decoded"] = decode_jwt(localstorage["accessToken"])

        if "refreshToken" in localstorage:
            output["tokens"]["refreshToken"] = localstorage["refreshToken"]

        # Save output
        with open(OUTPUT_FILE, 'w') as f:
            json.dump(output, f, indent=2, ensure_ascii=False)

        print(f"\n5. Saved to {OUTPUT_FILE}")

        # Print summary
        print("\n" + "=" * 60)
        print("EXTRACTED TOKENS SUMMARY")
        print("=" * 60)

        for name, value in output["tokens"].items():
            if value:
                preview = value[:50] + "..." if len(value) > 50 else value
                print(f"\n{name}:")
                print(f"  {preview}")

        if output["analysis"].get("x_wbaas_token_decoded"):
            jwt_info = output["analysis"]["x_wbaas_token_decoded"]
            if "exp" in jwt_info:
                from datetime import datetime
                exp_date = datetime.fromtimestamp(jwt_info["exp"])
                print(f"\n  x_wbaas_token expires: {exp_date}")

        print("\n" + "=" * 60)
        print(f"Full data saved to: {OUTPUT_FILE}")
        print("=" * 60)


if __name__ == "__main__":
    main()
