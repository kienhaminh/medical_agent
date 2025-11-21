"""Custom exceptions for AI Agent."""


class AIAgentError(Exception):
    """Base exception for AI Agent."""

    pass


class ConfigurationError(AIAgentError):
    """Configuration related errors."""

    pass


class LLMProviderError(AIAgentError):
    """LLM provider related errors."""

    pass


class RateLimitError(LLMProviderError):
    """Rate limit exceeded."""

    pass


class APIError(LLMProviderError):
    """API call failed."""

    pass


class ContextError(AIAgentError):
    """Context management errors."""

    pass


class ToolError(AIAgentError):
    """Tool execution errors."""

    pass
