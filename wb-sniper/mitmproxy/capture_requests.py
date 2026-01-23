"""
mitmproxy addon to capture WB Logistics API requests

Usage:
    mitmproxy --mode regular --listen-port 8080 -s capture_requests.py

    Or with web interface:
    mitmweb --mode regular --listen-port 8080 -s capture_requests.py --web-port 8081
"""

import json
import os
from datetime import datetime
from mitmproxy import http, ctx

# File to save captured requests
OUTPUT_FILE = "/config/wb_requests.json"
SUMMARY_FILE = "/config/wb_api_summary.txt"

# Domains to capture
TARGET_DOMAINS = [
    "logistics.wildberries.ru",
    "logistics-api.wildberries.ru",
    "api-lk.wildberries.ru",
    "wbaas.wildberries.ru",
    "lk.wildberries.ru"
]

captured_requests = []


class WBLogisticsCapture:
    def __init__(self):
        self.requests = []
        self.api_endpoints = {}

    def request(self, flow: http.HTTPFlow):
        """Capture request before it's sent"""
        host = flow.request.host

        # Only capture WB related requests
        if not any(domain in host for domain in TARGET_DOMAINS):
            return

        # Store request details for later matching with response
        flow.request.wb_captured = True

    def response(self, flow: http.HTTPFlow):
        """Capture response and log full request/response pair"""
        if not hasattr(flow.request, 'wb_captured'):
            return

        host = flow.request.host
        path = flow.request.path
        method = flow.request.method

        # Capture full request details
        request_data = {
            "timestamp": datetime.now().isoformat(),
            "method": method,
            "url": flow.request.pretty_url,
            "host": host,
            "path": path,
            "headers": dict(flow.request.headers),
            "cookies": dict(flow.request.cookies),
            "body": None,
            "response_status": flow.response.status_code,
            "response_headers": dict(flow.response.headers),
            "response_body_preview": None,
            "content_type": flow.response.headers.get("content-type", "")
        }

        # Capture request body if present
        if flow.request.content:
            try:
                request_data["body"] = flow.request.content.decode('utf-8')
            except:
                request_data["body"] = f"<binary: {len(flow.request.content)} bytes>"

        # Capture response body (truncated for large responses)
        if flow.response.content:
            try:
                body = flow.response.content.decode('utf-8')
                # Truncate if too large
                if len(body) > 5000:
                    request_data["response_body_preview"] = body[:5000] + "... (truncated)"
                else:
                    request_data["response_body_preview"] = body
            except:
                request_data["response_body_preview"] = f"<binary: {len(flow.response.content)} bytes>"

        self.requests.append(request_data)

        # Track unique API endpoints
        endpoint_key = f"{method} {host}{path.split('?')[0]}"
        if endpoint_key not in self.api_endpoints:
            self.api_endpoints[endpoint_key] = {
                "first_seen": request_data["timestamp"],
                "count": 0,
                "sample_headers": request_data["headers"],
                "sample_cookies": request_data["cookies"],
            }
        self.api_endpoints[endpoint_key]["count"] += 1

        # Log to console
        ctx.log.info(f"[WB] {method} {host}{path[:80]} -> {flow.response.status_code}")

        # Save to file after each request
        self._save_to_file()

    def _save_to_file(self):
        """Save captured requests to JSON file"""
        try:
            output = {
                "captured_at": datetime.now().isoformat(),
                "total_requests": len(self.requests),
                "unique_endpoints": len(self.api_endpoints),
                "endpoints_summary": self.api_endpoints,
                "requests": self.requests[-100:]  # Keep last 100 requests
            }

            with open(OUTPUT_FILE, 'w') as f:
                json.dump(output, f, indent=2, ensure_ascii=False)

            # Also save human-readable summary
            self._save_summary()

        except Exception as e:
            ctx.log.error(f"Failed to save: {e}")

    def _save_summary(self):
        """Save human-readable API summary"""
        try:
            lines = [
                "=" * 60,
                "WB LOGISTICS API CAPTURED ENDPOINTS",
                f"Total requests: {len(self.requests)}",
                f"Unique endpoints: {len(self.api_endpoints)}",
                "=" * 60,
                "",
            ]

            # Sort endpoints by count
            sorted_endpoints = sorted(
                self.api_endpoints.items(),
                key=lambda x: x[1]["count"],
                reverse=True
            )

            for endpoint, data in sorted_endpoints:
                lines.append(f"\n{endpoint}")
                lines.append(f"  Calls: {data['count']}")
                lines.append(f"  First seen: {data['first_seen']}")

                # Show important headers
                important_headers = ['authorization', 'x-wbaas-token', 'cookie']
                for header in important_headers:
                    if header in data['sample_headers']:
                        value = data['sample_headers'][header]
                        if len(value) > 100:
                            value = value[:100] + "..."
                        lines.append(f"  {header}: {value}")

            with open(SUMMARY_FILE, 'w') as f:
                f.write("\n".join(lines))

        except Exception as e:
            ctx.log.error(f"Failed to save summary: {e}")


addons = [WBLogisticsCapture()]
