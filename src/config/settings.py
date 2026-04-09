"""Configuration management for AI Agent."""

import functools
import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional

import yaml


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
class SkillsConfig:
    """Skills configuration."""

    core_dir: str = "src/skills"
    custom_dir: str = "./custom_skills"
    external_dir: str = "./external_skills"


@dataclass
class Config:
    """Main configuration class."""

    # API Configuration
    provider: str = "openai"
    kimi_api_key: str = ""
    openai_api_key: str = ""
    model: str = "gpt-4o"
    max_tokens: int = 4096
    temperature: float = 0.3
    redis_url: str = "redis://localhost:6379/0"

    # CORS Configuration
    cors_origins: list[str] = field(default_factory=lambda: ["http://localhost:3000"])

    # Sub-configurations
    context: ContextConfig = field(default_factory=ContextConfig)
    session: SessionConfig = field(default_factory=SessionConfig)
    logging: LoggingConfig = field(default_factory=LoggingConfig)
    tools: ToolsConfig = field(default_factory=ToolsConfig)
    skills: SkillsConfig = field(default_factory=SkillsConfig)

    def validate(self) -> None:
        """Validate configuration.

        Raises:
            ValueError: If configuration is invalid.
        """
        if self.provider == "openai" and not self.openai_api_key:
            raise ValueError(
                "OPENAI_API_KEY is required for OpenAI provider. "
                "Set it in .env file or OPENAI_API_KEY environment variable."
            )
        if self.provider == "kimi" and not self.kimi_api_key:
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


def _load_config_impl(config_file: Optional[Path] = None) -> Config:
    """Internal implementation of config loading.
    
    Use load_config() which is cached.
    """
    # Load YAML config
    if config_file is None:
        config_file = Path(__file__).parent.parent.parent / "config" / "default.yaml"

    yaml_config: dict[str, Any] = {}
    if config_file.exists():
        with open(config_file, "r") as f:
            yaml_config = yaml.safe_load(f) or {}

    # Environment variables take precedence over YAML
    provider = os.getenv("AI_PROVIDER", yaml_config.get("provider", "openai"))

    kimi_api_key = os.getenv("KIMI_API_KEY", os.getenv("MOONSHOT_API_KEY", ""))
    openai_api_key = os.getenv("OPENAI_API_KEY", "")

    # Determine model: env var > yaml providers section > yaml model fallback
    providers_cfg = yaml_config.get("providers", {})
    provider_cfg = providers_cfg.get(provider, {})
    provider_model = provider_cfg.get("model", yaml_config.get("model", "gpt-5.4-mini"))
    model = os.getenv("MODEL", provider_model)
    max_tokens = int(os.getenv("MAX_TOKENS", yaml_config.get("max_tokens", 4096)))
    # Per-provider temperature takes precedence over global default
    global_temperature = yaml_config.get("temperature", 0.3)
    default_temperature = provider_cfg.get("temperature", global_temperature)
    temperature = float(os.getenv("TEMPERATURE", default_temperature))
    redis_url = os.getenv("REDIS_URL", yaml_config.get("redis_url", "redis://localhost:6379/0"))

    cors_origins = yaml_config.get("cors_origins", ["http://localhost:3000"])
    cors_origins_env = os.getenv("CORS_ORIGINS")
    if cors_origins_env:
        cors_origins = [o.strip() for o in cors_origins_env.split(",")]

    # Load sub-configurations
    context_cfg = yaml_config.get("context", {})
    session_cfg = yaml_config.get("session", {})
    logging_cfg = yaml_config.get("logging", {})
    tools_cfg = yaml_config.get("tools", {})
    skills_cfg = yaml_config.get("skills", {})

    config = Config(
        provider=provider,
        kimi_api_key=kimi_api_key,
        openai_api_key=openai_api_key,
        model=model,
        max_tokens=max_tokens,
        temperature=temperature,
        redis_url=redis_url,
        cors_origins=cors_origins,
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
        skills=SkillsConfig(
            core_dir=skills_cfg.get("core_dir", "src/skills"),
            custom_dir=skills_cfg.get("custom_dir", "./custom_skills"),
            external_dir=skills_cfg.get("external_dir", "./external_skills"),
        ),
    )

    # Validate configuration
    config.validate()

    return config


@functools.lru_cache(maxsize=1)
def load_config(config_file: Optional[Path] = None) -> Config:
    """Load configuration from environment and YAML file.
    
    This function is cached - the config is loaded only once per process.
    Environment variables are read at first call.

    Args:
        config_file: Path to YAML config file. Defaults to config/default.yaml

    Returns:
        Config instance

    Raises:
        ValueError: If configuration is invalid
    """
    return _load_config_impl(config_file)
