#!/usr/bin/env python3
"""
Auto-configure WB API client based on captured mitmproxy requests

This script analyzes captured requests and generates proper configuration
for the WB Logistics API client.

Usage:
    python3 auto_config.py /path/to/wb_requests.json
"""

import json
import re
from typing import Dict, List, Any, Tuple
from pathlib import Path
from collections import defaultdict


def analyze_captured_requests(capture_file: str) -> Dict[str, Any]:
    """
    Analyze captured requests to find API patterns

    Returns:
        Dict with analysis results
    """
    with open(capture_file) as f:
        data = json.load(f)

    requests = data.get("requests", [])
    endpoints = data.get("endpoints_summary", {})

    analysis = {
        "api_base_urls": set(),
        "json_endpoints": [],
        "html_endpoints": [],
        "auth_patterns": {
            "cookies_used": set(),
            "headers_used": set(),
        },
        "tender_endpoints": [],
        "bid_endpoints": [],
    }

    # Analyze each request
    for req in requests:
        url = req.get("url", "")
        method = req.get("method", "")
        content_type = req.get("content_type", "")
        headers = req.get("headers", {})
        cookies = req.get("cookies", {})
        response_body = req.get("response_body_preview", "")

        # Identify base URLs
        if "logistics" in url or "api" in url:
            # Extract base URL
            match = re.match(r"(https?://[^/]+)", url)
            if match:
                analysis["api_base_urls"].add(match.group(1))

        # Classify endpoints
        if "application/json" in content_type:
            analysis["json_endpoints"].append({
                "method": method,
                "url": url,
                "response_preview": response_body[:200] if response_body else None
            })

        # Find auth patterns
        for cookie_name in cookies.keys():
            if any(kw in cookie_name.lower() for kw in ["token", "auth", "session", "wba"]):
                analysis["auth_patterns"]["cookies_used"].add(cookie_name)

        for header_name in headers.keys():
            if any(kw in header_name.lower() for kw in ["auth", "token", "bearer"]):
                analysis["auth_patterns"]["headers_used"].add(header_name)

        # Find tender-related endpoints
        if any(kw in url.lower() for kw in ["tender", "tenders", "auction", "bid"]):
            analysis["tender_endpoints"].append({
                "method": method,
                "url": url,
                "status": req.get("response_status"),
                "headers": headers,
                "cookies": cookies
            })

        # Find bid endpoints
        if method == "POST" and any(kw in url.lower() for kw in ["bid", "offer", "price"]):
            analysis["bid_endpoints"].append({
                "method": method,
                "url": url,
                "body": req.get("body"),
                "response": response_body[:500] if response_body else None
            })

    # Convert sets to lists for JSON serialization
    analysis["api_base_urls"] = list(analysis["api_base_urls"])
    analysis["auth_patterns"]["cookies_used"] = list(analysis["auth_patterns"]["cookies_used"])
    analysis["auth_patterns"]["headers_used"] = list(analysis["auth_patterns"]["headers_used"])

    return analysis


