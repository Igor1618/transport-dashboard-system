"""
WB Logistics API Client

Fast HTTP client for Wildberries Logistics API.
Designed to reproduce browser requests for tender sniping.

Usage:
    from wb_client import WBLogisticsAPI

    client = WBLogisticsAPI.from_tokens_file("/root/wb-sniper/data/tokens.json")
    tenders = client.get_tenders()
    client.place_bid(tender_id="xxx", price=1000)
"""

import json
import time
import logging
from typing import Optional, Dict, List, Any
from dataclasses import dataclass
from pathlib import Path

import httpx

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass
class WBTokens:
    """Container for WB authentication tokens"""
    x_wbaas_token: str  # JWT cookie
    wbauid: str  # User ID cookie
    access_token: Optional[str] = None  # Bearer token from localStorage
    refresh_token: Optional[str] = None
    additional_cookies: Optional[Dict[str, str]] = None

    @classmethod
    def from_file(cls, path: str) -> "WBTokens":
        """Load tokens from JSON file created by extract_tokens.py"""
        with open(path) as f:
            data = json.load(f)

        tokens = data.get("tokens", {})
        cookies = data.get("cookies", {})

        return cls(
            x_wbaas_token=tokens.get("x_wbaas_token", ""),
            wbauid=tokens.get("_wbauid", ""),
            access_token=tokens.get("accessToken"),
            refresh_token=tokens.get("refreshToken"),
            additional_cookies={k: v.get("value", v) if isinstance(v, dict) else v
                              for k, v in cookies.items()}
        )


