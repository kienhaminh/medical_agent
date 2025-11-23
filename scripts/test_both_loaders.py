"""Verify both tool loaders (sync and async) work correctly."""

import asyncio
import sys
sys.path.insert(0, '/Users/kien.ha/Code/ai-agent')

from src.tools.registry import ToolRegistry
from src.tools.executor import ToolExecutor

async def test_both_loaders():
    """Test both sync and async tool loaders."""
    
    print("=" * 70)
    print("Testing Tool Loaders")
    print("=" * 70)
    print()
    
    # Test 1: Async Loader (used by agent)
    print("TEST 1: Async Loader (src/tools/loader.py)")
    print("-" * 70)
    
    from src.tools.loader import load_custom_tools as async_loader
    
    registry = ToolRegistry()
    registry.reset()
    
    await async_loader()
    
    tools = registry.list_tools()
    patient_tool = None
    for tool in tools:
        if tool["name"] == "query_patient_info":
            patient_tool = tool
            break
    
    if patient_tool:
        print(f"✓ Patient tool loaded: {patient_tool['name']}")
        
        # Try to execute it
        executor = ToolExecutor(registry)
        result = executor.execute("query_patient_info", {"query": "23"})
        
        if result.success:
            print("✓ Async loader: Tool execution successful!")
            print(f"  Result preview: {str(result.data)[:80]}...")
        else:
            print(f"✗ Async loader: Tool execution failed: {result.error}")
            return False
    else:
        print("✗ Async loader: Patient tool not found")
        return False
    
    print()
    
    # Test 2: Sync Loader (used by server)
    print("TEST 2: Sync Loader (src/api/server.py)")
    print("-" * 70)
    
    # Reset registry
    registry.reset()
    
    # Import and run the sync loader from server
    from src.api.server import load_custom_tools as sync_loader
    
    sync_loader()
    
    tools = registry.list_tools()
    patient_tool = None
    for tool in tools:
        if tool["name"] == "query_patient_info":
            patient_tool = tool
            break
    
    if patient_tool:
        print(f"✓ Patient tool loaded: {patient_tool['name']}")
        
        # Try to execute it
        executor = ToolExecutor(registry)
        result = executor.execute("query_patient_info", {"query": "23"})
        
        if result.success:
            print("✓ Sync loader: Tool execution successful!")
            print(f"  Result preview: {str(result.data)[:80]}...")
        else:
            print(f"✗ Sync loader: Tool execution failed: {result.error}")
            return False
    else:
        print("✗ Sync loader: Patient tool not found")
        return False
    
    print()
    print("=" * 70)
    print("✓ BOTH LOADERS WORK CORRECTLY!")
    print("=" * 70)
    print()
    print("Summary:")
    print("  ✓ Async loader (agent) - loads and executes tools")
    print("  ✓ Sync loader (server) - loads and executes tools")
    print("  ✓ No NameError: SessionLocal is defined")
    print()
    
    return True

if __name__ == "__main__":
    success = asyncio.run(test_both_loaders())
    sys.exit(0 if success else 1)
