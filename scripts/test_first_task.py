"""Simple test to verify agent delegation and tool execution."""

import asyncio
import sys
sys.path.insert(0, '/Users/kien.ha/Code/ai-agent')

from src.agent.langgraph_agent import LangGraphAgent
from src.llm.kimi import KimiProvider
from src.config.settings import load_config

async def test_patient_query():
    """Test: Main agent -> Internist -> query_patient_info -> Response"""
    
    print("=" * 70)
    print("Testing: 'Who is patient 23?'")
    print("=" * 70)
    print()
    
    # Initialize LLM
    config = load_config()
    llm_provider = KimiProvider(
        api_key=config.kimi_api_key,
        model="moonshot-v1-8k",  # Use faster model for testing
        temperature=0.0
    )
    
    # Create agent
    print("Initializing agent...")
    agent = LangGraphAgent(
        llm_with_tools=llm_provider.llm,
        user_id="test_user",
        max_iterations=10,
        use_persistence=False
    )
    print("✓ Agent initialized")
    print()
    
    # Test query
    user_query = "Who is patient 23?"
    print(f"User: {user_query}")
    print()
    print("Processing (this may take 10-20 seconds)...")
    print("-" * 70)
    
    try:
        response = await agent.process_message(user_query, stream=False)
        
        print()
        print("-" * 70)
        print("Agent Response:")
        print()
        print(response)
        print()
        
        # Check if response contains patient info
        success_checks = {
            "Contains 'Nancy Martinez'": "nancy martinez" in response.lower(),
            "Contains patient ID '23'": "23" in response,
            "Not an error message": "unable to retrieve" not in response.lower() and "technical issue" not in response.lower(),
            "Contains patient info": any(word in response.lower() for word in ["patient", "dob", "gender", "record"])
        }
        
        print("=" * 70)
        print("Verification:")
        print("=" * 70)
        for check, passed in success_checks.items():
            status = "✓" if passed else "✗"
            print(f"{status} {check}")
        print()
        
        if all(success_checks.values()):
            print("🎉 SUCCESS! Patient query works end-to-end!")
            return True
        else:
            print("⚠️  PARTIAL SUCCESS: Got response but may not contain expected info")
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
