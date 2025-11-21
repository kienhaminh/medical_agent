"""Tests for configuration management."""

import pytest

from src.config.settings import Config, ContextConfig, load_config


def test_config_validation():
    """Test config validation."""
    # Valid config
    config = Config(google_api_key="test-key")
    config.validate()  # Should not raise

    # Invalid: missing API key
    with pytest.raises(ValueError, match="GOOGLE_API_KEY is required"):
        config = Config(google_api_key="")
        config.validate()

    # Invalid: negative max_tokens
    with pytest.raises(ValueError, match="max_tokens must be positive"):
        config = Config(google_api_key="test-key", max_tokens=-1)
        config.validate()

    # Invalid: temperature out of range
    with pytest.raises(ValueError, match="temperature must be between"):
        config = Config(google_api_key="test-key", temperature=3.0)
        config.validate()


def test_load_config_from_env(monkeypatch, tmp_path):
    """Test loading config from environment variables."""
    # Ensure no interfering env vars
    monkeypatch.delenv("GEMINI_MODEL", raising=False)
    
    # Mock load_dotenv to avoid reading local .env
    with pytest.warns(None) as record: # Suppress warnings if any
        pass
    
    # We need to patch load_dotenv in the module where it's used
    monkeypatch.setattr("src.config.settings.load_dotenv", lambda: None)

    # Set environment variable
    monkeypatch.setenv("GOOGLE_API_KEY", "test-key")

    # Create empty YAML file
    config_file = tmp_path / "test_config.yaml"
    config_file.write_text("")

    config = load_config(config_file)

    assert config.google_api_key == "test-key"
    assert config.model == "gemini-pro"


def test_config_defaults():
    """Test default config values."""
    config = Config(google_api_key="test-key")

    assert config.model == "gemini-pro"
    assert config.max_tokens == 4096
    assert config.temperature == 0.7
    assert isinstance(config.context, ContextConfig)
    assert config.context.max_messages == 50
