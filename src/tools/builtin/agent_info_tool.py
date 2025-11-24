"""Agent introspection tool - allows agent to query its own capabilities.

Provides information about sub-agents, tools, and overall architecture.
"""

from typing import Dict, List, Any
from sqlalchemy import select
from ...config.database import SubAgent, Tool


def _get_enabled_subagents_sync() -> List[Dict[str, Any]]:
    """Query database for enabled sub-agents using sync connection.

    This version uses synchronous database access to avoid asyncpg threading issues.

    Returns:
        List of sub-agent information dictionaries
    """
    from ...config.database import SessionLocal

    agents_info = []

    try:
        with SessionLocal() as db:
            # Get all enabled agents
            result = db.execute(
                select(SubAgent).where(SubAgent.enabled == True)
            )
            agents = result.scalars().all()

            for agent in agents:
                # Get agent's assigned tools
                tools_result = db.execute(
                    select(Tool).where(
                        Tool.assigned_agent_id == agent.id,
                        Tool.enabled == True
                    )
                )
                tools = tools_result.scalars().all()

                agents_info.append({
                    "id": agent.id,
                    "name": agent.name,
                    "role": agent.role,
                    "description": agent.description,
                    "tools": [tool.name for tool in tools],
                    "tool_count": len(tools),
                    "enabled": agent.enabled
                })
    except Exception as e:
        return [{"error": f"Failed to query sub-agents: {str(e)}"}]

    return agents_info


def get_agent_architecture() -> str:
    """Get information about the current agent's architecture and capabilities.

    USE THIS TOOL when asked about:
    - "How many sub-agents do you have?"
    - "What specialists are available?"
    - "What is your architecture?"
    - "What agents do you manage?"
    - "Can you tell me about yourself?"

    Returns:
        Detailed information about sub-agents, their roles, and capabilities
    """
    # Use synchronous database access to avoid asyncpg threading issues
    # This is safer than trying to run async code in different event loops
    sub_agents = _get_enabled_subagents_sync()

    if not sub_agents:
        return """I am a standalone agent with no sub-agents currently enabled.
I have direct access to various tools for medical consultation, but no specialized sub-agents."""

    # Check for errors
    if sub_agents and "error" in sub_agents[0]:
        return f"Error retrieving architecture: {sub_agents[0]['error']}"

    # Build detailed response
    response_parts = [
        f"I am a supervisor agent managing {len(sub_agents)} specialized sub-agents:\n"
    ]

    for agent in sub_agents:
        response_parts.append(
            f"\n{agent['name']} ({agent['role']}):\n"
            f"  - Description: {agent['description']}\n"
            f"  - Available tools: {agent['tool_count']}"
        )
        if agent['tools']:
            response_parts.append(f"  - Tool names: {', '.join(agent['tools'])}")

    response_parts.append(
        f"\n\nArchitecture: I use a supervisor pattern where I analyze queries "
        f"and delegate to the most appropriate specialist(s). I can also consult "
        f"multiple specialists in parallel for complex cases requiring multiple "
        f"areas of expertise."
    )

    return "".join(response_parts)


# Auto-register tool on import with "global" scope
# This tool should be available to the main agent for self-reflection
from ..registry import ToolRegistry

_registry = ToolRegistry()
_registry.register(get_agent_architecture, scope="global")