class WBLogisticsAPI:
    """
    Fast HTTP client for WB Logistics API

    This client reproduces browser requests by using the same headers,
    cookies and tokens that Firefox uses.
    """

    # Base URLs - will be updated after mitmproxy analysis
    BASE_URL = "https://logistics.wildberries.ru"
    API_URL = "https://logistics.wildberries.ru/api"

    # Endpoints - PLACEHOLDER, will be updated after mitmproxy capture
    ENDPOINTS = {
        "tenders_list": "/api/v1/tenders",  # Placeholder
        "tender_details": "/api/v1/tenders/{tender_id}",  # Placeholder
        "place_bid": "/api/v1/tenders/{tender_id}/bid",  # Placeholder
        "my_bids": "/api/v1/bids",  # Placeholder
    }

    # Browser fingerprint headers - essential for bypassing bot detection
    DEFAULT_HEADERS = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "ru-RU,ru;q=0.8,en-US;q=0.5,en;q=0.3",
        "Accept-Encoding": "gzip, deflate, br",
        "Connection": "keep-alive",
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-origin",
    }

    def __init__(self, tokens: WBTokens, timeout: float = 5.0):
        """
        Initialize WB Logistics API client

        Args:
            tokens: WBTokens with authentication data
            timeout: Request timeout in seconds
        """
        self.tokens = tokens
        self.timeout = timeout
        self._client: Optional[httpx.Client] = None

        # Request timing
        self.last_request_time = 0
        self.total_requests = 0
        self.total_time = 0

    @classmethod
    def from_tokens_file(cls, path: str, timeout: float = 5.0) -> "WBLogisticsAPI":
        """Create client from tokens JSON file"""
        tokens = WBTokens.from_file(path)
        return cls(tokens, timeout)

    @property
    def client(self) -> httpx.Client:
        """Get or create httpx client with connection pooling"""
        if self._client is None:
            self._client = httpx.Client(
                timeout=self.timeout,
                http2=True,  # Enable HTTP/2 for better performance
                follow_redirects=True,
            )
        return self._client

    def _build_cookies(self) -> Dict[str, str]:
        """Build cookies dict for request"""
        cookies = {
            "x_wbaas_token": self.tokens.x_wbaas_token,
            "_wbauid": self.tokens.wbauid,
        }

        # Add any additional cookies
        if self.tokens.additional_cookies:
            cookies.update(self.tokens.additional_cookies)

        return cookies

    def _build_headers(self, extra_headers: Optional[Dict] = None) -> Dict[str, str]:
        """Build headers dict for request"""
        headers = self.DEFAULT_HEADERS.copy()

        # Add authorization if we have access token
        if self.tokens.access_token:
            headers["Authorization"] = f"Bearer {self.tokens.access_token}"

        # Add referer
        headers["Referer"] = f"{self.BASE_URL}/tenders"

        # Add any extra headers
        if extra_headers:
            headers.update(extra_headers)

        return headers

    def _request(
        self,
        method: str,
        url: str,
        params: Optional[Dict] = None,
        json_data: Optional[Dict] = None,
        extra_headers: Optional[Dict] = None
    ) -> httpx.Response:
        """
        Make HTTP request with timing

        Returns:
            httpx.Response object

        Raises:
            httpx.HTTPError on network errors
        """
        start_time = time.perf_counter()

        try:
            response = self.client.request(
                method=method,
                url=url,
                params=params,
                json=json_data,
                headers=self._build_headers(extra_headers),
                cookies=self._build_cookies(),
            )

            elapsed = (time.perf_counter() - start_time) * 1000  # ms

            self.last_request_time = elapsed
            self.total_requests += 1
            self.total_time += elapsed

            logger.debug(f"{method} {url} -> {response.status_code} ({elapsed:.0f}ms)")

            return response

        except Exception as e:
            elapsed = (time.perf_counter() - start_time) * 1000
            logger.error(f"{method} {url} -> ERROR: {e} ({elapsed:.0f}ms)")
            raise

    def get(self, endpoint: str, params: Optional[Dict] = None) -> httpx.Response:
        """Make GET request"""
        url = f"{self.BASE_URL}{endpoint}"
        return self._request("GET", url, params=params)

    def post(self, endpoint: str, data: Optional[Dict] = None) -> httpx.Response:
        """Make POST request"""
        url = f"{self.BASE_URL}{endpoint}"
        return self._request("POST", url, json_data=data)

    # ==================== API METHODS ====================
    # NOTE: These endpoints are PLACEHOLDERS.
    # Update them after capturing real requests with mitmproxy!

    def get_tenders(self, status: str = "active") -> Dict[str, Any]:
        """
        Get list of available tenders

        NOTE: Endpoint is placeholder - update after mitmproxy capture!

        Args:
            status: Filter by status (active, completed, etc.)

        Returns:
            Dict with tender list or error
        """
        endpoint = self.ENDPOINTS["tenders_list"]

        try:
            response = self.get(endpoint, params={"status": status})

            if response.status_code == 200:
                return {
                    "success": True,
                    "data": response.json(),
                    "timing_ms": self.last_request_time
                }
            else:
                return {
                    "success": False,
                    "status_code": response.status_code,
                    "error": response.text[:500],
                    "timing_ms": self.last_request_time
                }

        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "timing_ms": self.last_request_time
            }

    def get_tender_details(self, tender_id: str) -> Dict[str, Any]:
        """
        Get detailed information about specific tender

        Args:
            tender_id: Tender ID

        Returns:
            Dict with tender details or error
        """
        endpoint = self.ENDPOINTS["tender_details"].format(tender_id=tender_id)

        try:
            response = self.get(endpoint)

            if response.status_code == 200:
                return {
                    "success": True,
                    "data": response.json(),
                    "timing_ms": self.last_request_time
                }
            else:
                return {
                    "success": False,
                    "status_code": response.status_code,
                    "error": response.text[:500],
                    "timing_ms": self.last_request_time
                }

        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }

    def place_bid(self, tender_id: str, price: int, comment: str = "") -> Dict[str, Any]:
        """
        Place bid on tender

        NOTE: Endpoint and payload are placeholders - update after mitmproxy!

        Args:
            tender_id: Tender ID
            price: Bid price in kopecks/rubles (check API)
            comment: Optional comment

        Returns:
            Dict with result or error
        """
        endpoint = self.ENDPOINTS["place_bid"].format(tender_id=tender_id)

        # Placeholder payload - update after capture
        payload = {
            "tender_id": tender_id,
            "price": price,
            "comment": comment
        }

        try:
            response = self.post(endpoint, data=payload)

            if response.status_code in (200, 201):
                return {
                    "success": True,
                    "data": response.json() if response.content else {},
                    "timing_ms": self.last_request_time
                }
            else:
                return {
                    "success": False,
                    "status_code": response.status_code,
                    "error": response.text[:500],
                    "timing_ms": self.last_request_time
                }

        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }

    def test_connection(self) -> Dict[str, Any]:
        """
        Test if authentication works by making a simple request

        Returns:
            Dict with connection status
        """
        logger.info("Testing connection to WB Logistics...")

        try:
            # Try to load main page first
            response = self._request("GET", f"{self.BASE_URL}/tenders")

            # Check if we got HTML login page or actual content
            content_type = response.headers.get("content-type", "")
            is_html = "text/html" in content_type

            if is_html and "login" in response.text.lower():
                return {
                    "success": False,
                    "error": "Authentication failed - got login page",
                    "hint": "Tokens may be expired or invalid",
                    "timing_ms": self.last_request_time
                }

            return {
                "success": True,
                "status_code": response.status_code,
                "content_type": content_type,
                "is_authenticated": not (is_html and "login" in response.text.lower()),
                "timing_ms": self.last_request_time
            }

        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }

    def get_stats(self) -> Dict[str, Any]:
        """Get client statistics"""
        avg_time = self.total_time / self.total_requests if self.total_requests > 0 else 0
        return {
            "total_requests": self.total_requests,
            "total_time_ms": round(self.total_time, 2),
            "avg_time_ms": round(avg_time, 2),
            "last_request_ms": round(self.last_request_time, 2)
        }

    def close(self):
        """Close HTTP client"""
        if self._client:
            self._client.close()
            self._client = None

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.close()


