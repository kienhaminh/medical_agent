from fastapi import APIRouter
from ..models import ToolToggleRequest
from ..dependencies import tool_registry

router = APIRouter()

@router.get("/api/tools")
async def list_tools():
    """List all tools and their status."""
    return tool_registry.list_tools()

@router.post("/api/tools/{name}/toggle")
async def toggle_tool(name: str, request: ToolToggleRequest):
    """Enable or disable a tool."""
    if request.enabled:
        tool_registry.enable_tool(name)
    else:
        tool_registry.disable_tool(name)
    return {"name": name, "enabled": tool_registry.is_tool_enabled(name)}
