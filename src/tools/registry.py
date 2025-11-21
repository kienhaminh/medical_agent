"""Tool registry for managing and discovering available tools."""

from typing import Optional, Callable, Any
import inspect


class ToolRegistry:
    """Singleton registry for tool registration and discovery.

    Manages a centralized collection of tools (functions), enabling:
    - Tool registration with unique names
    - Tool lookup by name
    - Listing all available tools
    - Bulk retrieval for LLM binding

    Uses singleton pattern to ensure single source of truth across application.
    """

    _instance: Optional["ToolRegistry"] = None
    _tools: dict[str, Callable]

    def __new__(cls) -> "ToolRegistry":
        """Create or return existing singleton instance."""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._tools = {}
            cls._instance._disabled_tools = set()
        return cls._instance

    def register(self, tool: Callable) -> None:
        """Register a tool function.

        Args:
            tool: Callable tool function. Must have a docstring and name.

        Raises:
            ValueError: If tool name conflicts with existing tool
        """
        name = tool.__name__
        if name in self._tools:
            raise ValueError(f"Tool '{name}' already registered")
        self._tools[name] = tool

    def enable_tool(self, name: str) -> None:
        """Enable a tool."""
        if name in self._tools:
            self._disabled_tools.discard(name)

    def disable_tool(self, name: str) -> None:
        """Disable a tool."""
        if name in self._tools:
            self._disabled_tools.add(name)

    def is_tool_enabled(self, name: str) -> bool:
        """Check if a tool is enabled."""
        return name in self._tools and name not in self._disabled_tools

    def get(self, name: str) -> Optional[Callable]:
        """Get tool by name if enabled.

        Args:
            name: Tool name to lookup

        Returns:
            Tool function if found and enabled, None otherwise
        """
        if self.is_tool_enabled(name):
            return self._tools.get(name)
        return None

    def list_tools(self) -> list[dict]:
        """List all registered tools with their status.

        Returns:
            List of dicts with name and enabled status
        """
        return [
            {"name": name, "enabled": self.is_tool_enabled(name)}
            for name in sorted(self._tools.keys())
        ]

    def get_all_tools(self) -> list[Callable]:
        """Get all enabled tools for LLM binding.

        Returns:
            List of all enabled tool functions
        """
        return [t for name, t in self._tools.items() if self.is_tool_enabled(name)]

    def get_langchain_tools(self) -> list:
        """Get all enabled tools in LangChain format for binding.

        Converts all enabled tools to LangChain @tool format with
        auto-generated schemas from function signatures and docstrings.

        Returns:
            List of LangChain tool objects
        """
        from .adapters import convert_to_langchain_tool

        return [
            convert_to_langchain_tool(t) 
            for name, t in self._tools.items() 
            if self.is_tool_enabled(name)
        ]

    def reset(self) -> None:
        """Clear all registered tools.

        Primarily for testing purposes.
        """
        self._tools.clear()
        self._disabled_tools.clear()
