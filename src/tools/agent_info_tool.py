"""Agent introspection tool - allows agent to query its own capabilities."""

from .registry import ToolRegistry


def get_agent_architecture() -> str:
    """Get information about the current agent's architecture and capabilities.

    USE THIS TOOL when asked about:
    - "What can you do?"
    - "What is your architecture?"
    - "What tools do you have?"
    - "Can you tell me about yourself?"

    Returns:
        Information about the agent and its available tool categories
    """
    registry = ToolRegistry()
    tool_count = len(registry.tools)

    return (
        f"I am a unified AI medical assistant with direct access to {tool_count} tools.\n\n"
        "Tool categories:\n"
        "- Patient data: query demographics, medical records, imaging\n"
        "- Clinical workflow: clinical notes, pre-visit briefs, differential diagnosis, orders\n"
        "- Triage: patient intake forms, visit creation, triage completion\n"
        "- Utility: date/time, weather, location\n"
        "- Discovery: semantic tool search, tool listing\n\n"
        "Architecture: Single-agent ReAct pattern — I analyze queries and use tools "
        "directly to retrieve information, perform actions, and generate responses."
    )


_registry = ToolRegistry()
_registry.register(get_agent_architecture, scope="global")