# ==================== DYNAMIC ENDPOINT UPDATER ====================

def update_endpoints_from_capture(capture_file: str, client_module: str = __file__):
    """
    Update API endpoints based on mitmproxy capture

    This function reads captured requests and updates the ENDPOINTS
    dictionary in this module.

    Args:
        capture_file: Path to wb_requests.json from mitmproxy
        client_module: Path to this file for updating
    """
    print(f"Reading captured requests from {capture_file}...")

    with open(capture_file) as f:
        data = json.load(f)

    endpoints = data.get("endpoints_summary", {})

    print(f"\nFound {len(endpoints)} unique endpoints:")
    print("-" * 60)

    for endpoint, info in sorted(endpoints.items(), key=lambda x: -x[1]["count"]):
        print(f"{endpoint}")
        print(f"  Calls: {info['count']}")
        print()

    print("-" * 60)
    print("\nAnalyze these endpoints and update ENDPOINTS dict in wb_client.py")
    print("Look for patterns like:")
    print("  - GET /api/.../tenders - for getting tender list")
    print("  - POST /api/.../bid - for placing bids")
    print("  - GraphQL endpoints")


# ==================== CLI TESTING ====================

if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Usage:")
        print("  python wb_client.py test /path/to/tokens.json")
        print("  python wb_client.py analyze /path/to/wb_requests.json")
        sys.exit(1)

    command = sys.argv[1]

    if command == "test":
        tokens_file = sys.argv[2] if len(sys.argv) > 2 else "/root/wb-sniper/data/tokens.json"

        print(f"Loading tokens from {tokens_file}...")
        client = WBLogisticsAPI.from_tokens_file(tokens_file)

        print("\nTesting connection...")
        result = client.test_connection()
        print(json.dumps(result, indent=2))

        if result.get("success"):
            print("\nTrying to get tenders...")
            tenders = client.get_tenders()
            print(json.dumps(tenders, indent=2, ensure_ascii=False))

        print("\nStats:")
        print(json.dumps(client.get_stats(), indent=2))

        client.close()

    elif command == "analyze":
        capture_file = sys.argv[2] if len(sys.argv) > 2 else "/config/wb_requests.json"
        update_endpoints_from_capture(capture_file)

    else:
        print(f"Unknown command: {command}")
        sys.exit(1)
