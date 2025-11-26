"""Test script to verify delegation functionality."""

import asyncio
import logging
from src.api.dependencies import get_or_create_agent

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

async def test_delegation():
    """Test that agent can delegate to specialists."""
    print("\n" + "="*60)
    print("Testing Specialist Delegation")
    print("="*60 + "\n")

    # Get agent
    agent = get_or_create_agent("test_user_delegation")

    # Test message that should trigger delegation
    test_message = """
    I need a medical consultation. Please consult an internist about 
    a patient with high blood pressure (150/95) and fatigue.
    """

    print(f"📤 Sending message:\n{test_message}\n")
    print("-" * 60)

    # Track events
    tool_calls_seen = []
    delegation_found = False

    # Stream response
    stream = await agent.process_message(
        user_message=test_message.strip(),
        stream=True,
        chat_history=[]
    )

    print("\n📡 Streaming response...\n")

    async for event in stream:
        if isinstance(event, dict):
            event_type = event.get("type")

            if event_type == "content":
                content = event.get("content", "")
                print(content, end="", flush=True)

            elif event_type == "tool_call":
                tool_name = event.get("tool")
                tool_args = event.get("args")
                tool_calls_seen.append({
                    "tool": tool_name,
                    "args": tool_args
                })
                print(f"\n\n🔧 Tool Call: {tool_name}")
                print(f"   Args: {tool_args}")
                
                if tool_name == "delegate_to_specialist":
                    delegation_found = True

            elif event_type == "tool_result":
                result = event.get("result", "")
                print(f"   ✅ Result: {result[:200]}...")

    print("\n\n" + "="*60)
    print("Test Results")
    print("="*60)

    print(f"\n✅ Total tool calls: {len(tool_calls_seen)}")
    for i, call in enumerate(tool_calls_seen, 1):
        print(f"   {i}. {call['tool']} - {call['args']}")

    if delegation_found:
        print("\n✅ SUCCESS: Agent successfully delegated to specialist!")
        return True
    else:
        print("\n❌ FAILURE: Agent did not use delegation tool")
        print("   Available tools should include 'delegate_to_specialist'")
        return False


async def test_available_tools():
    """Check what tools are available to the agent."""
    print("\n" + "="*60)
    print("Checking Available Tools")
    print("="*60 + "\n")
    
    from src.tools.registry import ToolRegistry
    from src.agent.agent_loader import AgentLoader
    
    # Load agents and tools
    agent_loader = AgentLoader()
    await agent_loader.load_enabled_agents()
    
    # Get tool registry
    registry = ToolRegistry()
    
    # Get global tools
    global_tools = registry.get_langchain_tools(scope_filter="global")
    
    print(f"Global tools available: {len(global_tools)}")
    for i, tool in enumerate(global_tools, 1):
        print(f"   {i}. {tool.name}")
    
    # Check if delegate_to_specialist would be added
    print(f"\nSub-agents loaded: {len(agent_loader.sub_agents)}")
    for role, info in agent_loader.sub_agents.items():
        print(f"   - {role}: {info.get('name')}")
    
    print("\nNote: delegate_to_specialist is added dynamically in graph_builder")


async def main():
    """Run all tests."""
    print("\n🧪 Testing Agent Delegation Functionality\n")

    try:
        # Test 1: Check available tools
        await test_available_tools()

        # Test 2: Test delegation
        result = await test_delegation()

        if result:
            print("\n" + "="*60)
            print("✅ DELEGATION TEST PASSED")
            print("="*60 + "\n")
        else:
            print("\n" + "="*60)
            print("❌ DELEGATION TEST FAILED")
            print("="*60 + "\n")

    except Exception as e:
        print(f"\n❌ Error during testing: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(main())
