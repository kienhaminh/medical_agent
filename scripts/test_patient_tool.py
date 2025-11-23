"""Test script to verify patient tool can be executed properly."""

import asyncio
import sys
sys.path.insert(0, '/Users/kien.ha/Code/ai-agent')

from src.tools.registry import ToolRegistry
from src.tools.loader import load_custom_tools
from src.tools.executor import ToolExecutor

async def test_patient_tool():
    print("=" * 70)
    print("Testing Patient Tool Execution")
    print("=" * 70)
    print()
    
    # Reset and load tools
    registry = ToolRegistry()
    registry.reset()
    
    # Load custom tools from database
    print("Loading custom tools from database...")
    await load_custom_tools()
    print()
    
    # Check if patient tool is loaded
    all_tools = registry.list_tools()
    patient_tool_found = False
    for tool in all_tools:
        if tool["name"] == "query_patient_info":
            patient_tool_found = True
            print(f"✓ Patient tool loaded: {tool['name']}")
            print(f"  - Enabled: {tool['enabled']}")
            print(f"  - Scope: {registry._tool_scopes.get(tool['name'], 'unknown')}")
    
    if not patient_tool_found:
        print("✗ Patient tool not found!")
        return False
    
    print()
    
    # Test execution
    print("Testing tool execution...")
    print()
    
    executor = ToolExecutor(registry)
    
    # Test with patient ID 23
    print("Executing: query_patient_info(query='23')")
    result = executor.execute("query_patient_info", {"query": "23"})
    
    if result.success:
        print("✓ Tool executed successfully!")
        print()
        print("Result:")
        print(result.data)
        print()
        return True
    else:
        print("✗ Tool execution failed!")
        print(f"Error: {result.error}")
        print()
        return False

if __name__ == "__main__":
    success = asyncio.run(test_patient_tool())
    sys.exit(0 if success else 1)
