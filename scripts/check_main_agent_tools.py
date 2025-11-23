"""Check what tools the main agent actually has access to."""

import asyncio
import sys
sys.path.insert(0, '/Users/kien.ha/Code/ai-agent')

from src.agent.langgraph_agent import LangGraphAgent
from src.llm.kimi import KimiProvider
from src.config.settings import load_config
from src.tools.registry import ToolRegistry

async def check_main_agent_tools():
    """Check what tools are available to the main agent."""
    
    print("=" * 70)
    print("Checking Main Agent Tool Access")
    print("=" * 70)
    print()
    
    # Initialize LLM
    config = load_config()
    llm_provider = KimiProvider(
        api_key=config.kimi_api_key,
        model="moonshot-v1-8k",
        temperature=0.0
    )
    
    # Create agent
    agent = LangGraphAgent(
        llm_with_tools=llm_provider.llm,
        user_id="test_user"
    )
    
    # Load specialists (this rebuilds graph)
    await agent._load_enabled_agents()
    
    # Check the tool registry
    registry = ToolRegistry()
    
    print("STEP 1: Check Tool Registry with Scope Filtering")
    print("-" * 70)
    
    # Get tools for main agent (should only get scope="global")
    main_agent_tools = registry.get_langchain_tools(scope_filter="global")
    print(f"\nMain Agent Tools (scope='global'):")
    for tool in main_agent_tools:
        scope = registry._tool_scopes.get(tool.name, "unknown")
        print(f"  - {tool.name} (scope: {scope})")
    
    # Check if patient tool is in main agent tools
    patient_tool_in_main = any(t.name == "query_patient_info" for t in main_agent_tools)
    
    if patient_tool_in_main:
        print("\n❌ PROBLEM: Main agent has access to query_patient_info!")
        print("   This should NOT happen - it's an 'assignable' scope tool")
    else:
        print("\n✓ CORRECT: Main agent does NOT have query_patient_info")
    
    print()
    print("STEP 2: Check LLM Tool Binding")
    print("-" * 70)
    
    # Check what tools are bound to the LLM
    if hasattr(agent.llm, 'bound_tools'):
        print(f"\nTools bound to LLM: {len(agent.llm.bound_tools)}")
        for tool in agent.llm.bound_tools:
            if hasattr(tool, 'name'):
                print(f"  - {tool.name}")
    elif hasattr(agent.llm, 'kwargs') and 'tools' in agent.llm.kwargs:
        print(f"\nTools in LLM kwargs: {len(agent.llm.kwargs['tools'])}")
        for tool in agent.llm.kwargs['tools']:
            if isinstance(tool, dict) and 'function' in tool:
                print(f"  - {tool['function']['name']}")
    else:
        print("\nCouldn't inspect LLM tool binding")
    
    print()
    print("STEP 3: Check All Tools in Registry")
    print("-" * 70)
    
    all_tools = registry.list_tools()
    print(f"\nAll tools in registry: {len(all_tools)}")
    for tool_info in all_tools:
        scope = registry._tool_scopes.get(tool_info['name'], 'unknown')
        status = "enabled" if tool_info['enabled'] else "disabled"
        print(f"  - {tool_info['name']}: scope={scope}, status={status}")
    
    print()
    print("=" * 70)
    print("DIAGNOSIS")
    print("=" * 70)
    
    if patient_tool_in_main:
        print("\n❌ Main agent has direct access to patient tool")
        print("\nPossible causes:")
        print("1. Tool scope is not set to 'assignable' in database")
        print("2. Scope filtering is not working in get_langchain_tools()")
        print("3. Graph build is not using scope_filter parameter")
        print("4. LLM was bound with all tools instead of filtered tools")
    else:
        print("\n✓ Scope-based access control is working correctly")
        print("  Main agent can only access 'global' scope tools")
        print("  Patient tool is restricted to assigned sub-agents")

if __name__ == "__main__":
    asyncio.run(check_main_agent_tools())
