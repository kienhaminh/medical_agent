import asyncio
import sys
import os
import pytest
from unittest.mock import MagicMock, AsyncMock

# Mock database module BEFORE importing anything else
sys.modules["src.config.database"] = MagicMock()
sys.modules["src.config.database"].AsyncSessionLocal = MagicMock()
sys.modules["src.config.database"].Tool = MagicMock()

from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from src.agent.graph_builder import GraphBuilder
from src.tools.registry import ToolRegistry
from src.agent.agent_loader import AgentLoader
from src.agent.specialist_handler import SpecialistHandler

from langchain_core.runnables import Runnable

class MockLLM(Runnable):
    def __init__(self, responses=None):
        self.responses = responses or {}
        self.default_response = "I don't know."
        self.bound_tools = []

    def bind_tools(self, tools):
        self.bound_tools = tools
        return self

    def invoke(self, input_data, config=None, **kwargs):
        # Extract prompt content to decide response
        messages = []
        if hasattr(input_data, "to_messages"):
            messages = input_data.to_messages()
        elif isinstance(input_data, list):
            messages = input_data
        elif isinstance(input_data, dict):
            messages = input_data.get("messages", [])

        # Check system prompt or user content
        content = ""
        for m in messages:
            content += str(m.content)
        
        if not content and hasattr(input_data, "to_string"):
             content = input_data.to_string()
        elif not content:
             content = str(input_data)

        print(f"[MockLLM] Input content: {content[:100]}...")

        print(f"[MockLLM] Input content: {content[:100]}...")

        if "Classify the query as 'MEDICAL' or 'NON_MEDICAL'" in content:
            # Check for specific medical keywords in the input
            # Ensure we don't match "non-medical" when looking for "medical"
            content_lower = content.lower()
            if "headache" in content_lower:
                return AIMessage(content="MEDICAL")
            elif "medical" in content_lower and "non-medical" not in content_lower:
                 return AIMessage(content="MEDICAL")
            else:
                return AIMessage(content="NON_MEDICAL")
        
        if "You are a medical router" in content:
            return AIMessage(content="cardiology")
            
        if "Synthesize the following specialist report" in content:
            return AIMessage(content="Here is the synthesized answer.")
            
        if "non-medical" in content or "Direct answer" in content: # Direct answer
             return AIMessage(content="Direct answer to non-medical query.")

        return AIMessage(content=self.default_response)

@pytest.mark.asyncio
async def test_medical_flow():
    print("\n--- Testing Medical Flow ---")
    llm = MockLLM()
    tool_registry = ToolRegistry()
    
    agent_loader = MagicMock(spec=AgentLoader)
    agent_loader.sub_agents = {
        "cardiology": {"id": "1", "name": "Cardiologist", "role": "cardiology", "system_prompt": "You are a cardiologist."}
    }
    
    specialist_handler = MagicMock(spec=SpecialistHandler)
    specialist_handler.consult_specialists = AsyncMock(return_value=[
        AIMessage(content="Cardiologist report: Patient has arrhythmia.")
    ])
    
    builder = GraphBuilder(
        llm=llm,
        tool_registry=tool_registry,
        agent_loader=agent_loader,
        specialist_handler=specialist_handler,
        system_prompt="System Prompt"
    )
    
    graph = builder.build()
    
    result = await graph.ainvoke({
        "messages": [HumanMessage(content="I have a headache and chest pain. (medical)")]
    })
    
    print("Final State:", result)
    
    assert result.get("is_medical") is True
    assert result.get("target_specialist") == "cardiology"
    assert "Here is the synthesized answer." in result["final_report"]
    assert specialist_handler.consult_specialists.called

@pytest.mark.asyncio
async def test_non_medical_flow():
    print("\n--- Testing Non-Medical Flow ---")
    llm = MockLLM()
    tool_registry = ToolRegistry()
    
    agent_loader = MagicMock(spec=AgentLoader)
    agent_loader.sub_agents = {}
    
    specialist_handler = MagicMock(spec=SpecialistHandler)
    
    builder = GraphBuilder(
        llm=llm,
        tool_registry=tool_registry,
        agent_loader=agent_loader,
        specialist_handler=specialist_handler,
        system_prompt="System Prompt"
    )
    
    graph = builder.build()
    
    result = await graph.ainvoke({
        "messages": [HumanMessage(content="Hello, how are you? (non-medical)")]
    })
    
    print("Final State:", result)
    
    assert result.get("is_medical") is False
    assert result.get("target_specialist") == "non_medical"
    assert "Direct answer" in result["final_report"]
    assert not specialist_handler.consult_specialists.called

if __name__ == "__main__":
    asyncio.run(test_medical_flow())
    asyncio.run(test_non_medical_flow())
