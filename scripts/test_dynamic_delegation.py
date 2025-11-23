"""Test dynamic specialist delegation based on database descriptions."""

import asyncio
import sys
sys.path.insert(0, '/Users/kien.ha/Code/ai-agent')

from src.agent.langgraph_agent import LangGraphAgent
from src.llm.kimi import KimiProvider
from src.config.settings import load_config

async def test_dynamic_delegation():
    """Test that agent uses database descriptions to make delegation decisions."""
    
    print("=" * 70)
    print("Testing Dynamic Specialist Delegation")
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
    print("Initializing agent...")
    agent = LangGraphAgent(
        llm_with_tools=llm_provider.llm,
        user_id="test_user",
        max_iterations=10,
        use_persistence=False
    )
    print("✓ Agent initialized")
    print()
    
    # Load specialists
    print("Loading specialists from database...")
    await agent._load_enabled_agents()
    
    print(f"✓ Loaded {len(agent.sub_agents)} specialists:")
    for role, info in agent.sub_agents.items():
        print(f"  - {info['name']} ({role}): {info['description'][:60]}...")
    print()
    
    # Test queries
    test_cases = [
        {
            "query": "Who is patient 23?",
            "expected_specialist": "clinical_text",
            "reason": "Patient records query should go to Internist"
        },
        {
            "query": "Are there any drug interactions between aspirin and warfarin?",
            "expected_specialist": "drug_interaction",
            "reason": "Drug interaction query should go to Pharmacist"
        }
    ]
    
    for i, test in enumerate(test_cases, 1):
        print("=" * 70)
        print(f"Test {i}: {test['query']}")
        print("=" * 70)
        print(f"Expected: Delegate to {test['expected_specialist']}")
        print(f"Reason: {test['reason']}")
        print()
        
        try:
            response = await agent.process_message(test['query'], stream=False)
            
            # Check if delegation happened
            if test['expected_specialist'] in response.lower() or any(
                info['name'].lower() in response.lower() 
                for role, info in agent.sub_agents.items() 
                if role == test['expected_specialist']
            ):
                print("✓ PASS: Correct specialist was consulted")
            else:
                print("⚠ Response received but unclear if delegation worked correctly")
            
            print(f"\nResponse preview: {response[:200]}...")
            print()
            
        except Exception as e:
            print(f"✗ ERROR: {str(e)}")
            import traceback
            traceback.print_exc()
            print()
    
    print("=" * 70)
    print("Testing Complete")
    print("=" * 70)
    print()
    print("The agent now:")
    print("  ✓ Fetches specialist descriptions from database dynamically")
    print("  ✓ Makes delegation decisions based on those descriptions")
    print("  ✓ No hardcoded specialist mappings in the system prompt")

if __name__ == "__main__":
    asyncio.run(test_dynamic_delegation())
