"""Tests for weather tool."""

import pytest
from unittest.mock import Mock, patch
import requests

from src.tools.builtin.weather_tool import (
    get_current_weather,
    _geocode_location,
    _get_weather,
    _interpret_weather_code,
    _format_weather
)


class TestInterpretWeatherCode:
    """Test suite for weather code interpretation."""

    def test_clear_sky(self):
        """Test clear sky code."""
        assert _interpret_weather_code(0) == "Clear sky"

    def test_cloudy_codes(self):
        """Test cloudy weather codes."""
        assert _interpret_weather_code(1) == "Mainly clear"
        assert _interpret_weather_code(2) == "Partly cloudy"
        assert _interpret_weather_code(3) == "Overcast"

    def test_fog_codes(self):
        """Test fog codes."""
        assert _interpret_weather_code(45) == "Foggy"
        assert _interpret_weather_code(48) == "Depositing rime fog"

    def test_drizzle_codes(self):
        """Test drizzle codes."""
        assert _interpret_weather_code(51) == "Light drizzle"
        assert _interpret_weather_code(53) == "Moderate drizzle"
        assert _interpret_weather_code(55) == "Dense drizzle"

    def test_rain_codes(self):
        """Test rain codes."""
        assert _interpret_weather_code(61) == "Slight rain"
        assert _interpret_weather_code(63) == "Moderate rain"
        assert _interpret_weather_code(65) == "Heavy rain"

    def test_snow_codes(self):
        """Test snow codes."""
        assert _interpret_weather_code(71) == "Slight snow"
        assert _interpret_weather_code(73) == "Moderate snow"
        assert _interpret_weather_code(75) == "Heavy snow"
        assert _interpret_weather_code(77) == "Snow grains"

    def test_shower_codes(self):
        """Test shower codes."""
        assert _interpret_weather_code(80) == "Slight rain showers"
        assert _interpret_weather_code(81) == "Moderate rain showers"
        assert _interpret_weather_code(82) == "Violent rain showers"
        assert _interpret_weather_code(85) == "Slight snow showers"
        assert _interpret_weather_code(86) == "Heavy snow showers"

    def test_thunderstorm_codes(self):
        """Test thunderstorm codes."""
        assert _interpret_weather_code(95) == "Thunderstorm"
        assert _interpret_weather_code(96) == "Thunderstorm with slight hail"
        assert _interpret_weather_code(99) == "Thunderstorm with heavy hail"

    def test_unknown_code(self):
        """Test unknown weather code."""
        result = _interpret_weather_code(999)
        assert "Unknown weather" in result
        assert "999" in result


class TestFormatWeather:
    """Test suite for weather formatting."""

    def test_format_complete_weather(self):
        """Test formatting with all weather fields."""
        location_data = {
            "name": "Berlin",
            "country": "Germany"
        }
        weather_data = {
            "temperature": 15.3,
            "feels_like": 14.1,
            "humidity": 72,
            "weather_code": 2,
            "cloud_cover": 45,
            "wind_speed": 12.5,
            "precipitation": 0.0
        }
        result = _format_weather(location_data, weather_data)

        assert "Berlin, Germany" in result
        assert "Partly cloudy" in result
        assert "15.3°C" in result
        assert "14.1°C" in result
        assert "72%" in result
        assert "45%" in result
        assert "12.5 km/h" in result

    def test_format_weather_with_precipitation(self):
        """Test formatting with active precipitation."""
        location_data = {"name": "London", "country": "UK"}
        weather_data = {
            "temperature": 10.0,
            "humidity": 85,
            "weather_code": 63,
            "precipitation": 2.5
        }
        result = _format_weather(location_data, weather_data)

        assert "London, UK" in result
        assert "Moderate rain" in result
        assert "2.5 mm" in result

    def test_format_weather_without_country(self):
        """Test formatting without country name."""
        location_data = {"name": "Tokyo"}
        weather_data = {
            "temperature": 20.0,
            "weather_code": 0
        }
        result = _format_weather(location_data, weather_data)

        assert "Tokyo" in result
        assert "Tokyo," not in result  # No comma when no country

    def test_format_weather_same_temp_and_feels_like(self):
        """Test formatting when temperature equals feels like."""
        location_data = {"name": "Test", "country": "Test"}
        weather_data = {
            "temperature": 15.0,
            "feels_like": 15.0,
            "weather_code": 1
        }
        result = _format_weather(location_data, weather_data)

        # Should not show "Feels like" when same as actual temp
        assert result.count("15.0°C") == 1

    def test_format_weather_minimal_data(self):
        """Test formatting with minimal weather data."""
        location_data = {"name": "City"}
        weather_data = {"weather_code": 0}
        result = _format_weather(location_data, weather_data)

        assert "City" in result
        assert "Clear sky" in result


