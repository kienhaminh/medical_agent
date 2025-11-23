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
    _tool_scopes: dict[str, str]  # Maps tool name to scope (global, assignable, both)

    def __new__(cls) -> "ToolRegistry":
        """Create or return existing singleton instance."""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._tools = {}
            cls._instance._disabled_tools = set()
            cls._instance._tool_scopes = {}
        return cls._instance

    def register(self, tool: Callable, scope: str = "global") -> None:
        """Register a tool function with optional scope.

        Args:
            tool: Callable tool function. Must have a docstring and name.
            scope: Tool scope - "global" (main agent), "assignable" (sub-agents only),
                   or "both" (main agent + sub-agents). Defaults to "global".

        Raises:
            ValueError: If tool name conflicts with existing tool or invalid scope
        """
        if scope not in ("global", "assignable", "both"):
            raise ValueError(f"Invalid scope '{scope}'. Must be 'global', 'assignable', or 'both'")

        name = tool.__name__
        if name in self._tools:
            raise ValueError(f"Tool '{name}' already registered")
        self._tools[name] = tool
        self._tool_scopes[name] = scope

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

    def get_langchain_tools(self, scope_filter: Optional[str] = None) -> list:
        """Get enabled tools in LangChain format with optional scope filtering.

        Converts enabled tools to LangChain @tool format with
        auto-generated schemas from function signatures and docstrings.

        Args:
            scope_filter: Optional scope filter. If provided, only returns tools with:
                - scope == scope_filter, OR
                - scope == "both"
                Common values: "global" (main agent), "assignable" (sub-agents)
                If None, returns all enabled tools regardless of scope.

        Returns:
            List of LangChain tool objects matching scope filter
        """
        from .adapters import convert_to_langchain_tool

        tools = []
        for name, t in self._tools.items():
            if not self.is_tool_enabled(name):
                continue

            # Apply scope filter if provided
            if scope_filter is not None:
                tool_scope = self._tool_scopes.get(name, "global")
                # Include if scope matches OR tool is "both"
                if tool_scope != scope_filter and tool_scope != "both":
                    continue

            tools.append(convert_to_langchain_tool(t))
        print(f"get_langchain_tools: {tools}")
        return tools

    def get_tools_by_names(self, names: list[str]) -> list:
        """Get specific enabled tools in LangChain format.

        Args:
            names: List of tool names to retrieve

        Returns:
            List of LangChain tool objects for the specified names
        """
        from .adapters import convert_to_langchain_tool
        
        tools = []
        for name in names:
            if self.is_tool_enabled(name):
                tool = self._tools.get(name)
                if tool:
                    tools.append(convert_to_langchain_tool(tool))
        return tools

    def reset(self) -> None:
        """Clear all registered tools and scopes.

        Primarily for testing purposes.
        """
        self._tools.clear()
        self._disabled_tools.clear()
        self._tool_scopes.clear()
