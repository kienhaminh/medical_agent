"""Tests for location tool."""

import pytest
from unittest.mock import Mock, patch
import requests

from src.tools.builtin.location_tool import (
    get_location,
    _get_location_from_ipapi,
    _get_location_from_geoip2,
    _format_location
)


class TestFormatLocation:
    """Test suite for location formatting."""

    def test_format_complete_location(self):
        """Test formatting location with all fields."""
        data = {
            "city": "New York",
            "region": "New York",
            "country": "United States",
            "latitude": 40.7128,
            "longitude": -74.0060,
            "timezone": "America/New_York"
        }
        result = _format_location(data)

        assert "Location:" in result
        assert "New York" in result
        assert "United States" in result
        assert "40.7128" in result
        assert "-74.0060" in result
        assert "America/New_York" in result

    def test_format_location_without_region(self):
        """Test formatting location without region."""
        data = {
            "city": "Tokyo",
            "country": "Japan",
            "latitude": 35.6762,
            "longitude": 139.6503,
            "timezone": "Asia/Tokyo"
        }
        result = _format_location(data)

        assert "Tokyo" in result
        assert "Japan" in result

    def test_format_location_same_city_region(self):
        """Test formatting when city and region are the same."""
        data = {
            "city": "Singapore",
            "region": "Singapore",
            "country": "Singapore",
            "latitude": 1.3521,
            "longitude": 103.8198
        }
        result = _format_location(data)

        # Should only appear once, not duplicated
        assert result.count("Singapore") <= 2  # City and country, not region

    def test_format_location_without_coordinates(self):
        """Test formatting location without coordinates."""
        data = {
            "city": "London",
            "country": "United Kingdom",
            "timezone": "Europe/London"
        }
        result = _format_location(data)

        assert "London" in result
        assert "United Kingdom" in result
        assert "Europe/London" in result

    def test_format_location_without_timezone(self):
        """Test formatting location without timezone."""
        data = {
            "city": "Paris",
            "country": "France",
            "latitude": 48.8566,
            "longitude": 2.3522
        }
        result = _format_location(data)

        assert "Paris" in result
        assert "France" in result
        assert "48.8566" in result

    def test_format_location_minimal_data(self):
        """Test formatting with minimal data."""
        data = {"country": "Australia"}
        result = _format_location(data)

        assert "Australia" in result

    def test_format_location_empty_data(self):
        """Test formatting with empty data."""
        data = {}
        result = _format_location(data)

        assert "Unknown location" in result

    def test_format_location_with_none_region(self):
        """Test formatting when region is None."""
        data = {
            "city": "London",
            "region": None,
            "country": "United Kingdom",
            "latitude": 51.5074,
            "longitude": -0.1278
        }
        result = _format_location(data)

        assert "London" in result
        assert "United Kingdom" in result

    def test_format_location_coordinates_edge_case(self):
        """Test formatting with None coordinates."""
        data = {
            "city": "Paris",
            "country": "France",
            "latitude": None,
            "longitude": -2.3522
        }
        result = _format_location(data)

        assert "Paris" in result
        assert "France" in result
        # Should not include coordinates if either is None
        assert "(" not in result or "None" not in result


class TestGetLocationFromIpapi:
    """Test suite for ipapi.co integration."""

    @patch('src.tools.builtin.location_tool.requests.get')
    def test_get_location_auto_detect(self, mock_get):
        """Test auto-detecting location (no IP provided)."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "ip": "1.2.3.4",
            "city": "New York",
            "region": "New York",
            "country_name": "United States",
            "country_code": "US",
            "latitude": 40.7128,
            "longitude": -74.0060,
            "timezone": "America/New_York"
        }
        mock_get.return_value = mock_response

        result = _get_location_from_ipapi("")

        assert result is not None
        assert result["city"] == "New York"
        assert result["country"] == "United States"
        assert result["timezone"] == "America/New_York"
        mock_get.assert_called_once()
        assert "https://ipapi.co/json/" in mock_get.call_args[0][0]

    @patch('src.tools.builtin.location_tool.requests.get')
    def test_get_location_specific_ip(self, mock_get):
        """Test getting location for specific IP."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "ip": "8.8.8.8",
            "city": "Mountain View",
            "region": "California",
            "country_name": "United States",
            "country_code": "US",
            "latitude": 37.4056,
            "longitude": -122.0775,
            "timezone": "America/Los_Angeles"
        }
        mock_get.return_value = mock_response

        result = _get_location_from_ipapi("8.8.8.8")

        assert result is not None
        assert result["city"] == "Mountain View"
        assert result["ip"] == "8.8.8.8"
        mock_get.assert_called_once()
        assert "8.8.8.8" in mock_get.call_args[0][0]

    @patch('src.tools.builtin.location_tool.requests.get')
    def test_get_location_api_error(self, mock_get):
        """Test handling API error response."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "error": True,
            "reason": "RateLimited"
        }
        mock_get.return_value = mock_response

        result = _get_location_from_ipapi("1.2.3.4")

        assert result is None

    @patch('src.tools.builtin.location_tool.requests.get')
    def test_get_location_network_error(self, mock_get):
        """Test handling network error."""
        mock_get.side_effect = requests.RequestException("Network error")

        result = _get_location_from_ipapi("1.2.3.4")

        assert result is None

    @patch('src.tools.builtin.location_tool.requests.get')
    def test_get_location_http_error(self, mock_get):
        """Test handling HTTP error status codes."""
        mock_response = Mock()
        mock_response.status_code = 429  # Rate limited
        mock_get.return_value = mock_response

        result = _get_location_from_ipapi("1.2.3.4")

        assert result is None

    @patch('src.tools.builtin.location_tool.requests.get')
    def test_get_location_timeout(self, mock_get):
        """Test handling request timeout."""
        mock_get.side_effect = requests.Timeout("Request timed out")

        result = _get_location_from_ipapi("1.2.3.4")

        assert result is None

    @patch('src.tools.builtin.location_tool.requests.get')
    def test_get_location_includes_timeout_param(self, mock_get):
        """Test that request includes timeout parameter."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "ip": "1.2.3.4",
            "city": "Test",
            "country_name": "Test Country"
        }
        mock_get.return_value = mock_response

        _get_location_from_ipapi("1.2.3.4")

        # Verify timeout parameter is set
        call_kwargs = mock_get.call_args[1]
        assert 'timeout' in call_kwargs
        assert call_kwargs['timeout'] == 5


