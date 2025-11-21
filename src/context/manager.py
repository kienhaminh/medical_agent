"""Context management for conversations."""

from datetime import datetime
from typing import Literal

from ..llm.provider import Message


class ContextManager:
    """Manages conversation context and message history."""

    def __init__(
        self,
        max_messages: int = 50,
        keep_recent: int = 20,
        max_tokens: int = 100000,
    ):
        """Initialize context manager.

        Args:
            max_messages: Maximum number of messages to keep
            keep_recent: Number of recent messages to always keep
            max_tokens: Maximum tokens to keep in context
        """
        self.max_messages = max_messages
        self.keep_recent = keep_recent
        self.max_tokens = max_tokens
        self.messages: list[Message] = []
        self._token_counter = None

    def set_token_counter(self, counter):
        """Set token counting function.

        Args:
            counter: Function that takes text and returns token count
        """
        self._token_counter = counter

    def add_message(
        self,
        role: Literal["user", "assistant", "system", "tool"],
        content: str,
        tool_call_id: str | None = None,
        tool_calls: list | None = None,
    ) -> None:
        """Add a message to context.

        Args:
            role: Message role
            content: Message content
            tool_call_id: Tool call ID (for tool messages)
            tool_calls: Tool calls (for assistant messages)
        """
        message = Message(
            role=role, 
            content=content, 
            tool_call_id=tool_call_id,
            tool_calls=tool_calls
        )
        self.messages.append(message)

        # Truncate if needed (enforce keep_recent limit)
        if len(self.messages) > self.keep_recent:
            self._truncate_messages()

    def get_messages(self) -> list[Message]:
        """Get all messages in context.

        Returns:
            List of messages
        """
        return self.messages.copy()

    def clear(self) -> None:
        """Clear all messages from context."""
        self.messages = []

    def count_tokens(self) -> int:
        """Count total tokens in context.

        Returns:
            Total token count
        """
        if self._token_counter is None:
            # Fallback: rough estimate (1 token ≈ 4 characters)
            return sum(len(msg.content) for msg in self.messages) // 4

        return sum(self._token_counter(msg.content) for msg in self.messages)

    def _truncate_messages(self) -> None:
        """Truncate messages to stay within limits.

        Keeps the most recent messages up to keep_recent,
        and removes older messages beyond the limit.
        """
        if len(self.messages) <= self.keep_recent:
            return

        # Always keep system messages
        system_messages = [msg for msg in self.messages if msg.role == "system"]

        # Get non-system messages
        other_messages = [msg for msg in self.messages if msg.role != "system"]

        # Keep most recent messages
        if len(other_messages) > self.keep_recent:
            other_messages = other_messages[-self.keep_recent :]

        # Combine and update
        self.messages = system_messages + other_messages

    def get_last_message(self) -> Message | None:
        """Get the last message in context.

        Returns:
            Last message or None if context is empty
        """
        if not self.messages:
            return None
        return self.messages[-1]

    def get_messages_by_role(
        self, role: Literal["user", "assistant", "system", "tool"]
    ) -> list[Message]:
        """Get all messages with a specific role.

        Args:
            role: Message role to filter by

        Returns:
            List of messages with the specified role
        """
        return [msg for msg in self.messages if msg.role == role]

    def __len__(self) -> int:
        """Get number of messages in context.

        Returns:
            Number of messages
        """
        return len(self.messages)

    def __repr__(self) -> str:
        """String representation.

        Returns:
            String representation of context
        """
        return f"ContextManager(messages={len(self.messages)}, tokens≈{self.count_tokens()})"
