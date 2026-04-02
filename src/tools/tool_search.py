"""Tool Search builtin tools for dynamic tool discovery.

These tools allow agents to discover other tools on demand,
saving system prompt tokens by not including all tool descriptions upfront.
"""

from .registry import ToolRegistry
from .search import search_tools, get_tool_info, list_available_tools

# Register tool search functions
_registry = ToolRegistry()

# Main tool search - agents use this to find tools
_registry.register(
    search_tools,
    scope="global",
    symbol="search_tools",
    allow_overwrite=True
)

# Get detailed info about a specific tool
_registry.register(
    get_tool_info,
    scope="global",
    symbol="get_tool_info",
    allow_overwrite=True
)

# List all available tools
_registry.register(
    list_available_tools,
    scope="global",
    symbol="list_available_tools",
    allow_overwrite=True
)
