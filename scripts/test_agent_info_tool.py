"""
Quick test script to verify get_agent_architecture tool works correctly.

This tests both:
1. Direct invocation (sync context)
2. From within async LangGraph agent (async context with running event loop)
"""

import asyncio
from src.tools.builtin.agent_info_tool import get_agent_architecture


def test_direct_call():
    """Test direct synchronous call."""
    print("=" * 70)
    print("TEST 1: Direct Synchronous Call")
    print("=" * 70)
    print()

    try:
        result = get_agent_architecture()
        print("✓ Success!")
        print()
        print("Result:")
        print(result)
        print()
        return True
    except Exception as e:
        print(f"✗ Error: {e}")
        import traceback
        traceback.print_exc()
        return False


async def test_async_context():
    """Test from within async context (simulates LangGraph)."""
    print("=" * 70)
    print("TEST 2: From Async Context (Simulating LangGraph)")
    print("=" * 70)
    print()

    try:
        # We're in an async function with a running event loop
        # This is the scenario that was failing before
        result = get_agent_architecture()
        print("✓ Success! (No 'event loop already running' error)")
        print()
        print("Result:")
        print(result)
        print()
        return True
    except Exception as e:
        print(f"✗ Error: {e}")
        import traceback
        traceback.print_exc()
        return False


async def test_from_langgraph_style():
    """Test in a more realistic LangGraph-style scenario."""
    print("=" * 70)
    print("TEST 3: Realistic LangGraph Scenario")
    print("=" * 70)
    print()

    # Simulate what happens in LangGraph ToolNode
    async def tool_executor():
        """Simulates LangGraph's tool execution."""
        # In real LangGraph, tools are called from within async context
        # but the tools themselves are sync functions
        return get_agent_architecture()

    try:
        result = await tool_executor()
        print("✓ Success in LangGraph-style execution!")
        print()
        print("Result:")
        print(result)
        print()
        return True
    except Exception as e:
        print(f"✗ Error: {e}")
        import traceback
        traceback.print_exc()
        return False


async def main():
    """Run all tests."""
    print("\n" + "=" * 70)
    print("AGENT INFO TOOL - FIX VERIFICATION")
    print("=" * 70)
    print()

    # Test 1: Direct call
    test1_pass = test_direct_call()

    # Test 2: Async context
    test2_pass = await test_async_context()

    # Test 3: LangGraph-style
    test3_pass = await test_from_langgraph_style()

    # Summary
    print("=" * 70)
    print("TEST SUMMARY")
    print("=" * 70)
    print()
    print(f"Test 1 (Direct Call):        {'✓ PASS' if test1_pass else '✗ FAIL'}")
    print(f"Test 2 (Async Context):      {'✓ PASS' if test2_pass else '✗ FAIL'}")
    print(f"Test 3 (LangGraph Style):    {'✓ PASS' if test3_pass else '✗ FAIL'}")
    print()

    if all([test1_pass, test2_pass, test3_pass]):
        print("✓ ALL TESTS PASSED!")
        print()
        print("The tool now works correctly in both sync and async contexts.")
        print("The 'event loop already running' error has been fixed.")
    else:
        print("⚠ SOME TESTS FAILED")
        print()
        print("Please review the errors above.")

    print("=" * 70)


if __name__ == "__main__":
    asyncio.run(main())
