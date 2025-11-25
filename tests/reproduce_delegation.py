import asyncio
import sys
import os

# Add src to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from unittest.mock import MagicMock, AsyncMock
from langchain_core.messages import HumanMessage, ToolMessage, AIMessage
from src.agent.graph_builder import GraphBuilder
from src.tools.registry import ToolRegistry
from src.agent.agent_loader import AgentLoader
from src.agent.specialist_handler import SpecialistHandler

# Mock LLM
class MockLLM:
    def __init__(self):
        self.bound_tools = []
    
    def bind_tools(self, tools):
        self.bound_tools = tools
        return self
    
    def invoke(self, messages):
        # Check if we should call a tool
        last_msg = messages[-1]
        print(f"LLM invoked with last message type: {type(last_msg).__name__}")
        
        if isinstance(last_msg, HumanMessage) and "consult" in last_msg.content.lower():
            # Simulate tool call
            print("LLM deciding to call tool: consult_specialist")
            return AIMessage(
                content="",
                tool_calls=[{
                    "name": "consult_specialist",
                    "args": {"query": "help me"},
                    "id": "call_123"
                }]
            )
        elif isinstance(last_msg, ToolMessage):
            # Simulate response after tool call
            print(f"LLM received tool output: {last_msg.content}")
            return AIMessage(content="I have consulted the specialist.")
        
        return AIMessage(content="I can't help.")

async def run_test():
    # Setup mocks
    llm = MockLLM()
    tool_registry = ToolRegistry()
    
    # Mock AgentLoader
    agent_loader = MagicMock(spec=AgentLoader)
    agent_loader.sub_agents = {
        "specialist": {
            "id": "spec_1",
            "name": "Specialist",
            "role": "specialist",
            "description": "A specialist agent",
            "system_prompt": "You are a specialist."
        }
    }
    
    # Mock SpecialistHandler
    specialist_handler = MagicMock(spec=SpecialistHandler)
    specialist_handler.extract_specialist_request.return_value = []
    specialist_handler.has_specialist_request.return_value = False
    # Mock consult_specialists to return a response
    specialist_handler.consult_specialists = AsyncMock(return_value=[
        AIMessage(content="Specialist response: I can help!")
    ])
    
    # Build Graph
    builder = GraphBuilder(
        llm=llm,
        tool_registry=tool_registry,
        agent_loader=agent_loader,
        specialist_handler=specialist_handler,
        system_prompt="You are a main agent."
    )
    
    graph = builder.build()
    
    # Verify tools are registered
    tools = tool_registry.get_langchain_tools(scope_filter="global")
    print(f"Global tools: {[t.name for t in tools]}")
    
    if "consult_specialist" not in [t.name for t in tools]:
        print("ERROR: Delegation tool not registered!")
        return
    
    # Run graph
    print("\nRunning graph...")
    result = await graph.ainvoke({
        "messages": [HumanMessage(content="consult specialist")]
    })
    
    print("\nFinal messages:")
    for m in result["messages"]:
        print(f"{type(m).__name__}: {m.content}")
        if hasattr(m, "tool_calls") and m.tool_calls:
            print(f"  Tool Calls: {m.tool_calls}")
            
    # Check if specialist was consulted
    if specialist_handler.consult_specialists.called:
        print("\nSUCCESS: Specialist was consulted!")
    else:
        print("\nFAILURE: Specialist was NOT consulted!")

if __name__ == "__main__":
    asyncio.run(run_test())
