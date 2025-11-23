"""Shared Enum definitions."""

from enum import Enum

class MessageRole(str, Enum):
    """Enum for message roles."""
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"
    TOOL = "tool"
