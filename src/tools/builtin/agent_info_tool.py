"""Agent introspection tool - allows agent to query its own capabilities.

Provides information about agents and their architecture from the core registry.
"""

from typing import Dict, List, Any


def _get_core_agents_info() -> List[Dict[str, Any]]:
    """Return information about core agents from the static registry.

    Returns:
        List of agent information dictionaries
    """
    from ...agent.core_agents import CORE_AGENTS

    return [
        {
            "name": agent["name"],
            "role": agent["role"],
            "description": agent["description"],
            "tools": agent.get("tools", []),
            "tool_count": len(agent.get("tools", [])),
        }
        for agent in CORE_AGENTS
    ]


def get_agent_architecture() -> str:
    """Get information about the current agent's architecture and capabilities.

    USE THIS TOOL when asked about:
    - "How many sub-agents do you have?"
    - "What specialists are available?"
    - "What is your architecture?"
    - "What agents do you manage?"
    - "Can you tell me about yourself?"

    Returns:
        Detailed information about agents, their roles, and capabilities
    """
    agents = _get_core_agents_info()

    if not agents:
        return """I am a standalone agent with no specialist agents currently configured.
I have direct access to various tools for medical consultation."""

    response_parts = [
        f"I am a supervisor agent managing {len(agents)} specialized agents:\n"
    ]

    for agent in agents:
        response_parts.append(
            f"\n{agent['name']} ({agent['role']}):\n"
            f"  - Description: {agent['description']}\n"
            f"  - Available tools: {agent['tool_count']}"
        )
        if agent["tools"]:
            response_parts.append(f"  - Tool names: {', '.join(agent['tools'])}")

    response_parts.append(
        "\n\nArchitecture: I use a supervisor pattern where I analyze queries "
        "and delegate to the most appropriate specialist(s). I can also consult "
        "multiple specialists in parallel for complex cases requiring multiple "
        "areas of expertise."
    )

    return "".join(response_parts)


# Auto-register tool on import with "global" scope
# This tool should be available to the main agent for self-reflection
from ..registry import ToolRegistry

_registry = ToolRegistry()
_registry.register(get_agent_architecture, scope="global")
