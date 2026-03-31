"""Agents router — read-only, core-registry-backed.

Sub-agents DB table has been dropped. All agents are defined in CORE_AGENTS.
"""
from datetime import datetime
from fastapi import APIRouter
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
