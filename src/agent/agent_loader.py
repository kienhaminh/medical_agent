"""Sub-Agent Loader and Management.

Handles loading agent configurations from CORE_AGENTS registry.
Database-backed custom agents have been removed (sub_agents table dropped).
"""

import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)

from ..config.database import AsyncSessionLocal
from ..tools.loader import load_custom_tools
from .core_agents import CORE_AGENTS

# Import builtin tools to trigger auto-registration
from ..tools import builtin  # noqa: F401
from ..skills import builtin as skill_builtin  # noqa: F401  # Register skill search tools


class AgentLoader:
    """Loads and manages agent configurations from the core agents registry."""

    def __init__(self):
        """Initialize the agent loader."""
        self.sub_agents: Dict[str, Dict[str, Any]] = {}

    async def load_enabled_agents(self) -> Dict[str, Dict[str, Any]]:
        """Load agents from the core agents registry.

        Returns:
            Dict mapping agent role to agent configuration
        """
        agents_info = {}

        # Load Core Agents (Hardcoded registry)
        for core_agent in CORE_AGENTS:
            agents_info[core_agent["role"]] = {
                "id": 0,
                "name": core_agent["name"],
                "role": core_agent["role"],
                "description": core_agent["description"],
                "system_prompt": core_agent["system_prompt"],
                "color": core_agent["color"],
                "icon": core_agent["icon"],
                "tools": core_agent.get("tools", []),
            }

        # Load Custom Tools into registry
        await load_custom_tools()

        # Update internal state
        self.sub_agents = agents_info

        return agents_info
