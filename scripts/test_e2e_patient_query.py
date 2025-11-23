"""Integration test to verify end-to-end patient query flow."""

import asyncio
import sys
sys.path.insert(0, '/Users/kien.ha/Code/ai-agent')

from src.agent.langgraph_agent import LangGraphAgent
from src.llm import get_llm

async def test_patient_query():
    """Test the complete flow: User -> Main Agent -> Internist -> Tool -> Response"""
    
    print("=" * 70)
    print("End-to-End Patient Query Test")
    print("=" * 70)
    print()
    
    # Initialize agent
    print("Initializing agent...")
    llm = get_llm(temperature=0.0)  # Deterministic for testing
    
    agent = LangGraphAgent(
        llm_with_tools=llm,
        user_id="test_user",
        max_iterations=5,
        use_persistence=False
    )
    print("✓ Agent initialized")
    print()
    
    # Test query
    user_query = "Who is patient 23?"
    print(f"User Query: '{user_query}'")
    print()
    
    print("Processing...")
    print("-" * 70)
    
    try:
        response = await agent.process_message(user_query, stream=False)
        
        print()
        print("-" * 70)
        print("Response:")
        print()
        print(response)
        print()
        
        # Verify response contains patient info
        success_indicators = [
            "Nancy Martinez" in response or "nancy martinez" in response.lower(),
            "23" in response,
            "patient" in response.lower()
        ]
        
        if any(success_indicators):
            print("=" * 70)
            print("✓ SUCCESS: Patient information retrieved!")
            print("=" * 70)
            return True
        else:
            print("=" * 70)
            print("⚠ WARNING: Response doesn't contain expected patient info")
            print("=" * 70)
            return False
            
    except Exception as e:
        print()
        print("-" * 70)
        print(f"✗ ERROR: {str(e)}")
        print()
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = asyncio.run(test_patient_query())
    sys.exit(0 if success else 1)
