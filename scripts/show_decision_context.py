"""Test to see the actual delegation decision context."""

import asyncio
import sys
sys.path.insert(0, '/Users/kien.ha/Code/ai-agent')

from src.agent.langgraph_agent import LangGraphAgent
from src.llm.kimi import KimiProvider
from src.config.settings import load_config

async def test_decision_context():
    """Check what decision context the agent sees."""
    
    print("=" * 70)
    print("Checking Agent Decision Context")
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
    
    # Load specialists
    print("Loading specialists...")
    await agent._load_enabled_agents()
    print(f"✓ Loaded {len(agent.sub_agents)} specialists")
    print()
    
    # Show what the agent sees
    print("=" * 70)
    print("DECISION CONTEXT (what the LLM sees)")
    print("=" * 70)
    print()
    
    decision_context = agent._build_decision_context()
    print(decision_context)
    print()
    
    print("=" * 70)
    print("This context is sent to the LLM before each decision")
    print("=" * 70)

if __name__ == "__main__":
    asyncio.run(test_decision_context())
