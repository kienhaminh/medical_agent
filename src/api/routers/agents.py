"""Agents router — read-only, core-registry-backed.

Sub-agents DB table has been dropped. All agents are defined in CORE_AGENTS.
CRUD endpoints return 410 Gone; the list endpoint serves from the registry.
"""
from datetime import datetime
from fastapi import APIRouter, HTTPException
from ...agent.core_agents import CORE_AGENTS

router = APIRouter(tags=["Agents"])


def _core_agent_to_response(idx: int, core_agent: dict) -> dict:
    """Serialize a core agent entry to a response dict."""
    now = datetime.now().isoformat()
    return {
        "id": -(idx + 1),
        "name": core_agent["name"],
        "role": core_agent["role"],
        "description": core_agent["description"],
        "system_prompt": core_agent["system_prompt"],
        "enabled": True,
        "color": core_agent["color"],
        "icon": core_agent["icon"],
        "is_template": core_agent.get("is_template", False),
        "parent_template_id": None,
        "created_at": now,
        "updated_at": now,
        "tools": core_agent.get("tools", []),
    }


@router.get("/api/agents")
async def list_agents():
    """List all agents from the core registry."""
    return [_core_agent_to_response(i, a) for i, a in enumerate(CORE_AGENTS)]


@router.get("/api/agents/{agent_id}")
async def get_agent(agent_id: int):
    """Get a specific agent by its negative core-registry ID."""
    if agent_id >= 0:
        raise HTTPException(status_code=410, detail="Custom DB agents no longer supported")
    core_index = abs(agent_id) - 1
    if core_index >= len(CORE_AGENTS):
        raise HTTPException(status_code=404, detail="Agent not found")
    return _core_agent_to_response(core_index, CORE_AGENTS[core_index])


@router.post("/api/agents")
async def create_agent():
    raise HTTPException(status_code=410, detail="Custom agent creation no longer supported")


@router.put("/api/agents/{agent_id}")
async def update_agent(agent_id: int):
    raise HTTPException(status_code=410, detail="Custom agent update no longer supported")


@router.delete("/api/agents/{agent_id}")
async def delete_agent(agent_id: int):
    raise HTTPException(status_code=410, detail="Custom agent deletion no longer supported")


@router.post("/api/agents/{agent_id}/toggle")
async def toggle_agent(agent_id: int):
    raise HTTPException(status_code=410, detail="Agent toggle no longer supported")


@router.post("/api/agents/{agent_id}/clone")
async def clone_agent(agent_id: int):
    raise HTTPException(status_code=410, detail="Agent cloning no longer supported")


@router.get("/api/agents/{agent_id}/tools")
async def get_agent_tools(agent_id: int):
    """Return tool symbols for a core agent."""
    if agent_id >= 0:
        raise HTTPException(status_code=410, detail="Custom DB agents no longer supported")
    core_index = abs(agent_id) - 1
    if core_index >= len(CORE_AGENTS):
        raise HTTPException(status_code=404, detail="Agent not found")
    return CORE_AGENTS[core_index].get("tools", [])


@router.post("/api/agents/{agent_id}/tools")
async def assign_tool_to_agent(agent_id: int):
    raise HTTPException(status_code=410, detail="Tool assignment no longer supported")


@router.delete("/api/agents/{agent_id}/tools/{tool_id}")
async def unassign_tool_from_agent(agent_id: int, tool_id: int):
    raise HTTPException(status_code=410, detail="Tool unassignment no longer supported")


@router.put("/api/agents/{agent_id}/tools")
async def bulk_update_agent_tools(agent_id: int):
    raise HTTPException(status_code=410, detail="Bulk tool update no longer supported")


@router.get("/api/agent-tool-assignments")
async def get_all_assignments():
    """Return empty list — agent-tool assignments via DB are no longer supported."""
    return []
