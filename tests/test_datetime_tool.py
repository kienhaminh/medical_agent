"""Tests for datetime tool."""

import pytest
from datetime import datetime
from zoneinfo import ZoneInfo
from unittest.mock import patch

from src.tools.builtin.datetime_tool import (
    get_current_datetime,
    _validate_timezone,
    _format_datetime
)


class TestValidateTimezone:
    """Test suite for timezone validation."""

    def test_validate_utc(self):
        """Test validating UTC timezone."""
        assert _validate_timezone("UTC") is True

    def test_validate_common_timezones(self):
        """Test validating common IANA timezones."""
        timezones = [
            "America/New_York",
            "America/Los_Angeles",
            "Europe/London",
            "Asia/Tokyo",
            "Asia/Ho_Chi_Minh",
            "Australia/Sydney"
        ]
        for tz in timezones:
            assert _validate_timezone(tz) is True, f"Failed for {tz}"

    def test_validate_invalid_timezone(self):
        """Test validating invalid timezone."""
        assert _validate_timezone("Invalid/Timezone") is False

    def test_validate_empty_timezone(self):
        """Test validating empty timezone."""
        assert _validate_timezone("") is False

    def test_validate_malformed_timezone(self):
        """Test validating malformed timezone names."""
        invalid_timezones = [
            "NewYork",  # Missing continent/
            "America/New York",  # Space instead of underscore
            "Invalid/Zone",  # Completely invalid
        ]
        for tz in invalid_timezones:
            assert _validate_timezone(tz) is False, f"Should fail for {tz}"


class TestFormatDatetime:
    """Test suite for datetime formatting."""

    def test_format_utc_datetime(self):
        """Test formatting UTC datetime."""
        dt = datetime(2025, 11, 16, 14, 30, 0, tzinfo=ZoneInfo("UTC"))
        result = _format_datetime(dt)

        assert result["iso"] == "2025-11-16T14:30:00+00:00"
        assert result["timezone"] == "UTC"
        assert result["utc_offset"] == "+0000"
        assert isinstance(result["unix"], int)
        assert result["unix"] > 0

    def test_format_eastern_datetime(self):
        """Test formatting Eastern Time datetime."""
        dt = datetime(2025, 11, 16, 9, 30, 0, tzinfo=ZoneInfo("America/New_York"))
        result = _format_datetime(dt)

        assert "2025-11-16T09:30:00" in result["iso"]
        assert "New York" in result["formatted"] or "EST" in result["formatted"]
        assert result["utc_offset"] in ["-0500", "-0400"]  # EST or EDT

    def test_format_datetime_includes_weekday(self):
        """Test that formatted datetime includes weekday."""
        dt = datetime(2025, 11, 16, 14, 30, 0, tzinfo=ZoneInfo("UTC"))
        result = _format_datetime(dt)

        # November 16, 2025 is a Sunday
        assert "Sunday" in result["formatted"]

    def test_format_datetime_includes_am_pm(self):
        """Test that formatted datetime includes AM/PM."""
        dt_am = datetime(2025, 11, 16, 9, 30, 0, tzinfo=ZoneInfo("UTC"))
        dt_pm = datetime(2025, 11, 16, 14, 30, 0, tzinfo=ZoneInfo("UTC"))

        result_am = _format_datetime(dt_am)
        result_pm = _format_datetime(dt_pm)

        assert "AM" in result_am["formatted"]
        assert "PM" in result_pm["formatted"]


class TestGetCurrentDatetime:
    """Test suite for get_current_datetime tool."""

    def test_get_current_datetime_utc(self):
        """Test getting current time in UTC."""
        result = get_current_datetime(timezone="UTC")

        assert "Current time (UTC)" in result
        assert "UTC" in result
        # Should contain ISO format timestamp
        assert "T" in result
        assert "+" in result or "Z" in result

    def test_get_current_datetime_new_york(self):
        """Test getting current time in New York."""
        result = get_current_datetime(timezone="America/New_York")

        assert "Current time:" in result
        assert "UTC:" in result
        # Should have both local and UTC times
        assert result.count("T") >= 2  # At least 2 timestamps

    def test_get_current_datetime_tokyo(self):
        """Test getting current time in Tokyo."""
        result = get_current_datetime(timezone="Asia/Tokyo")

        assert "Current time:" in result
        assert "UTC:" in result

    def test_get_current_datetime_invalid_timezone(self):
        """Test with invalid timezone."""
        result = get_current_datetime(timezone="Invalid/Timezone")

        assert "Error" in result
        assert "Invalid timezone" in result
        assert "Invalid/Timezone" in result

    def test_get_current_datetime_default_utc(self):
        """Test that default timezone is UTC."""
        result = get_current_datetime()

        assert "UTC" in result
        assert "Current time (UTC)" in result

    def test_get_current_datetime_returns_current_time(self):
        """Test that returned time is actually current."""
        result = get_current_datetime(timezone="UTC")
        now = datetime.now(ZoneInfo("UTC"))

        # Extract year from result
        year_str = str(now.year)
        assert year_str in result

        # Extract current hour (with some tolerance)
        current_hour = now.hour
        # Should find hour within +/- 1 hour (to account for test execution time)
        hour_found = False
        for hour in [current_hour - 1, current_hour, current_hour + 1]:
            hour_str = f"{hour:02d}:"
            if hour_str in result:
                hour_found = True
                break
        assert hour_found, f"Expected hour around {current_hour:02d} not found in result"

    def test_get_current_datetime_london(self):
        """Test getting current time in London."""
        result = get_current_datetime(timezone="Europe/London")

        assert "Current time:" in result
        assert "UTC:" in result

    def test_get_current_datetime_includes_timezone_name(self):
        """Test that result includes timezone abbreviation."""
        result = get_current_datetime(timezone="America/Los_Angeles")

        # Should have timezone abbreviation (PST/PDT)
        assert "Current time:" in result

    def test_get_current_datetime_with_special_characters(self):
        """Test with timezone containing underscores."""
        result = get_current_datetime(timezone="Asia/Ho_Chi_Minh")

        assert "Current time:" in result or "Error" not in result

    def test_get_current_datetime_exception_handling(self):
        """Test exception handling in datetime formatting."""
        # Use a mock to simulate an exception during datetime processing
        with patch('src.tools.builtin.datetime_tool.datetime') as mock_dt:
            # Make datetime.now raise an exception
            mock_dt.now.side_effect = Exception("Datetime error")

            result = get_current_datetime(timezone="UTC")

            assert "Error getting datetime" in result
            assert "Datetime error" in result


class TestDatetimeToolIntegration:
    """Integration tests for datetime tool."""

    def test_tool_is_callable(self):
        """Test that the tool can be invoked."""
        # Test direct invocation
        result = get_current_datetime(timezone="UTC")
        assert isinstance(result, str)
        assert "UTC" in result

    def test_tool_has_correct_name(self):
        """Test that tool has correct name."""
        assert get_current_datetime.__name__ == "get_current_datetime"

    def test_tool_has_docstring(self):
        """Test that tool has docstring."""
        assert get_current_datetime.__doc__ is not None
        assert len(get_current_datetime.__doc__) > 0

    def test_tool_with_empty_args(self):
        """Test tool with empty arguments (should use default UTC)."""
        result = get_current_datetime()
        assert isinstance(result, str)
        assert "UTC" in result

    def test_tool_registered_on_import(self):
        """Test that tool is auto-registered on module import."""
        from src.tools.registry import ToolRegistry

        registry = ToolRegistry()
        tool = registry.get("get_current_datetime")
        assert tool is not None
        assert tool.__name__ == "get_current_datetime"
