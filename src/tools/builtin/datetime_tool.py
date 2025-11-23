"""DateTime tool for AI agent - timezone-aware current time.

Provides current date and time in any IANA timezone with automatic DST handling.
Uses Python stdlib zoneinfo (PEP 615) for timezone support.
"""

from datetime import datetime
from zoneinfo import ZoneInfo, available_timezones
from langchain_core.tools import tool


def _validate_timezone(tz_name: str) -> bool:
    """Check if timezone name is valid IANA timezone.

    Args:
        tz_name: Timezone identifier to validate

    Returns:
        True if valid IANA timezone, False otherwise

    Example:
        >>> _validate_timezone("UTC")
        True
        >>> _validate_timezone("Invalid/Timezone")
        False
    """
    return tz_name in available_timezones()


def _format_datetime(dt: datetime) -> dict:
    """Format datetime into structured response.

    Args:
        dt: Timezone-aware datetime object

    Returns:
        Dictionary with ISO format, human-readable format, unix timestamp,
        timezone info, UTC offset, and DST status

    Example:
        >>> from datetime import datetime
        >>> from zoneinfo import ZoneInfo
        >>> dt = datetime(2025, 11, 16, 9, 30, tzinfo=ZoneInfo("America/New_York"))
        >>> result = _format_datetime(dt)
        >>> result['iso']
        '2025-11-16T09:30:00-05:00'
    """
    return {
        "iso": dt.isoformat(),
        "formatted": dt.strftime("%A, %B %d, %Y at %I:%M %p %Z"),
        "unix": int(dt.timestamp()),
        "timezone": dt.tzname(),
        "utc_offset": dt.strftime("%z"),
        "is_dst": bool(dt.dst())
    }


def get_current_datetime(
    timezone: str = "UTC"
) -> str:
    """Get current date and time in specified timezone. USE THIS TOOL ONLY ONCE PER QUERY.

    IMPORTANT: Call this tool ONCE, get the result, then format it into a natural response. DO NOT call multiple times.

    Returns current datetime with timezone information in both ISO 8601
    and human-readable formats. Automatically handles DST transitions.

    Args:
        timezone: IANA timezone name (e.g., "UTC", "America/New_York", "Europe/London"). Defaults to UTC.

    Returns:
        Formatted string with current time in requested timezone and UTC.
        Includes ISO 8601 timestamp and human-readable format.

    USAGE PATTERN:
    1. User asks: "What time is it in New York?"
    2. Call get_current_datetime(timezone="America/New_York") - ONCE
    3. Receive result with time data
    4. Format into natural response: "The current time in New York is..."
    5. STOP - Do not call again
    """
    # Validate timezone
    if not _validate_timezone(timezone):
        return f"Error: Invalid timezone '{timezone}'. Use IANA timezone names (e.g., 'America/New_York', 'UTC', 'Europe/London', 'Asia/Tokyo')."

    try:
        # Get current time in UTC
        utc_now = datetime.now(ZoneInfo("UTC")).replace(microsecond=0)  # Remove microseconds for clarity
        utc_data = _format_datetime(utc_now)

        # Convert to requested timezone if not UTC
        if timezone != "UTC":
            local_now = utc_now.astimezone(ZoneInfo(timezone))
            local_data = _format_datetime(local_now)

            # Return LLM-friendly string with dual format
            return (
                f"Current time: {local_data['formatted']} "
                f"({local_data['iso']}) | "
                f"UTC: {utc_data['iso']}"
            )
        else:
            # UTC only
            return f"Current time (UTC): {utc_data['formatted']} ({utc_data['iso']})"

    except Exception as e:
        return f"Error getting datetime: {str(e)}"


# Auto-register tool on import
from ..registry import ToolRegistry

_registry = ToolRegistry()
_registry.register(get_current_datetime, scope="global")