class TestGeocodeLocation:
    """Test suite for location geocoding."""

    @patch('src.tools.builtin.weather_tool.requests.get')
    def test_geocode_success(self, mock_get):
        """Test successful geocoding."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "results": [{
                "latitude": 52.52437,
                "longitude": 13.41053,
                "name": "Berlin",
                "country": "Germany",
                "timezone": "Europe/Berlin",
                "elevation": 74.0
            }]
        }
        mock_get.return_value = mock_response

        result = _geocode_location("Berlin")

        assert result is not None
        assert result["latitude"] == 52.52437
        assert result["longitude"] == 13.41053
        assert result["name"] == "Berlin"
        assert result["country"] == "Germany"
        assert result["timezone"] == "Europe/Berlin"

    @patch('src.tools.builtin.weather_tool.requests.get')
    def test_geocode_not_found(self, mock_get):
        """Test geocoding when location not found."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"results": []}
        mock_get.return_value = mock_response

        result = _geocode_location("InvalidCity12345")

        assert result is None

    @patch('src.tools.builtin.weather_tool.requests.get')
    def test_geocode_api_error(self, mock_get):
        """Test geocoding with API error."""
        mock_response = Mock()
        mock_response.status_code = 500
        mock_get.return_value = mock_response

        result = _geocode_location("Berlin")

        assert result is None

    @patch('src.tools.builtin.weather_tool.requests.get')
    def test_geocode_network_error(self, mock_get):
        """Test geocoding with network error."""
        mock_get.side_effect = requests.RequestException("Network error")

        result = _geocode_location("Berlin")

        assert result is None

    @patch('src.tools.builtin.weather_tool.requests.get')
    def test_geocode_timeout(self, mock_get):
        """Test geocoding with timeout."""
        mock_get.side_effect = requests.Timeout("Request timed out")

        result = _geocode_location("Berlin")

        assert result is None

    def test_geocode_empty_location(self):
        """Test geocoding with empty location."""
        assert _geocode_location("") is None
        assert _geocode_location("a") is None

    @patch('src.tools.builtin.weather_tool.requests.get')
    def test_geocode_malformed_response(self, mock_get):
        """Test geocoding with malformed JSON response."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.side_effect = ValueError("Invalid JSON")
        mock_get.return_value = mock_response

        result = _geocode_location("Berlin")

        assert result is None

    @patch('src.tools.builtin.weather_tool.requests.get')
    def test_geocode_includes_timeout_param(self, mock_get):
        """Test that geocoding includes timeout parameter."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "results": [{"latitude": 0, "longitude": 0, "name": "Test"}]
        }
        mock_get.return_value = mock_response

        _geocode_location("Test")

        call_kwargs = mock_get.call_args[1]
        assert 'timeout' in call_kwargs
        assert call_kwargs['timeout'] == 10


