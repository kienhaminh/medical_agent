"""Delegation tools for sub-agent consultation.

Provides tools that allow the main agent to delegate queries to specialist sub-agents
through proper tool calls rather than text-based signals.
"""

from typing import Dict, Any, Optional
from pydantic import BaseModel, Field


class DelegationToolFactory:
    """Factory for creating delegation tools for sub-agents."""
    
    @staticmethod
    def create_delegation_tool(agent_role: str, agent_info: Dict[str, Any]):
        """Create a delegation tool for a specific sub-agent.
        
        Args:
            agent_role: The role identifier of the sub-agent (e.g., "clinical_text")
            agent_info: Agent configuration containing name, description, etc.
            
        Returns:
            A callable tool function that can be registered
        """
        # Create a unique function name based on the agent role
        tool_name = f"consult_{agent_role}"
        
        # Create Pydantic model for input validation
        class ConsultInput(BaseModel):
            query: str = Field(
                description=f"The query to send to the {agent_info['name']} specialist"
            )
        
        # Create the tool function with proper metadata
        def delegation_tool(query: str) -> str:
            f"""Consult the {agent_info['name']} specialist.
            
            {agent_info['description']}
            
            Use this tool when you need specialized expertise in {agent_info['name'].lower()}.
            The specialist will analyze the query and provide expert insights.
            
            Args:
                query: The specific question or request for the specialist
                
            Returns:
                str: A marker indicating delegation (processed by graph)
            """
            # Return a delegation marker that will be processed by the graph
            # The actual consultation happens in the graph's sub_agent_consultation node
            return f"DELEGATE_TO:{agent_role}:{query}"
        
        # Set function metadata
        delegation_tool.__name__ = tool_name
        delegation_tool.__doc__ = f"""Consult the {agent_info['name']} specialist.

{agent_info['description']}

Use this tool when you need specialized expertise in {agent_info['name'].lower()}.
The specialist will analyze the query and provide expert insights.

Args:
    query: The specific question or request for the specialist
    
Returns:
    str: The specialist's response
"""
        
        return delegation_tool
    
    @staticmethod
    def create_all_delegation_tools(sub_agents: Dict[str, Dict[str, Any]]) -> list:
        """Create delegation tools for all sub-agents.
        
        Args:
            sub_agents: Dictionary of sub-agent configurations
            
        Returns:
            List of delegation tool functions
        """
        tools = []
        for role, agent_info in sub_agents.items():
            tool = DelegationToolFactory.create_delegation_tool(role, agent_info)
            tools.append(tool)
        return tools
