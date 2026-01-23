#!/usr/bin/env python3
"""
Quick test script for WB Logistics API

Usage:
    python3 test_api.py
"""

import json
import sys
import os

# Add parent dir to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from api.wb_client import WBLogisticsAPI, WBTokens


def main():
    tokens_file = "/root/wb-sniper/data/tokens.json"

    print("=" * 60)
    print("WB Logistics API Test")
    print("=" * 60)

    # Check if tokens file exists
    if not os.path.exists(tokens_file):
        print(f"\nERROR: Tokens file not found: {tokens_file}")
        print("\nRun extract_tokens.py first:")
        print("  python3 scripts/extract_tokens.py")
        sys.exit(1)

    # Load tokens
    print(f"\n1. Loading tokens from {tokens_file}...")
    try:
        client = WBLogisticsAPI.from_tokens_file(tokens_file)
        print("   OK - Tokens loaded")
    except Exception as e:
        print(f"   ERROR: {e}")
        sys.exit(1)

    # Show token info
    print("\n2. Token info:")
    print(f"   x_wbaas_token: {client.tokens.x_wbaas_token[:50]}...")
    print(f"   wbauid: {client.tokens.wbauid}")
    if client.tokens.access_token:
        print(f"   accessToken: {client.tokens.access_token[:50]}...")

    # Test connection
    print("\n3. Testing connection...")
    result = client.test_connection()

    if result.get("success"):
        print(f"   OK - Status {result.get('status_code')}")
        print(f"   Time: {result.get('timing_ms', 0):.0f}ms")
        print(f"   Authenticated: {result.get('is_authenticated')}")
    else:
        print(f"   FAILED: {result.get('error')}")
        if result.get("hint"):
            print(f"   Hint: {result['hint']}")

    # Try to get tenders (will likely fail without correct endpoints)
    print("\n4. Trying to get tenders (endpoint may be wrong)...")
    tenders = client.get_tenders()

    if tenders.get("success"):
        print(f"   OK - Got response")
        print(f"   Time: {tenders.get('timing_ms', 0):.0f}ms")
        data = tenders.get("data", {})
        if isinstance(data, list):
            print(f"   Tenders count: {len(data)}")
        elif isinstance(data, dict):
            print(f"   Response keys: {list(data.keys())[:5]}")
    else:
        print(f"   FAILED: {tenders.get('error', 'Unknown error')}")
        if tenders.get("status_code"):
            print(f"   Status code: {tenders['status_code']}")
        print("\n   NOTE: This is expected if endpoints are not configured yet.")
        print("   Run mitmproxy capture to find correct endpoints.")

    # Stats
    print("\n5. Statistics:")
    stats = client.get_stats()
    print(f"   Total requests: {stats['total_requests']}")
    print(f"   Avg time: {stats['avg_time_ms']:.0f}ms")

    client.close()

    print("\n" + "=" * 60)
    print("Test complete")
    print("=" * 60)


if __name__ == "__main__":
    main()
