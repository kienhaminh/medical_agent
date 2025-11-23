"""Abstract LLM provider interface."""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import AsyncIterator, Iterator, Literal, Union
from ..utils.enums import MessageRole


@dataclass
class Message:
    """Chat message."""

    role: MessageRole
    content: str
    tool_call_id: str | None = None  # For ToolMessage
    tool_calls: list | None = None  # For AssistantMessage


@dataclass
class LLMResponse:
    """Response from LLM provider."""

    content: str
    model: str
    usage: dict
    stop_reason: str | None = None
    tool_calls: list | None = None  # List of ToolCall objects from LLM


class LLMProvider(ABC):
    """Abstract base class for LLM providers."""

    @abstractmethod
    def generate(self, messages: list[Message], **kwargs) -> LLMResponse:
        """Generate a response from the LLM.

        Args:
            messages: List of chat messages
            **kwargs: Additional provider-specific parameters

        Returns:
            LLMResponse with content and metadata

        Raises:
            LLMProviderError: If generation fails
        """
        pass

    @abstractmethod
    def stream(self, messages: list[Message], **kwargs) -> Iterator[Union[str, dict]]:
        """Stream response from the LLM.

        Args:
            messages: List of chat messages
            **kwargs: Additional provider-specific parameters

        Yields:
            Text chunks as they arrive

        Raises:
            LLMProviderError: If streaming fails
        """
        pass

    @abstractmethod
    def count_tokens(self, text: str) -> int:
        """Count tokens in text.

        Args:
            text: Text to count tokens for

        Returns:
            Number of tokens
        """
        pass
