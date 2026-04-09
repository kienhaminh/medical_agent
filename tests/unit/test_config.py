"""Unit tests for config loading."""
import os
import pytest
from pathlib import Path

from src.config.settings import load_config, Config, ContextConfig


class TestConfigLoading:
    """Test configuration loading."""
    
    def test_load_config_default(self):
        """Test loading default config."""
        # Clear cache first
        load_config.cache_clear()
        
        config = load_config()
        
        assert isinstance(config, Config)
        assert config.provider in ["kimi", "gemini"]
        assert config.max_tokens > 0
        assert 0 <= config.temperature <= 2
    
    def test_config_from_env(self, monkeypatch):
        """Test loading config from environment variables."""
        load_config.cache_clear()
        
        monkeypatch.setenv("AI_PROVIDER", "gemini")
        monkeypatch.setenv("MODEL", "gemini-2.5-pro")
        monkeypatch.setenv("MAX_TOKENS", "2048")
        monkeypatch.setenv("TEMPERATURE", "0.5")
        
        config = load_config()
        
        assert config.provider == "gemini"
        assert config.model == "gemini-2.5-pro"
        assert config.max_tokens == 2048
        assert config.temperature == 0.5
    
    def test_config_caching(self):
        """Test that config is cached."""
        load_config.cache_clear()
        
        config1 = load_config()
        config2 = load_config()
        
        # Should be the same object due to caching
        assert config1 is config2
    
    def test_context_config_defaults(self):
        """Test context config defaults."""
        ctx_config = ContextConfig()
        
        assert ctx_config.max_messages == 50
        assert ctx_config.keep_recent == 20
        assert ctx_config.max_tokens == 100000


class TestConfigValidation:
    """Test configuration validation."""
    
    def test_validate_max_tokens_positive(self):
        """Test validation for positive max_tokens."""
        config = Config()
        config.provider = "kimi"
        config.max_tokens = 100
        config.kimi_api_key = "test-key"
        # Should not raise
        config.validate()

    def test_validate_temperature_range(self):
        """Test validation for temperature range."""
        config = Config()
        config.provider = "kimi"
        config.kimi_api_key = "test-key"

        config.temperature = 0
        config.validate()

        config.temperature = 2
        config.validate()

        config.temperature = 1.5
        config.validate()
