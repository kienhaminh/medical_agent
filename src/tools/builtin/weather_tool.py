"""Weather tool for AI agent - current weather conditions.

Provides current weather information for any location using Open-Meteo API.
No API key required. Free for non-commercial use.
"""

import requests
from typing import Optional


def _geocode_location(location: str) -> Optional[dict]:
    """Convert location name to geographic coordinates.

    Uses Open-Meteo Geocoding API to find latitude/longitude for a location.

    Args:
        location: City name or location string (e.g., "New York", "London, UK")

    Returns:
        Dictionary with latitude, longitude, name, country, timezone if found.
        None if location not found or API error.

    Example:
        >>> result = _geocode_location("Berlin")
        >>> result['latitude']
        52.52437
        >>> result['longitude']
        13.41053
    """
    if not location or len(location) < 2:
        return None

    try:
        url = "https://geocoding-api.open-meteo.com/v1/search"
        params = {
            "name": location,
            "count": 1,  # Only get top result
            "language": "en",
            "format": "json"
        }

        response = requests.get(url, params=params, timeout=10)

        if response.status_code != 200:
            return None

        data = response.json()

        if "results" not in data or not data["results"]:
            return None

        result = data["results"][0]
        return {
            "latitude": result.get("latitude"),
            "longitude": result.get("longitude"),
            "name": result.get("name"),
            "country": result.get("country"),
            "timezone": result.get("timezone"),
            "elevation": result.get("elevation")
        }

    except (requests.RequestException, KeyError, ValueError):
        return None


def _get_weather(latitude: float, longitude: float) -> Optional[dict]:
    """Get current weather conditions for coordinates.

    Uses Open-Meteo Weather API to fetch current weather data.

    Args:
        latitude: Latitude coordinate
        longitude: Longitude coordinate

    Returns:
        Dictionary with current weather data if successful, None otherwise.

    Example:
        >>> weather = _get_weather(52.52, 13.41)
        >>> weather['temperature']
        15.3
    """
    try:
        url = "https://api.open-meteo.com/v1/forecast"
        params = {
            "latitude": latitude,
            "longitude": longitude,
            "current": [
                "temperature_2m",
                "relative_humidity_2m",
                "apparent_temperature",
                "precipitation",
                "weather_code",
                "cloud_cover",
                "wind_speed_10m",
                "wind_direction_10m"
            ],
            "timezone": "auto"
        }

        response = requests.get(url, params=params, timeout=10)

        if response.status_code != 200:
            return None

        data = response.json()

        if "current" not in data:
            return None

        current = data["current"]
        return {
            "temperature": current.get("temperature_2m"),
            "feels_like": current.get("apparent_temperature"),
            "humidity": current.get("relative_humidity_2m"),
            "precipitation": current.get("precipitation"),
            "weather_code": current.get("weather_code"),
            "cloud_cover": current.get("cloud_cover"),
            "wind_speed": current.get("wind_speed_10m"),
            "wind_direction": current.get("wind_direction_10m"),
            "timezone": data.get("timezone")
        }

    except (requests.RequestException, KeyError, ValueError):
        return None


def _interpret_weather_code(code: int) -> str:
    """Convert WMO weather code to human-readable description.

    Args:
        code: WMO weather code (0-99)

    Returns:
        Human-readable weather description

    Reference:
        https://www.nodc.noaa.gov/archive/arc0021/0002199/1.1/data/0-data/HTML/WMO-CODE/WMO4677.HTM
    """
    weather_codes = {
        0: "Clear sky",
        1: "Mainly clear",
        2: "Partly cloudy",
        3: "Overcast",
        45: "Foggy",
        48: "Depositing rime fog",
        51: "Light drizzle",
        53: "Moderate drizzle",
        55: "Dense drizzle",
        61: "Slight rain",
        63: "Moderate rain",
        65: "Heavy rain",
        71: "Slight snow",
        73: "Moderate snow",
        75: "Heavy snow",
        77: "Snow grains",
        80: "Slight rain showers",
        81: "Moderate rain showers",
        82: "Violent rain showers",
        85: "Slight snow showers",
        86: "Heavy snow showers",
        95: "Thunderstorm",
        96: "Thunderstorm with slight hail",
        99: "Thunderstorm with heavy hail"
    }
    return weather_codes.get(code, f"Unknown weather (code {code})")


def _format_weather(location_data: dict, weather_data: dict) -> str:
    """Format weather data into human-readable string.

    Args:
        location_data: Dictionary with location info (name, country)
        weather_data: Dictionary with weather info (temp, humidity, etc.)

    Returns:
        Formatted weather report string
    """
    location_name = location_data.get("name", "Unknown")
    country = location_data.get("country", "")
    location_str = f"{location_name}, {country}" if country else location_name

    temp = weather_data.get("temperature")
    feels_like = weather_data.get("feels_like")
    humidity = weather_data.get("humidity")
    weather_code = weather_data.get("weather_code", 0)
    cloud_cover = weather_data.get("cloud_cover")
    wind_speed = weather_data.get("wind_speed")
    precipitation = weather_data.get("precipitation")

    weather_desc = _interpret_weather_code(weather_code)

    # Build weather report
    lines = [
        f"Current weather in {location_str}:",
        f"Conditions: {weather_desc}"
    ]

    if temp is not None:
        lines.append(f"Temperature: {temp}°C")

    if feels_like is not None and feels_like != temp:
        lines.append(f"Feels like: {feels_like}°C")

    if humidity is not None:
        lines.append(f"Humidity: {humidity}%")

    if cloud_cover is not None:
        lines.append(f"Cloud cover: {cloud_cover}%")

    if wind_speed is not None:
        lines.append(f"Wind speed: {wind_speed} km/h")

    if precipitation is not None and precipitation > 0:
        lines.append(f"Precipitation: {precipitation} mm")

    return "\n".join(lines)


def get_current_weather(
    location: str
) -> str:
    """Get current weather conditions for a location. USE THIS TOOL ONLY ONCE PER QUERY.

    IMPORTANT: Call this tool ONCE, get the result, then format it into a natural response for the user. DO NOT call this tool multiple times.

    Fetches real-time weather data including temperature, humidity, wind,
    precipitation, and weather conditions. Uses Open-Meteo API (free, no key required).

    Args:
        location: City name or location string (e.g., "New York", "London, UK").

    Returns:
        Formatted weather report with current conditions, temperature, humidity,
        wind speed, and precipitation. Returns error message if location not found
        or weather data unavailable.

    USAGE PATTERN:
    1. User asks: "What's the weather in Tokyo?"
    2. Call get_current_weather(location="Tokyo") - ONCE
    3. Receive result with weather data
    4. Format into natural response: "The weather in Tokyo is currently..."
    5. STOP - Do not call again
    """
    # Validate input
    if not location or len(location.strip()) < 2:
        return "Error: Please provide a valid location name (at least 2 characters)."

    # Geocode location to coordinates
    location_data = _geocode_location(location.strip())

    if not location_data:
        return f"Error: Location '{location}' not found. Please check the spelling and try again."

    # Get weather data
    weather_data = _get_weather(
        location_data["latitude"],
        location_data["longitude"]
    )

    if not weather_data:
        return f"Error: Unable to fetch weather data for {location_data['name']}. Please try again later."

    # Format and return weather report
    return _format_weather(location_data, weather_data)


# Auto-register tool on import
from ..registry import ToolRegistry

_registry = ToolRegistry()
_registry.register(get_current_weather)
