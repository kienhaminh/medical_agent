
import sys
from unittest.mock import MagicMock, AsyncMock

# Mock database module BEFORE importing anything else
sys.modules["src.config.database"] = MagicMock()
sys.modules["src.config.database"].AsyncSessionLocal = MagicMock()
sys.modules["src.config.database"].Tool = MagicMock()

import asyncio
import time
import logging
from langchain_core.messages import HumanMessage, AIMessage, ToolMessage

# Now import the handler
from src.agent import specialist_handler
from src.tools.registry import ToolRegistry

# Mock adispatch_custom_event
specialist_handler.adispatch_custom_event = AsyncMock()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class MockLLM:
    def __init__(self):
        self.responses = []
        self.call_count = 0

    def bind_tools(self, tools):
        return self

    async def ainvoke(self, messages):
        self.call_count += 1
        logger.info(f"MockLLM ainvoke called (count={self.call_count})")
        
        # Simulate LLM latency
        await asyncio.sleep(1.0) 
        
        # Check if this is the second call (has ToolMessage in history)
        has_tool_output = any(isinstance(m, ToolMessage) for m in messages)
        
        if has_tool_output:
            logger.info("MockLLM: Generating synthesis from tool output...")
            return AIMessage(content="Synthesized response based on tool output.")
        
        # First call: return a tool call
        logger.info("MockLLM: Generating tool call...")
        msg = AIMessage(content="")
        msg.tool_calls = [{
            "name": "mock_tool",
            "args": {"query": "test"},
            "id": "call_123"
        }]
        return msg

class MockToolRegistry(ToolRegistry):
    def get_tools_by_symbols(self, symbols):
        return [MagicMock(name="mock_tool")]
    
    async def get_langchain_tools_for_agent(self, agent_id):
        return [MagicMock(name="mock_tool")]
        
    def get_langchain_tools(self, scope_filter=None):
        return [MagicMock(name="mock_tool")]

async def run_test():
    llm = MockLLM()
    tool_registry = MockToolRegistry()
    
    # Mock ToolExecutor
    # We need to patch ToolExecutor inside the handler
    
    class MockToolExecutor:
        def __init__(self, registry):
            pass
        def execute(self, name, args):
            time.sleep(0.5) # Simulate tool latency
            return MagicMock(success=True, data="Tool Result Data")
            
    specialist_handler.ToolExecutor = MockToolExecutor
    
    handler = specialist_handler.SpecialistHandler(
        llm=llm,
        tool_registry=tool_registry
    )
    
    # Mock sub_agents
    handler.set_sub_agents({
        "specialist": {
            "id": "1",
            "name": "Specialist",
            "system_prompt": "You are a specialist.",
            "tools": ["mock_tool"]
        }
    })
    
    print("--- Starting Consultation ---")
    start_time = time.time()
    
    responses = await handler.consult_specialists(
        specialists_needed=["specialist"],
        user_query=HumanMessage(content="Help me"),
        synthesize_response=False
    )
    
    end_time = time.time()
    print(f"--- Finished in {end_time - start_time:.2f}s ---")
    print(f"Responses: {responses}")

if __name__ == "__main__":
    asyncio.run(run_test())
