"""Tool system for AI Agent.

Provides infrastructure for registering, discovering, and executing tools
that extend agent capabilities with external functions (datetime, location, etc).

Key Components:
    - ToolRegistry: Singleton registry for tool management
    - ToolPool: New pool for skill-organized tools
    - ToolExecutor: Safe tool execution with error handling
    - ToolResult: Standardized result format

Usage:
    >>> from src.tools import ToolRegistry, ToolPool, ToolExecutor
    >>>
    >>> # Define tool
    >>> def my_tool(arg: str) -> str:
    ...     '''My tool description'''
    ...     return f"Result: {arg}"
    >>>
    >>> # Register tool (legacy)
    >>> registry = ToolRegistry()
    >>> registry.register(my_tool)
    >>>
    >>> # Or use new ToolPool
    >>> pool = ToolPool()
    >>> pool.register("my_tool", my_tool, skill_name="general")
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
from .pool import ToolPool

__all__ = ["ToolRegistry", "ToolPool", "ToolExecutor", "ToolResult"]
