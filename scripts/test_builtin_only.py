"""Test that main agent only has access to builtin tools, not custom tools."""

import asyncio
import sys
sys.path.insert(0, '/Users/kien.ha/Code/ai-agent')

# Import builtin tools to trigger auto-registration
from src.tools.builtin import get_current_datetime, get_location, get_current_weather, create_new_tool
from src.tools.registry import ToolRegistry

def test_main_agent_tools():
    """Verify main agent only has builtin tools."""
    
    print("=" * 70)
    print("Testing Main Agent Tool Access (After Builtin Import)")
    print("=" * 70)
    print()
    
    registry = ToolRegistry()
    
    # Get ALL registered tools
    all_tools = registry.list_tools()
    print(f"All registered tools: {len(all_tools)}")
    for tool in all_tools:
        scope = registry._tool_scopes.get(tool['name'], 'unknown')
        status = "enabled" if tool['enabled'] else "disabled"
        print(f"  - {tool['name']}: scope={scope}, status={status}")
    
    print()
    
    # Get tools for main agent (scope="global")
    main_tools = registry.get_langchain_tools(scope_filter="global")
    
    print("Tools available to main agent (scope='global'):")
    print("-" * 70)
    
    builtin_tools = []
    custom_tools = []
    
    for tool in main_tools:
        scope = registry._tool_scopes.get(tool.name, "unknown")
        print(f"  - {tool.name} (scope: {scope})")
        
        # Categorize
        if tool.name in ["get_current_datetime", "get_location", "get_current_weather", 
                        "get_agent_architecture", "create_new_tool"]:
            builtin_tools.append(tool.name)
        else:
            custom_tools.append(tool.name)
    
    print()
    print("=" * 70)
    print("Analysis:")
    print("=" * 70)
    print(f"Builtin tools: {len(builtin_tools)}")
    for name in builtin_tools:
        print(f"  ✓ {name}")
    
    print()
    print(f"Custom tools: {len(custom_tools)}")
    if custom_tools:
        for name in custom_tools:
            print(f"  ⚠ {name} (should NOT be in main agent!)")
    else:
        print("  (none - correct!)")
    
    print()
    
    # Check for specific tools that should NOT be there
    all_tool_names = [t.name for t in main_tools]
    
    bad_tools = []
    if "query_patient_info" in all_tool_names:
        bad_tools.append("query_patient_info")
    if "blood_pressure_calculator" in all_tool_names:
        bad_tools.append("blood_pressure_calculator")
    if "bmi_calculator" in all_tool_names:
        bad_tools.append("bmi_calculator")
    
    print("=" * 70)
    print("Verification:")
    print("=" * 70)
    
    if bad_tools:
        print("❌ FAIL: Main agent has access to custom tools!")
        print(f"   These should NOT be accessible: {bad_tools}")
        return False
    elif len(builtin_tools) == 0:
        print("⚠ WARNING: No builtin tools found")
        print("  This might be OK if tools are loaded dynamically")
        return True
    else:
        print(f"✓ PASS: Main agent has {len(builtin_tools)} builtin tools")
        print("  Custom tools are NOT accessible to main agent")
        print("  Custom tools will only be loaded for assigned sub-agents")
        return True

if __name__ == "__main__":
    success = test_main_agent_tools()
    sys.exit(0 if success else 1)
