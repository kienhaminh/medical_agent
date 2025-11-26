"""Sub-Agent Loader and Management.

Handles loading enabled sub-agents from the database and managing their configurations.
"""

from typing import Dict, Any
from sqlalchemy import select

from ..config.database import SubAgent, AsyncSessionLocal
from ..tools.loader import load_custom_tools
from .core_agents import CORE_AGENTS

# Import builtin tools to trigger auto-registration
from ..tools import builtin  # noqa: F401


class AgentLoader:
    """Loads and manages sub-agent configurations from database."""
    
    def __init__(self):
        """Initialize the agent loader."""
        self.sub_agents: Dict[str, Dict[str, Any]] = {}
    
    async def load_enabled_agents(self) -> Dict[str, Dict[str, Any]]:
        """Load enabled sub-agents from database.
        
        Returns:
            Dict mapping agent role to agent configuration
        """
        agents_info = {}
        
        # 1. Load Core Agents (Hardcoded)
        for core_agent in CORE_AGENTS:
            # Assign a mock ID (e.g., 0) since they don't have a DB ID.
            # Note: Chat sessions handled by core agents will have agent_id=None in DB
            # or need to handle the ID=0 case specifically if enforced.
            
            agents_info[core_agent["role"]] = {
                "id": 0, 
                "name": core_agent["name"],
                "role": core_agent["role"],
                "description": core_agent["description"],
                "system_prompt": core_agent["system_prompt"],
                "color": core_agent["color"],
                "icon": core_agent["icon"],
                "tools": core_agent.get("tools", []), # Pass hardcoded tools list
            }

        # 2. Load Custom Tools into registry
        await load_custom_tools()
        
        try:
            async with AsyncSessionLocal() as db:
                # 3. Get enabled custom agents from DB
                result = await db.execute(
                    select(SubAgent).where(SubAgent.enabled == True)
                )
                agents = result.scalars().all()
                
                for agent in agents:
                    # Skip if role conflicts with core agent (Core takes precedence)
                    if agent.role in agents_info:
                        continue
                        
                    agents_info[agent.role] = {
                        "id": agent.id,
                        "name": agent.name,
                        "role": agent.role,
                        "description": agent.description,
                        "system_prompt": agent.system_prompt,
                        "color": agent.color,
                        "icon": agent.icon,
                    }
        except Exception as e:
            print(f"Warning: Failed to load sub-agents: {e}")
        
        # Update internal state
        self.sub_agents = agents_info
        
        return agents_info
    