class TestGetLocationFromGeoip2:
    """Test suite for GeoIP2 fallback."""

    def test_get_location_geoip2_not_available(self):
        """Test when GeoIP2 database is not available."""
        # Without mocking, database won't exist
        result = _get_location_from_geoip2("8.8.8.8")
        assert result is None

    @patch('os.path.exists')
    def test_get_location_geoip2_no_database(self, mock_exists):
        """Test when database file doesn't exist."""
        mock_exists.return_value = False

        result = _get_location_from_geoip2("8.8.8.8")

        assert result is None

    def test_get_location_geoip2_import_error(self):
        """Test when geoip2 module is not installed."""
        import sys
        from unittest.mock import patch

        # Simulate ImportError by removing geoip2 from sys.modules
        with patch.dict('sys.modules', {'geoip2': None, 'geoip2.database': None}):
            result = _get_location_from_geoip2("8.8.8.8")
            assert result is None

    def test_get_location_geoip2_exception_handling(self):
        """Test GeoIP2 exception handling."""
        from unittest.mock import patch

        # Simulate exception during database operation
        with patch('os.path.exists', return_value=True):
            # The function will catch any exception and return None
            result = _get_location_from_geoip2("invalid-ip")
            # Should return None gracefully (no database available in test)
            assert result is None


class TestGetLocation:
    """Test suite for get_location tool."""

    @patch('src.tools.builtin.location_tool._get_location_from_ipapi')
    def test_get_location_success(self, mock_ipapi):
        """Test successful location lookup."""
        mock_ipapi.return_value = {
            "ip": "1.2.3.4",
            "city": "New York",
            "region": "New York",
            "country": "United States",
            "latitude": 40.7128,
            "longitude": -74.0060,
            "timezone": "America/New_York"
        }

        result = get_location(ip_address="")

        assert "New York" in result
        assert "United States" in result
        assert "40.7128" in result

    @patch('src.tools.builtin.location_tool._get_location_from_ipapi')
    def test_get_location_with_ip(self, mock_ipapi):
        """Test location lookup with specific IP."""
        mock_ipapi.return_value = {
            "ip": "8.8.8.8",
            "city": "Mountain View",
            "country": "United States",
            "latitude": 37.4056,
            "longitude": -122.0775,
            "timezone": "America/Los_Angeles"
        }

        result = get_location(ip_address="8.8.8.8")

        assert "Mountain View" in result
        mock_ipapi.assert_called_once_with("8.8.8.8")

    @patch('src.tools.builtin.location_tool._get_location_from_geoip2')
    @patch('src.tools.builtin.location_tool._get_location_from_ipapi')
    def test_get_location_fallback_to_geoip2(self, mock_ipapi, mock_geoip2):
        """Test fallback to GeoIP2 when ipapi fails."""
        mock_ipapi.return_value = None
        mock_geoip2.return_value = {
            "ip": "8.8.8.8",
            "city": "Mountain View",
            "country": "United States",
            "latitude": 37.4056,
            "longitude": -122.0775
        }

        result = get_location(ip_address="8.8.8.8")

        assert "Mountain View" in result
        mock_geoip2.assert_called_once_with("8.8.8.8")

    @patch('src.tools.builtin.location_tool._get_location_from_ipapi')
    def test_get_location_all_methods_fail(self, mock_ipapi):
        """Test when all location methods fail."""
        mock_ipapi.return_value = None

        result = get_location(ip_address="999.999.999.999")

        assert "Error" in result
        assert "Unable to determine location" in result

    @patch('src.tools.builtin.location_tool._get_location_from_geoip2')
    @patch('src.tools.builtin.location_tool._get_location_from_ipapi')
    def test_get_location_no_geoip2_fallback_for_auto_detect(self, mock_ipapi, mock_geoip2):
        """Test that GeoIP2 fallback is not used for auto-detect (empty IP)."""
        mock_ipapi.return_value = None

        result = get_location(ip_address="")

        # GeoIP2 should not be called for auto-detect
        mock_geoip2.assert_not_called()
        assert "Error" in result


class TestLocationToolIntegration:
    """Integration tests for location tool."""

    def test_tool_is_callable(self):
        """Test that the tool can be invoked."""
        # This will make actual API call or fail gracefully
        result = get_location(ip_address="8.8.8.8")
        assert isinstance(result, str)
        # Should either succeed or return error message
        assert len(result) > 0

    def test_tool_has_correct_name(self):
        """Test that tool has correct name."""
        assert get_location.__name__ == "get_location"

    def test_tool_has_docstring(self):
        """Test that tool has docstring."""
        assert get_location.__doc__ is not None
        assert len(get_location.__doc__) > 0

    def test_tool_with_empty_args(self):
        """Test tool with empty arguments (auto-detect)."""
        result = get_location()
        assert isinstance(result, str)

    def test_tool_registered_on_import(self):
        """Test that tool is auto-registered on module import."""
        from src.tools.registry import ToolRegistry

        registry = ToolRegistry()
        tool = registry.get("get_location")
        assert tool is not None
        assert tool.__name__ == "get_location"
