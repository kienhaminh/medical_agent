"""Sub-Agent Loader and Management.

Handles loading enabled sub-agents from the database and managing their configurations.
"""

from typing import Dict, Any
from sqlalchemy import select

from ..config.database import SubAgent, AgentToolAssignment, Tool, AsyncSessionLocal
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
                    # Get agent's assigned tools
                    tools_result = await db.execute(
                        select(Tool)
                        .join(AgentToolAssignment)
                        .where(
                            AgentToolAssignment.agent_id == agent.id,
                            AgentToolAssignment.enabled == True
                        )
                    )
                    tools = tools_result.scalars().all()
                    
                    agents_info[agent.role] = {
                        "id": agent.id,
                        "name": agent.name,
                        "role": agent.role,
                        "description": agent.description,
                        "system_prompt": agent.system_prompt,
                        "color": agent.color,
                        "icon": agent.icon,
                        "tools": [tool.name for tool in tools]
                    }
        except Exception as e:
            print(f"Warning: Failed to load sub-agents: {e}")
        
        # Update internal state
        self.sub_agents = agents_info
        
        return agents_info
    
    def build_decision_context(self, system_prompt: str) -> str:
        """Build context for main agent's decision-making.
        
        Args:
            system_prompt: The base system prompt
            
        Returns:
            Complete decision context with specialist information
        """
        specialist_list = ""
        if self.sub_agents:
            specialist_list = "\n" + "="*70 + "\n"
            specialist_list += "AVAILABLE SPECIALISTS\n"
            specialist_list += "="*70 + "\n\n"
            for role, info in self.sub_agents.items():
                specialist_list += f"**{info['name']}** (role: {role})\n"
                specialist_list += f"Description: {info['description']}\n"
                if info.get('tools'):
                    specialist_list += f"Tools: {', '.join(info['tools'])}\n"
                specialist_list += "\n"
            specialist_list += "="*70 + "\n"
        else:
            specialist_list = "\n(No specialists currently available)\n"
        
        return f"""{system_prompt}

{specialist_list}

**How to Delegate:**
- Use the specialist's **role** (not name) in your CONSULT statement
- Example: "CONSULT: clinical_text" (to consult the Internist)
- For multiple: "CONSULT: clinical_text,imaging" (parallel consultation)

**Important:**
- Match the query to specialist descriptions above
- Choose specialists based on their expertise and available tools
- Use the exact role identifier shown in parentheses"""