class TestGetWeather:
    """Test suite for weather data fetching."""

    @patch('src.tools.builtin.weather_tool.requests.get')
    def test_get_weather_success(self, mock_get):
        """Test successful weather fetch."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "current": {
                "temperature_2m": 15.3,
                "apparent_temperature": 14.1,
                "relative_humidity_2m": 72,
                "precipitation": 0.0,
                "weather_code": 2,
                "cloud_cover": 45,
                "wind_speed_10m": 12.5,
                "wind_direction_10m": 180
            },
            "timezone": "Europe/Berlin"
        }
        mock_get.return_value = mock_response

        result = _get_weather(52.52, 13.41)

        assert result is not None
        assert result["temperature"] == 15.3
        assert result["feels_like"] == 14.1
        assert result["humidity"] == 72
        assert result["weather_code"] == 2
        assert result["wind_speed"] == 12.5

    @patch('src.tools.builtin.weather_tool.requests.get')
    def test_get_weather_api_error(self, mock_get):
        """Test weather fetch with API error."""
        mock_response = Mock()
        mock_response.status_code = 500
        mock_get.return_value = mock_response

        result = _get_weather(52.52, 13.41)

        assert result is None

    @patch('src.tools.builtin.weather_tool.requests.get')
    def test_get_weather_network_error(self, mock_get):
        """Test weather fetch with network error."""
        mock_get.side_effect = requests.RequestException("Network error")

        result = _get_weather(52.52, 13.41)

        assert result is None

    @patch('src.tools.builtin.weather_tool.requests.get')
    def test_get_weather_malformed_response(self, mock_get):
        """Test weather fetch with malformed response."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {}  # Missing "current" key
        mock_get.return_value = mock_response

        result = _get_weather(52.52, 13.41)

        assert result is None

    @patch('src.tools.builtin.weather_tool.requests.get')
    def test_get_weather_includes_timeout_param(self, mock_get):
        """Test that weather fetch includes timeout parameter."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "current": {"temperature_2m": 15.0}
        }
        mock_get.return_value = mock_response

        _get_weather(52.52, 13.41)

        call_kwargs = mock_get.call_args[1]
        assert 'timeout' in call_kwargs
        assert call_kwargs['timeout'] == 10


class TestGetCurrentWeather:
    """Test suite for get_current_weather tool."""

    @patch('src.tools.builtin.weather_tool._get_weather')
    @patch('src.tools.builtin.weather_tool._geocode_location')
    def test_get_weather_success(self, mock_geocode, mock_weather):
        """Test successful weather lookup."""
        mock_geocode.return_value = {
            "latitude": 52.52437,
            "longitude": 13.41053,
            "name": "Berlin",
            "country": "Germany"
        }
        mock_weather.return_value = {
            "temperature": 15.3,
            "feels_like": 14.1,
            "humidity": 72,
            "weather_code": 2,
            "cloud_cover": 45,
            "wind_speed": 12.5,
            "precipitation": 0.0
        }

        result = get_current_weather(location="Berlin")

        assert "Berlin, Germany" in result
        assert "Partly cloudy" in result
        assert "15.3°C" in result
        mock_geocode.assert_called_once_with("Berlin")
        mock_weather.assert_called_once_with(52.52437, 13.41053)

    @patch('src.tools.builtin.weather_tool._geocode_location')
    def test_get_weather_location_not_found(self, mock_geocode):
        """Test weather lookup with location not found."""
        mock_geocode.return_value = None

        result = get_current_weather(location="InvalidCity12345")

        assert "Error" in result
        assert "not found" in result
        assert "InvalidCity12345" in result

    @patch('src.tools.builtin.weather_tool._get_weather')
    @patch('src.tools.builtin.weather_tool._geocode_location')
    def test_get_weather_api_failure(self, mock_geocode, mock_weather):
        """Test weather lookup with API failure."""
        mock_geocode.return_value = {
            "latitude": 52.52,
            "longitude": 13.41,
            "name": "Berlin",
            "country": "Germany"
        }
        mock_weather.return_value = None

        result = get_current_weather(location="Berlin")

        assert "Error" in result
        assert "Unable to fetch weather data" in result

    def test_get_weather_empty_location(self):
        """Test weather lookup with empty location."""
        result = get_current_weather(location="")

        assert "Error" in result
        assert "valid location name" in result

    def test_get_weather_short_location(self):
        """Test weather lookup with too short location."""
        result = get_current_weather(location="a")

        assert "Error" in result
        assert "at least 2 characters" in result

    def test_get_weather_whitespace_location(self):
        """Test weather lookup with whitespace-only location."""
        result = get_current_weather(location="   ")

        assert "Error" in result
        assert "valid location name" in result


class TestWeatherToolIntegration:
    """Integration tests for weather tool."""

    def test_tool_is_callable(self):
        """Test that the tool can be invoked."""
        # This will make actual API call or fail gracefully
        result = get_current_weather(location="London")
        assert isinstance(result, str)
        assert len(result) > 0

    def test_tool_has_correct_name(self):
        """Test that tool has correct name."""
        assert get_current_weather.__name__ == "get_current_weather"

    def test_tool_has_docstring(self):
        """Test that tool has docstring."""
        assert get_current_weather.__doc__ is not None
        assert len(get_current_weather.__doc__) > 0

    def test_tool_registered_on_import(self):
        """Test that tool is available from builtin module."""
        from src.tools.builtin import get_current_weather as imported_tool

        # Verify tool is importable from builtin module
        assert imported_tool is not None
        assert imported_tool.__name__ == "get_current_weather"
        assert imported_tool == get_current_weather
