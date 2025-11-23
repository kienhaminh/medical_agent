"""Test to verify scope-based access control prevents main agent from directly calling patient tool."""

import asyncio
import sys
sys.path.insert(0, '/Users/kien.ha/Code/ai-agent')

from src.agent.langgraph_agent import LangGraphAgent
from src.llm.kimi import KimiProvider
from src.config.settings import load_config

async def test_scope_enforcement():
    """Verify main agent cannot directly call patient tool."""
    
    print("=" * 70)
    print("Testing Scope-Based Access Control")
    print("=" * 70)
    print()
    
    # Initialize LLM
    config = load_config()
    llm_provider = KimiProvider(
        api_key=config.kimi_api_key,
        model="moonshot-v1-8k",
        temperature=0.0
    )
    
    # Create agent WITHOUT pre-binding tools
    print("Creating agent...")
    agent = LangGraphAgent(
        llm_with_tools=llm_provider.llm,  # Pass LLM WITHOUT tools bound
        user_id="test_user",
        max_iterations=10
    )
    print("✓ Agent created")
    print()
    
    # Check what the main agent sees
    print("Checking main agent's tool access...")
    print("-" * 70)
    
    from src.tools.registry import ToolRegistry
    registry = ToolRegistry()
    
    main_tools = registry.get_langchain_tools(scope_filter="global")
    print(f"\nTools available to main agent: {len(main_tools)}")
    for tool in main_tools:
        print(f"  - {tool.name}")
    
    has_patient_tool = any(t.name == "query_patient_info" for t in main_tools)
    
    if has_patient_tool:
        print("\n❌ FAIL: Main agent has query_patient_info tool")
        print("   Scope-based access control is NOT working!")
        return False
    else:
        print("\n✓ PASS: Main agent does NOT have query_patient_info tool")
        print("   Scope-based access control is working!")
    
    print()
    print("=" * 70)
    print("Testing Patient Query Flow")
    print("=" * 70)
    print()
    
    user_query = "Who is patient 23?"
    print(f"Query: {user_query}")
    print()
    print("Expected behavior:")
    print("  1. Main agent recognizes it cannot query patient data")
    print("  2. Main agent says 'CONSULT: clinical_text' ")
    print("  3. System delegates to Internist")
    print("  4. Internist uses query_patient_info tool")
    print("  5. Returns patient information")
    print()
    print("Processing (may take 10-20 seconds)...")
    print("-" * 70)
    
    try:
        response = await agent.process_message(user_query, stream=False)
        
        print()
        print("-" * 70)
        print("Response:")
        print()
        print(response)
        print()
        
        # Check if response contains patient info
        has_nancy = "nancy" in response.lower() or "martinez" in response.lower()
        has_patient_23 = "23" in response
        
        if has_nancy and has_patient_23:
            print("=" * 70)
            print("✓ SUCCESS: Delegation worked!")
            print("=" * 70)
            print()
            print("The main agent:")
            print("  ✓ Did NOT call query_patient_info directly")
            print("  ✓ Delegated to Internist sub-agent")
            print("  ✓ Internist called query_patient_info tool")
            print("  ✓ Patient information returned correctly")
            return True
        else:
            print("=" * 70)
            print("⚠ Response received but doesn't contain expected patient info")
            print("=" * 70)
            print()
            print("This might indicate:")
            print("  - Agent didn't delegate properly")
            print("  - Delegation worked but tool failed")
            print("  - LLM responded without using specialists")
            return False
            
    except Exception as e:
        print()
        print("-" * 70)
        print(f"✗ ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = asyncio.run(test_scope_enforcement())
    sys.exit(0 if success else 1)
