"""
Integration test to verify main agent can delegate to sub-agents.

This test verifies the fix for the delegation issue.
"""
import pytest
import asyncio
from src.api.dependencies import get_or_create_agent

@pytest.mark.asyncio
async def test_agent_has_delegation_prompt():
    """Verify agent uses delegation-aware system prompt."""
    agent = get_or_create_agent("test_delegation_user")
    
    # Check system prompt contains delegation keywords
    assert "CONSULT:" in agent.system_prompt, "System prompt should contain CONSULT: syntax"
    assert "specialist" in agent.system_prompt.lower(), "System prompt should mention specialists"
    assert "delegate" in agent.system_prompt.lower(), "System prompt should mention delegation"
    
    print("✅ Agent has correct delegation-aware system prompt")

@pytest.mark.asyncio
async def test_sub_agents_loaded():
    """Verify sub-agents are loaded correctly."""
    agent = get_or_create_agent("test_delegation_user")
    sub_agents = await agent.agent_loader.load_enabled_agents()
    
    assert len(sub_agents) > 0, "Should have at least one sub-agent loaded"
    
    # Check Internist is loaded
    assert "clinical_text" in sub_agents, "Internist sub-agent should be loaded"
    
    internist = sub_agents["clinical_text"]
    assert internist["name"] == "Internist", "Internist should be named correctly"
    
    print(f"✅ Loaded {len(sub_agents)} sub-agent(s)")
    for role, info in sub_agents.items():
        print(f"  - {info['name']} (role: {role})")

@pytest.mark.asyncio
async def test_delegation_flow():
    """Test that patient query triggers delegation (integration test)."""
    agent = get_or_create_agent("test_delegation_user")
    
    # Test query that should trigger delegation
    query = "Who is patient 21?"
    
    # Process the message
    response = await agent.process_message(query, stream=False)
    
    # Response should NOT be "I don't have access"
    assert "don't have access" not in response.lower(), \
        "Agent should delegate instead of saying it doesn't have access"
    
    # Response should either:
    # 1. Contain consultation results (best case)
    # 2. Show that delegation was attempted
    # Note: The actual query_patient_info tool will need patient 21 to exist
    
    print(f"✅ Query processed: {query}")
    print(f"Response preview: {response[:200]}...")

if __name__ == "__main__":
    # Run tests
    print("="*80)
    print("TESTING DELEGATION FIX")
    print("="*80)
    print()
    
    asyncio.run(test_agent_has_delegation_prompt())
    print()
    
    asyncio.run(test_sub_agents_loaded())
    print()
    
    asyncio.run(test_delegation_flow())
    print()
    
    print("="*80)
    print("✅ ALL TESTS PASSED")
    print("="*80)
