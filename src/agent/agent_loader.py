"""Sub-Agent Loader and Management.

Handles loading enabled sub-agents from the database and managing their configurations.
"""

from typing import Dict, Any
from sqlalchemy import select

from ..config.database import SubAgent, AsyncSessionLocal
from ..tools.loader import load_custom_tools


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
        
        # Load custom tools into registry FIRST
        await load_custom_tools()
        
        try:
            async with AsyncSessionLocal() as db:
                # Get all enabled agents
                result = await db.execute(
                    select(SubAgent).where(SubAgent.enabled == True)
                )
                agents = result.scalars().all()
                
                for agent in agents:
                    # Store agent metadata with agent_id for dynamic tool fetching
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
    
