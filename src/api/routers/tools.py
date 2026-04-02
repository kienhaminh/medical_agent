"""Tools router — lists tools registered directly in the codebase.

Tools are declared in src/tools/ and registered at startup via ToolRegistry.
There is no database storage for tools.
"""

from fastapi import APIRouter
from src.tools.registry import ToolRegistry
import inspect

router = APIRouter(tags=["Tools"])


@router.get("/api/tools")
async def list_tools():
    """List all tools currently registered in the codebase."""
    registry = ToolRegistry()
    tools = []
    for symbol, func in registry._tools.items():
        scope = registry._tool_scopes.get(symbol, "global")
        doc = inspect.getdoc(func) or ""
        # First line of docstring is the short description
        description = doc.splitlines()[0] if doc else ""
        tools.append({
            "symbol": symbol,
            "name": getattr(func, "__name__", symbol),
            "description": description,
            "scope": scope,
        })
    tools.sort(key=lambda t: t["symbol"])
    return tools
