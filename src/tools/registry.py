"""Tool registry for managing and discovering available tools."""

from typing import Optional, Callable


class ToolRegistry:
    """Singleton registry for tool registration and discovery.

    Manages a centralized collection of tools (functions), enabling:
    - Tool registration with unique symbols (identifiers)
    - Tool lookup by symbol
    - Listing all available tools
    - Bulk retrieval for LLM binding

    Tools are identified by their 'symbol' (unique snake_case identifier) rather than
    their display name. All registered tools are enabled by default.

    Uses singleton pattern to ensure single source of truth across application.
    """

    _instance: Optional["ToolRegistry"] = None
    _tools: dict[str, Callable]  # Maps symbol to callable
    _tool_scopes: dict[str, str]  # Maps symbol to scope (global, assignable)

    def __new__(cls) -> "ToolRegistry":
        """Create or return existing singleton instance."""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._tools = {}
            cls._instance._tool_scopes = {}
        return cls._instance

    def register(self, tool: Callable, scope: str = "global", symbol: Optional[str] = None, allow_overwrite: bool = False) -> None:
        """Register a tool function with optional scope and symbol.

        Args:
            tool: Callable tool function. Must have a docstring and name.
            scope: Tool scope - "global" (main agent only) or "assignable" (sub-agents only).
                   Defaults to "global".
            symbol: Unique identifier for the tool (snake_case). If not provided, uses tool.__name__.
            allow_overwrite: If True, overwrites existing tool with same symbol.

        Raises:
            ValueError: If tool symbol conflicts with existing tool (and allow_overwrite is False) or invalid scope
        """
        if scope not in ("global", "assignable"):
            raise ValueError(f"Invalid scope '{scope}'. Must be 'global' or 'assignable'")

        # Use provided symbol or fallback to function name
        tool_symbol = symbol if symbol is not None else tool.__name__
        
        if tool_symbol in self._tools and not allow_overwrite:
            raise ValueError(f"Tool with symbol '{tool_symbol}' already registered")
        
        self._tools[tool_symbol] = tool
        self._tool_scopes[tool_symbol] = scope

    def get(self, symbol: str) -> Optional[Callable]:
        """Get tool by symbol.

        Args:
            symbol: Tool symbol to lookup

        Returns:
            Tool function if found, None otherwise
        """
        return self._tools.get(symbol)

    def list_tools(self) -> list[dict]:
        """List all registered tools.

        Returns:
            List of dicts with symbol information
        """
        return [
            {"symbol": symbol}
            for symbol in sorted(self._tools.keys())
        ]

    def get_all_tools(self) -> list[Callable]:
        """Get all registered tools for LLM binding.

        Returns:
            List of all tool functions
        """
        return list(self._tools.values())

    def get_langchain_tools(self, scope_filter: Optional[str] = None) -> list:
        """Get enabled tools in LangChain format with optional scope filtering.

        Converts enabled tools to LangChain @tool format with
        auto-generated schemas from function signatures and docstrings.

        Args:
            scope_filter: Optional scope filter. If provided, only returns tools with
                matching scope. Common values: "global" (main agent), "assignable" (sub-agents)
                If None, returns all enabled tools regardless of scope.

        Returns:
            List of LangChain tool objects matching scope filter
        """
        from .adapters import convert_to_langchain_tool

        tools = []
        for symbol, t in self._tools.items():
            # Apply scope filter if provided
            if scope_filter is not None:
                tool_scope = self._tool_scopes.get(symbol, "global")
                # Include only if scope matches exactly
                if tool_scope != scope_filter:
                    continue

            try:
                tools.append(convert_to_langchain_tool(t))
            except Exception as e:
                print(f"[ERROR] Failed to convert tool '{symbol}' to LangChain format: {e}")
        print(f"get_langchain_tools: {tools}")
        return tools

    def get_tools_by_symbols(self, symbols: list[str]) -> list:
        """Get specific tools in LangChain format by their symbols.

        Args:
            symbols: List of tool symbols to retrieve

        Returns:
            List of LangChain tool objects for the specified symbols
        """
        from .adapters import convert_to_langchain_tool
        
        tools = []
        for symbol in symbols:
            tool = self._tools.get(symbol)
            if tool:
                try:
                    tools.append(convert_to_langchain_tool(tool))
                except Exception as e:
                    print(f"[ERROR] Failed to convert tool '{symbol}' to LangChain format: {e}")
        return tools

    async def get_langchain_tools_for_agent(self, agent_id: int) -> list:
        """Fetch tools assigned to a specific agent from database.
        
        This method dynamically queries the database for all enabled tools
        assigned to the given agent, converting them to LangChain format.
        
        Args:
            agent_id: The ID of the sub-agent
            
        Returns:
            List of LangChain tool objects assigned to this agent
        """
        from .adapters import convert_to_langchain_tool
        from ..config.database import AsyncSessionLocal, Tool
        from sqlalchemy import select
        
        tools = []
        
        try:
            async with AsyncSessionLocal() as db:
                print(f"Fetching tools for agent {agent_id}")
                # Query for tools assigned to this agent
                result = await db.execute(
                    select(Tool)
                    .where(
                        Tool.assigned_agent_id == agent_id
                    )
                )
                print(f"Result: {result}")
                db_tools = result.scalars().all()
                print(f"DB tools: {db_tools}")
                
                # Convert to LangChain format
                for db_tool in db_tools:
                    print(f"[DEBUG] Processing DB tool: {db_tool.name} (scope={db_tool.scope}, type={db_tool.tool_type})")
                    
                    # Check if tool is registered in memory
                    if db_tool.symbol in self._tools:
                        tool_func = self._tools[db_tool.symbol]
                        try:
                            tools.append(convert_to_langchain_tool(tool_func))
                            print(f"[DEBUG] ✓ Added tool: {db_tool.symbol}")
                        except Exception as e:
                            print(f"[ERROR] Failed to convert tool '{db_tool.symbol}' to LangChain format: {e}")
                            import traceback
                            print(traceback.format_exc())
                    else:
                        print(f"[WARNING] Tool '{db_tool.name}' is assigned to agent {agent_id} in DB but NOT registered in memory!")
                        print(f"[WARNING] Available tools in memory: {list(self._tools.keys())}")
                        print(f"[WARNING] This tool will be SKIPPED. Did you forget to load custom tools?")
                        print(f"[WARNING] Tool details - scope: {db_tool.scope}, type: {db_tool.tool_type}, has code: {bool(db_tool.code)}")
        except Exception as e:
            import traceback
            print(f"Warning: Failed to fetch tools for agent {agent_id}: {e}")
            print(traceback.format_exc())
        print(f"Tools for agent {agent_id}: {tools}")
        return tools

    def reset(self) -> None:
        """Clear all registered tools and scopes.

        Primarily for testing purposes.
        """
        self._tools.clear()
        self._tool_scopes.clear()
