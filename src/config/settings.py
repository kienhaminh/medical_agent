"""Configuration management for AI Agent."""

import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

import yaml
from dotenv import load_dotenv


@dataclass
class ContextConfig:
    """Context management configuration."""

    max_messages: int = 50
    keep_recent: int = 20
    max_tokens: int = 100000


@dataclass
class SessionConfig:
    """Session management configuration."""

    auto_save: bool = True
    storage_path: str = "sessions"


@dataclass
class LoggingConfig:
    """Logging configuration."""

    level: str = "INFO"
    format: str = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"


@dataclass
class ToolsConfig:
    """Tools configuration."""

    enabled: list[str] = field(default_factory=lambda: ["calculator", "file_ops", "datetime"])


@dataclass
class Config:
    """Main configuration class."""

    # API Configuration
    provider: str = "kimi"
    kimi_api_key: str = ""
    model: str = "kimi-k2-thinking"
    max_tokens: int = 4096
    temperature: float = 0.3

    # Sub-configurations
    context: ContextConfig = field(default_factory=ContextConfig)
    session: SessionConfig = field(default_factory=SessionConfig)
    logging: LoggingConfig = field(default_factory=LoggingConfig)
    tools: ToolsConfig = field(default_factory=ToolsConfig)

    def validate(self) -> None:
        """Validate configuration.

        Raises:
            ValueError: If configuration is invalid.
        """
        if not self.kimi_api_key:
            raise ValueError(
                "KIMI_API_KEY is required for Kimi provider. "
                "Set it in .env file or KIMI_API_KEY environment variable."
            )

        if self.max_tokens <= 0:
            raise ValueError("max_tokens must be positive")

        if not 0 <= self.temperature <= 2:
            raise ValueError("temperature must be between 0 and 2")

        if self.context.max_messages <= 0:
            raise ValueError("context.max_messages must be positive")

        if self.context.keep_recent <= 0:
            raise ValueError("context.keep_recent must be positive")


def load_config(config_file: Optional[Path] = None) -> Config:
    """Load configuration from environment and YAML file.

    Args:
        config_file: Path to YAML config file. Defaults to config/default.yaml

    Returns:
        Config instance

    Raises:
        ValueError: If configuration is invalid
    """
    # Load environment variables
    load_dotenv()

    # Load YAML config
    if config_file is None:
        config_file = Path(__file__).parent.parent.parent / "config" / "default.yaml"

    yaml_config = {}
    if config_file.exists():
        with open(config_file, "r") as f:
            yaml_config = yaml.safe_load(f) or {}

    # Environment variables take precedence over YAML
    provider = "kimi"
    
    kimi_api_key = os.getenv("KIMI_API_KEY", os.getenv("MOONSHOT_API_KEY", ""))
    
    # Determine model based on provider
    model = os.getenv("KIMI_MODEL", "kimi-k2-thinking")
    max_tokens = int(os.getenv("MAX_TOKENS", yaml_config.get("max_tokens", 4096)))
    temperature = float(os.getenv("TEMPERATURE", yaml_config.get("temperature", 0.3)))

    # Load sub-configurations
    context_cfg = yaml_config.get("context", {})
    session_cfg = yaml_config.get("session", {})
    logging_cfg = yaml_config.get("logging", {})
    tools_cfg = yaml_config.get("tools", {})

    config = Config(
        provider=provider,
        kimi_api_key=kimi_api_key,
        model=model,
        max_tokens=max_tokens,
        temperature=temperature,
        context=ContextConfig(
            max_messages=context_cfg.get("max_messages", 50),
            keep_recent=context_cfg.get("keep_recent", 20),
            max_tokens=context_cfg.get("max_tokens", 100000),
        ),
        session=SessionConfig(
            auto_save=session_cfg.get("auto_save", True),
            storage_path=session_cfg.get("storage_path", "sessions"),
        ),
        logging=LoggingConfig(
            level=logging_cfg.get("level", "INFO"),
            format=logging_cfg.get(
                "format", "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
            ),
        ),
        tools=ToolsConfig(enabled=tools_cfg.get("enabled", ["calculator", "file_ops", "datetime"])),
    )

    # Validate configuration
    config.validate()

    return config
