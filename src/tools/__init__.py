"""Tool system for AI Agent.

Provides infrastructure for registering, discovering, and executing tools
that extend agent capabilities with external functions (datetime, location, etc).

Key Components:
    - ToolRegistry: Singleton registry for tool management
    - ToolExecutor: Safe tool execution with error handling
    - ToolResult: Standardized result format

Usage:
    >>> from src.tools import ToolRegistry, ToolExecutor
    >>>
    >>> # Define tool
    >>> def my_tool(arg: str) -> str:
    ...     '''My tool description'''
    ...     return f"Result: {arg}"
    >>>
    >>> # Register tool
    >>> registry = ToolRegistry()
    >>> registry.register(my_tool)
    >>>
    >>> # Execute tool
    >>> executor = ToolExecutor(registry)
    >>> result = executor.execute("my_tool", {"arg": "test"})
    >>> print(result.to_string())
    Result: test
"""

from .base import ToolResult
from .registry import ToolRegistry
from .executor import ToolExecutor

__all__ = ["ToolRegistry", "ToolExecutor", "ToolResult"]
