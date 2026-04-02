"""Tool registry for managing and discovering available tools."""

import logging
from typing import Any, Optional, Callable

logger = logging.getLogger(__name__)


class ToolRegistry:
    """Singleton registry for tool registration and discovery.

    Stores tools as LangChain BaseTool instances. Plain Python functions
    passed to register() are automatically wrapped with @tool.

    Uses singleton pattern to ensure a single source of truth across the app.
    """

    _instance: Optional["ToolRegistry"] = None
    _tools: dict[str, Any]        # symbol → BaseTool
    _tool_scopes: dict[str, str]  # symbol → "global" | "assignable"

    def __new__(cls) -> "ToolRegistry":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._tools = {}
            cls._instance._tool_scopes = {}
        return cls._instance

    def register(
        self,
        tool: Callable,
        scope: str = "global",
        symbol: Optional[str] = None,
        allow_overwrite: bool = False,
    ) -> None:
        """Register a tool.

        Accepts plain callables (auto-wrapped with @tool) or LangChain
        BaseTool instances (stored as-is).

        Args:
            tool: Plain callable or BaseTool to register.
            scope: "global" (main agent) or "assignable" (sub-agents).
            symbol: Unique snake_case key. Defaults to tool name.
            allow_overwrite: Replace existing tool with the same symbol.

        Raises:
            ValueError: On invalid scope or duplicate symbol.
        """
        from langchain_core.tools import BaseTool
        from langchain_core.tools import tool as lc_tool

        if scope not in ("global", "assignable"):
            raise ValueError(f"Invalid scope '{scope}'. Must be 'global' or 'assignable'")

        if isinstance(tool, BaseTool):
            lc_tool_obj = tool
            tool_symbol = symbol or tool.name
        else:
            tool_symbol = symbol or tool.__name__
            lc_tool_obj = lc_tool(tool)

        if tool_symbol in self._tools and not allow_overwrite:
            raise ValueError(f"Tool with symbol '{tool_symbol}' already registered")

        self._tools[tool_symbol] = lc_tool_obj
        self._tool_scopes[tool_symbol] = scope

    def get(self, symbol: str) -> Optional[Any]:
        """Get a registered tool by symbol. Returns None if not found."""
        return self._tools.get(symbol)

    @property
    def tools(self) -> dict[str, Any]:
        """Read-only view of the symbol → BaseTool mapping."""
        return self._tools

    def list_tools(self) -> list[Any]:
        """Return all registered tools as a flat list."""
        return list(self._tools.values())
