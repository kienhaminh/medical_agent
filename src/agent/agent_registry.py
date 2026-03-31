"""Static agent registry — resolves agent config by role string.

This is the single source of truth for agent system prompts and tool lists.
No DB queries. Import and call at any time.
"""
from typing import Optional
from .core_agents import CORE_AGENTS

_REGISTRY: dict[str, dict] = {agent["role"]: agent for agent in CORE_AGENTS}


def get_agent_config(role: str) -> Optional[dict]:
    """Return the agent config dict for a given role, or None if not found."""
    return _REGISTRY.get(role)


def list_agents() -> list[dict]:
    """Return all agent config dicts."""
    return list(_REGISTRY.values())
