"""Adapters to convert existing tools to LangChain format."""

from typing import Callable
from langchain_core.tools import tool as langchain_tool


def convert_to_langchain_tool(func: Callable) -> Callable:
    """Convert existing tool function to LangChain @tool format.

    LangChain auto-generates schemas from function signatures and docstrings.
    This adapter preserves the function signature, docstring, and name.

    Args:
        func: Tool function to convert

    Returns:
        LangChain tool function

    Example:
        >>> def my_tool(arg: str) -> str:
        ...     '''My tool docstring.'''
        ...     return f"Result: {arg}"
        >>> lc_tool = convert_to_langchain_tool(my_tool)
        >>> # lc_tool is now a LangChain tool with auto-generated schema
    """
    # Apply @tool decorator from LangChain
    # This automatically generates the tool schema from the function signature
    return langchain_tool(func)


def get_langchain_tools_from_registry(registry) -> list:
    """Convert all registered tools to LangChain format.

    Args:
        registry: ToolRegistry instance

    Returns:
        List of LangChain tool objects

    Example:
        >>> from src.tools.registry import ToolRegistry
        >>> registry = ToolRegistry()
        >>> lc_tools = get_langchain_tools_from_registry(registry)
        >>> # All tools converted to LangChain format
    """
    tools = registry.get_all_tools()
    return [convert_to_langchain_tool(t) for t in tools]
