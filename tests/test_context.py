"""Tests for context management."""

import pytest

from src.context.manager import ContextManager
from src.llm.provider import Message


def test_context_manager_add_message():
    """Test adding messages to context."""
    ctx = ContextManager()

    ctx.add_message("user", "Hello")
    assert len(ctx) == 1

    ctx.add_message("assistant", "Hi there!")
    assert len(ctx) == 2

    messages = ctx.get_messages()
    assert messages[0].role == "user"
    assert messages[0].content == "Hello"
    assert messages[1].role == "assistant"
    assert messages[1].content == "Hi there!"


def test_context_manager_clear():
    """Test clearing context."""
    ctx = ContextManager()

    ctx.add_message("user", "Hello")
    ctx.add_message("assistant", "Hi!")
    assert len(ctx) == 2

    ctx.clear()
    assert len(ctx) == 0


def test_context_manager_truncation():
    """Test message truncation."""
    ctx = ContextManager(max_messages=5, keep_recent=3)

    # Add more messages than max
    for i in range(10):
        ctx.add_message("user", f"Message {i}")

    # Should keep only keep_recent messages
    assert len(ctx) <= ctx.keep_recent


def test_context_manager_get_last_message():
    """Test getting last message."""
    ctx = ContextManager()

    assert ctx.get_last_message() is None

    ctx.add_message("user", "Hello")
    last = ctx.get_last_message()
    assert last is not None
    assert last.role == "user"
    assert last.content == "Hello"


def test_context_manager_filter_by_role():
    """Test filtering messages by role."""
    ctx = ContextManager()

    ctx.add_message("system", "You are helpful")
    ctx.add_message("user", "Hello")
    ctx.add_message("assistant", "Hi!")
    ctx.add_message("user", "How are you?")

    user_messages = ctx.get_messages_by_role("user")
    assert len(user_messages) == 2
    assert all(msg.role == "user" for msg in user_messages)


def test_context_manager_token_counting():
    """Test token counting."""
    ctx = ContextManager()

    ctx.add_message("user", "Hello world")
    ctx.add_message("assistant", "Hi there!")

    # Should use fallback estimation (1 token ≈ 4 chars)
    tokens = ctx.count_tokens()
    assert tokens > 0

    # Test with custom counter
    ctx.set_token_counter(lambda text: len(text))
    tokens = ctx.count_tokens()
    assert tokens == len("Hello world") + len("Hi there!")


def test_context_manager_truncation_with_system_messages():
    """Test truncation preserves system messages."""
    ctx = ContextManager(max_messages=10, keep_recent=3)

    # Add system message
    ctx.add_message("system", "System prompt")

    # Add many user messages
    for i in range(10):
        ctx.add_message("user", f"Message {i}")

    # Should keep system message + 3 recent messages
    messages = ctx.get_messages()
    system_msgs = [m for m in messages if m.role == "system"]
    assert len(system_msgs) == 1
    assert len(messages) <= 4  # 1 system + 3 recent


def test_context_manager_repr():
    """Test context manager string representation."""
    ctx = ContextManager()
    ctx.add_message("user", "Hello")

    repr_str = repr(ctx)

    assert "ContextManager" in repr_str
    assert "messages=" in repr_str
    assert "tokens" in repr_str


def test_context_manager_truncation_early_return():
    """Test truncation early return when within limit."""
    ctx = ContextManager(keep_recent=10)

    # Add fewer messages than keep_recent
    ctx.add_message("user", "Message 1")
    ctx.add_message("user", "Message 2")

    # Manually call truncation (normally called by add_message)
    ctx._truncate_messages()

    # Should not truncate since we're within limit
    assert len(ctx.get_messages()) == 2