def generate_client_config(analysis: Dict[str, Any]) -> str:
    """
    Generate Python config code based on analysis

    Returns:
        Python code string
    """
    config_lines = [
        '"""',
        'Auto-generated WB API configuration',
        'Generated from mitmproxy capture analysis',
        '"""',
        '',
        '# Base URLs discovered',
    ]

    for url in analysis["api_base_urls"]:
        config_lines.append(f'# BASE_URL = "{url}"')

    config_lines.extend([
        '',
        '# Cookies required for authentication',
        'REQUIRED_COOKIES = ['
    ])

    for cookie in analysis["auth_patterns"]["cookies_used"]:
        config_lines.append(f'    "{cookie}",')

    config_lines.extend([
        ']',
        '',
        '# Headers required for authentication',
        'AUTH_HEADERS = ['
    ])

    for header in analysis["auth_patterns"]["headers_used"]:
        config_lines.append(f'    "{header}",')

    config_lines.extend([
        ']',
        '',
        '# Discovered tender endpoints',
        'TENDER_ENDPOINTS = {'
    ])

    # Group tender endpoints
    seen_endpoints = set()
    for ep in analysis["tender_endpoints"]:
        url = ep["url"]
        method = ep["method"]
        key = f"{method} {url}"
        if key not in seen_endpoints:
            seen_endpoints.add(key)
            # Extract path from URL
            path = re.sub(r"https?://[^/]+", "", url)
            path = path.split("?")[0]  # Remove query params
            config_lines.append(f'    # {method} {path}')

    config_lines.extend([
        '}',
        '',
        '# Discovered bid endpoints',
        'BID_ENDPOINTS = {'
    ])

    for ep in analysis["bid_endpoints"]:
        url = ep["url"]
        method = ep["method"]
        path = re.sub(r"https?://[^/]+", "", url)
        config_lines.append(f'    # {method} {path}')
        if ep.get("body"):
            config_lines.append(f'    # Body: {ep["body"][:100]}')

    config_lines.append('}')

    return '\n'.join(config_lines)


def generate_report(analysis: Dict[str, Any]) -> str:
    """Generate human-readable analysis report"""
    lines = [
        "=" * 70,
        "WB LOGISTICS API ANALYSIS REPORT",
        "=" * 70,
        "",
        "BASE URLs DISCOVERED:",
    ]

    for url in analysis["api_base_urls"]:
        lines.append(f"  - {url}")

    lines.extend([
        "",
        "AUTHENTICATION PATTERNS:",
        "  Cookies:"
    ])

    for cookie in analysis["auth_patterns"]["cookies_used"]:
        lines.append(f"    - {cookie}")

    lines.append("  Headers:")
    for header in analysis["auth_patterns"]["headers_used"]:
        lines.append(f"    - {header}")

    lines.extend([
        "",
        "JSON API ENDPOINTS:",
    ])

    for ep in analysis["json_endpoints"][:20]:  # Limit to 20
        lines.append(f"  {ep['method']} {ep['url']}")

    lines.extend([
        "",
        "TENDER-RELATED ENDPOINTS:",
    ])

    for ep in analysis["tender_endpoints"]:
        lines.append(f"  {ep['method']} {ep['url']} -> {ep['status']}")

    lines.extend([
        "",
        "BID ENDPOINTS:",
    ])

    for ep in analysis["bid_endpoints"]:
        lines.append(f"  {ep['method']} {ep['url']}")
        if ep.get("body"):
            lines.append(f"    Body: {ep['body'][:200]}")

    lines.extend([
        "",
        "=" * 70,
        "NEXT STEPS:",
        "1. Review tender endpoints and identify correct URL pattern",
        "2. Update ENDPOINTS dict in wb_client.py",
        "3. Check if GraphQL is used (look for /graphql endpoints)",
        "4. Test with: python3 wb_client.py test",
        "=" * 70,
    ])

    return '\n'.join(lines)


def main():
    import sys

    if len(sys.argv) < 2:
        print("Usage: python3 auto_config.py /path/to/wb_requests.json")
        sys.exit(1)

    capture_file = sys.argv[1]

    print(f"Analyzing {capture_file}...")
    analysis = analyze_captured_requests(capture_file)

    # Print report
    print(generate_report(analysis))

    # Save analysis
    output_file = capture_file.replace(".json", "_analysis.json")
    with open(output_file, 'w') as f:
        json.dump(analysis, f, indent=2, ensure_ascii=False)
    print(f"\nAnalysis saved to: {output_file}")

    # Generate config
    config_file = capture_file.replace(".json", "_config.py")
    config_code = generate_client_config(analysis)
    with open(config_file, 'w') as f:
        f.write(config_code)
    print(f"Config code saved to: {config_file}")


if __name__ == "__main__":
    main()
