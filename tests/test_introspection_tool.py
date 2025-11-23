"""Quick test for the agent introspection tool.

Tests the get_agent_architecture tool directly without the full agent.
"""

import asyncio
from src.tools.builtin.agent_info_tool import get_agent_architecture


def test_introspection_tool():
    """Test the get_agent_architecture tool directly."""
    print("=" * 80)
    print("TESTING get_agent_architecture TOOL")
    print("=" * 80)
    print()

    print("Calling get_agent_architecture()...")
    print()

    result = get_agent_architecture()

    print("Result:")
    print("-" * 80)
    print(result)
    print("-" * 80)
    print()

    # Analyze result
    if "Error" in result or "error" in result:
        print("⚠️  Tool returned an error")
    elif "no sub-agents" in result.lower():
        print("ℹ️  No sub-agents currently enabled in database")
    elif "managing" in result.lower():
        print("✓ Tool successfully retrieved sub-agent information")
    else:
        print("? Unknown result format")

    print()
    print("=" * 80)


if __name__ == "__main__":
    test_introspection_tool()
