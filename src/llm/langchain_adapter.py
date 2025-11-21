"""Adapter to use LangChain LLMs with existing LLMProvider interface."""

from typing import Iterator
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import (
    HumanMessage,
    SystemMessage,
    AIMessage,
    ToolMessage,
)

from .provider import LLMProvider, LLMResponse, Message


class LangChainAdapter(LLMProvider):
    """Adapter for LangChain chat models to LLMProvider interface."""

    def __init__(self, llm: BaseChatModel):
        """Initialize adapter with a LangChain chat model.

        Args:
            llm: LangChain BaseChatModel instance (ChatOpenAI, etc.)
        """
        self.llm = llm

    def _convert_messages(self, messages: list[Message]) -> list:
        """Convert Message to LangChain message objects.

        Args:
            messages: List of Message objects

        Returns:
            List of LangChain message objects
        """
        lc_messages = []
        for msg in messages:
            if msg.role == "system":
                lc_messages.append(SystemMessage(content=msg.content))
            elif msg.role == "user":
                lc_messages.append(HumanMessage(content=msg.content))
            elif msg.role == "assistant":
                tool_calls = []
                if msg.tool_calls:
                    # Ensure tool calls are in the format LangChain expects
                    for tc in msg.tool_calls:
                        tool_calls.append({
                            "name": tc.get("name"),
                            "args": tc.get("args"),
                            "id": tc.get("id")
                        })
                lc_messages.append(AIMessage(content=msg.content, tool_calls=tool_calls))
            elif msg.role == "tool":
                lc_messages.append(
                    ToolMessage(
                        content=msg.content, tool_call_id=msg.tool_call_id or ""
                    )
                )
        return lc_messages

    def generate(self, messages: list[Message], **kwargs) -> LLMResponse:
        """Generate a response from the LLM.

        Args:
            messages: List of chat messages
            **kwargs: Additional provider-specific parameters

        Returns:
            LLMResponse with content and metadata
        """
        lc_messages = self._convert_messages(messages)
        response = self.llm.invoke(lc_messages, **kwargs)

        # Extract tool calls if present
        tool_calls = None
        if hasattr(response, "tool_calls") and response.tool_calls:
            tool_calls = [
                {
                    "name": tc.get("name"),
                    "args": tc.get("args"),
                    "id": tc.get("id", tc.get("name")),
                }
                for tc in response.tool_calls
            ]

        # Extract usage metadata
        usage = {"input_tokens": 0, "output_tokens": 0}
        if hasattr(response, "usage_metadata") and response.usage_metadata:
            usage = {
                "input_tokens": response.usage_metadata.get("input_tokens", 0),
                "output_tokens": response.usage_metadata.get("output_tokens", 0),
            }

        # Get model name
        model_name = getattr(self.llm, "model_name", "unknown")

        return LLMResponse(
            content=response.content,
            model=model_name,
            usage=usage,
            stop_reason="stop",
            tool_calls=tool_calls,
        )

    def stream(self, messages: list[Message], **kwargs) -> Iterator[str]:
        """Stream response from the LLM.

        Args:
            messages: List of chat messages
            **kwargs: Additional provider-specific parameters

        Yields:
            Text chunks as they arrive
        """
        lc_messages = self._convert_messages(messages)
        for chunk in self.llm.stream(lc_messages, **kwargs):
            if chunk.content:
                yield chunk.content

    def count_tokens(self, text: str) -> int:
        """Count tokens in text.

        Args:
            text: Text to count tokens for

        Returns:
            Number of tokens
        """
        # Use LangChain's token counter if available
        try:
            return self.llm.get_num_tokens(text)
        except (AttributeError, NotImplementedError):
            # Fallback estimate: ~4 chars per token
            return len(text) // 4
