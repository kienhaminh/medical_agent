"""Base types and utilities for tool system."""

from dataclasses import dataclass
from typing import Any


@dataclass
class ToolResult:
    """Standardized tool execution result.

    Used to wrap tool execution outcomes with success/error information.
    Provides consistent interface for both successful and failed tool calls.

    Attributes:
        success: Whether tool execution succeeded
        data: Tool output data (any type)
        error: Error message if execution failed

    Example:
        >>> result = ToolResult(success=True, data="2025-11-16T13:24:00Z")
        >>> print(result.to_string())
        2025-11-16T13:24:00Z

        >>> result = ToolResult(success=False, error="Invalid timezone")
        >>> print(result.to_string())
        Error: Invalid timezone
    """

    success: bool
    data: Any = None
    error: str | None = None

    def to_string(self) -> str:
        """Convert result to LLM-friendly string representation.

        Returns:
            Success: String representation of data
            Failure: Error message prefixed with "Error: "
        """
        if self.success:
            return str(self.data)
        return f"Error: {self.error}"
