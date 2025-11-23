"""Location tool for AI agent - IP-based geolocation.

Provides geographic location information from IP addresses using ipapi.co API
with optional GeoLite2 fallback. Privacy-focused with no user tracking.
"""

from typing import Optional
import requests
import logging

logger = logging.getLogger(__name__)


def _get_location_from_ipapi(ip: str = "") -> Optional[dict]:
    """Get location from ipapi.co API.

    Uses ipapi.co free tier (30K requests/month, no auth required).

    Args:
        ip: IP address to lookup. Empty string for auto-detect.

    Returns:
        Location data dict with city, country, coordinates, timezone.
        None on API failure or invalid IP.

    Example:
        >>> _get_location_from_ipapi("8.8.8.8")
        {'ip': '8.8.8.8', 'city': 'Mountain View', ...}
    """
    try:
        # Auto-detect IP if not provided
        url = f"https://ipapi.co/{ip}/json/" if ip else "https://ipapi.co/json/"

        logger.debug(f"Fetching location from ipapi.co: {url}")
        response = requests.get(url, timeout=5)

        if response.status_code == 200:
            data = response.json()

            # Check for API error (rate limit, invalid IP, etc.)
            if "error" in data:
                logger.warning(f"ipapi.co API error: {data.get('reason', 'Unknown')}")
                return None

            logger.debug(f"Successfully retrieved location for IP: {data.get('ip')}")
            return {
                "ip": data.get("ip"),
                "city": data.get("city"),
                "region": data.get("region"),
                "country": data.get("country_name"),
                "country_code": data.get("country_code"),
                "latitude": data.get("latitude"),
                "longitude": data.get("longitude"),
                "timezone": data.get("timezone"),
                "accuracy": "city"
            }

        logger.warning(f"ipapi.co returned status code: {response.status_code}")
        return None

    except requests.RequestException as e:
        logger.error(f"Network error accessing ipapi.co: {str(e)}")
        return None


def _get_location_from_geoip2(ip: str) -> Optional[dict]:
    """Fallback to GeoLite2 local database.

    Requires GeoLite2-City.mmdb file at standard locations.
    Optional fallback when ipapi.co fails or rate-limited.

    Args:
        ip: IP address to lookup (explicit IP required)

    Returns:
        Location data dict or None if database not available

    Note:
        GeoLite2 database requires manual download/setup.
        Returns None gracefully if not configured.
    """
    try:
        import geoip2.database
        import os

        # Check common database locations
        db_paths = [
            "/usr/local/share/GeoIP/GeoLite2-City.mmdb",
            "/var/lib/GeoIP/GeoLite2-City.mmdb",
            os.path.expanduser("~/.geoip/GeoLite2-City.mmdb")
        ]

        for db_path in db_paths:
            if os.path.exists(db_path):
                logger.debug(f"Using GeoLite2 database: {db_path}")
                with geoip2.database.Reader(db_path) as reader:
                    response = reader.city(ip)

                    return {
                        "ip": ip,
                        "city": response.city.name,
                        "region": response.subdivisions.most_specific.name if response.subdivisions else None,
                        "country": response.country.name,
                        "country_code": response.country.iso_code,
                        "latitude": response.location.latitude,
                        "longitude": response.location.longitude,
                        "timezone": response.location.time_zone,
                        "accuracy": "city"
                    }

        logger.debug("GeoLite2 database not found at standard locations")
        return None

    except (ImportError, FileNotFoundError, Exception) as e:
        logger.debug(f"GeoLite2 fallback unavailable: {str(e)}")
        return None


def _format_location(data: dict) -> str:
    """Format location data into LLM-friendly string.

    Args:
        data: Location data dict with city, country, coordinates, etc.

    Returns:
        Human-readable location string

    Example:
        >>> data = {'city': 'New York', 'region': 'New York', 'country': 'United States', \\
        ...         'latitude': 40.7128, 'longitude': -74.0060, 'timezone': 'America/New_York'}
        >>> _format_location(data)
        'Location: New York, New York, United States (40.7128, -74.0060) | Timezone: America/New_York'
    """
    parts = []

    if data.get("city"):
        parts.append(data["city"])
    if data.get("region") and data.get("region") != data.get("city"):
        parts.append(data["region"])
    if data.get("country"):
        parts.append(data["country"])

    location_str = ", ".join(parts) if parts else "Unknown location"

    coords = ""
    if data.get("latitude") is not None and data.get("longitude") is not None:
        coords = f" ({data['latitude']:.4f}, {data['longitude']:.4f})"

    timezone = ""
    if data.get("timezone"):
        timezone = f" | Timezone: {data['timezone']}"

    return f"Location: {location_str}{coords}{timezone}"


def get_location(
    ip_address: str = ""
) -> str:
    """Get geographic location from IP address.

    Returns city, country, coordinates, and timezone based on IP geolocation.
    Uses ipapi.co free API (30K/month) with optional GeoLite2 fallback.

    Accuracy: ±50km typical for IP geolocation. Not suitable for precise
    location requirements. Best for general location (city/country level).

    Args:
        ip_address: Specific IP address to lookup. Leave empty to auto-detect current location.

    Returns:
        Formatted location string with city, country, coordinates, timezone.
        Returns error message on network failure or invalid IP.
    """
    # Try ipapi.co first (primary method)
    location_data = _get_location_from_ipapi(ip_address)

    if location_data:
        return _format_location(location_data)

    # Fallback to GeoLite2 if available and explicit IP provided
    if ip_address:  # GeoLite2 requires explicit IP
        location_data = _get_location_from_geoip2(ip_address)
        if location_data:
            return _format_location(location_data)

    # All methods failed
    return "Error: Unable to determine location. Network issue or invalid IP address."


# Auto-register tool on import
from ..registry import ToolRegistry

_registry = ToolRegistry()
_registry.register(get_location, scope="global")
