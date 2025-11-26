
import os
from dotenv import load_dotenv

# Load environment variables before any other imports
load_dotenv()

# If DATABASE_URL is not set, set a dummy one for testing if we are mocking everything
if not os.getenv("DATABASE_URL"):
    os.environ["DATABASE_URL"] = "postgresql://user:password@localhost:5432/test_db"

import pytest
from unittest.mock import Mock, AsyncMock, MagicMock
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from src.agent.graph_builder import GraphBuilder
from src.agent.state import AgentState
from src.tools.registry import ToolRegistry
from src.agent.agent_loader import AgentLoader
from src.agent.specialist_handler import SpecialistHandler

class TestAgentStep:
    """Test the agent handling step logic."""

    @pytest.fixture
    def mock_llm(self):
        llm = AsyncMock()
        # bind_tools should be synchronous
        llm.bind_tools = Mock()
        # It should return the llm itself (or a copy) which has ainvoke (which is async)
        llm.bind_tools.return_value = llm
        return llm

    @pytest.fixture
    def mock_components(self):
        tool_registry = Mock(spec=ToolRegistry)
        tool_registry.get_langchain_tools.return_value = []
        
        agent_loader = Mock(spec=AgentLoader)
        agent_loader.sub_agents = {}
        
        specialist_handler = Mock(spec=SpecialistHandler)
        
        return {
            "tool_registry": tool_registry,
            "agent_loader": agent_loader,
            "specialist_handler": specialist_handler
        }

    @pytest.mark.asyncio
    async def test_agent_node_returns_content(self, mock_llm, mock_components):
        """Test that agent node returns content when LLM generates text."""
        # Setup
        builder = GraphBuilder(
            llm=mock_llm,
            tool_registry=mock_components["tool_registry"],
            agent_loader=mock_components["agent_loader"],
            specialist_handler=mock_components["specialist_handler"],
            system_prompt="System prompt"
        )
        
        # Build graph to get the node function (indirectly or by inspecting internals if possible, 
        # but better to test the compiled graph or the node function if accessible)
        # Since main_agent_node is defined inside build(), we can't access it directly easily.
        # However, we can run the compiled graph.
        
        graph = builder.build()
        
        # Mock LLM response
        expected_response = AIMessage(content="Hello world")
        mock_llm.ainvoke.return_value = expected_response
        
        # Input state
        initial_state = {
            "messages": [HumanMessage(content="Hi")],
            "patient_profile": {},
            "steps_taken": 0,
            "final_report": None,
            "next_agents": []
        }
        
        # Run graph
        # We use ainvoke on the compiled graph
        result = await graph.ainvoke(initial_state)
        
        # Verify
        assert "messages" in result
        last_message = result["messages"][-1]
        assert isinstance(last_message, AIMessage)
        assert last_message.content == "Hello world"
        
        # Verify LLM called correctly
        mock_llm.ainvoke.assert_called_once()
        call_args = mock_llm.ainvoke.call_args[0][0]
        assert isinstance(call_args[0], SystemMessage)
        assert call_args[0].content == "System prompt"
        assert isinstance(call_args[1], HumanMessage)
        assert call_args[1].content == "Hi"

    @pytest.mark.asyncio
    async def test_agent_node_generates_tool_call(self, mock_llm, mock_components):
        """Test that agent node generates tool call when LLM decides to."""
        # Setup
        builder = GraphBuilder(
            llm=mock_llm,
            tool_registry=mock_components["tool_registry"],
            agent_loader=mock_components["agent_loader"],
            specialist_handler=mock_components["specialist_handler"],
            system_prompt="System prompt"
        )
        
        graph = builder.build()
        
        # Mock LLM response with tool call
        tool_call = {
            "name": "test_tool",
            "args": {"arg": "value"},
            "id": "call_123"
        }
        expected_response = AIMessage(
            content="",
            tool_calls=[tool_call]
        )
        mock_llm.ainvoke.return_value = expected_response
        
        # Input state
        initial_state = {
            "messages": [HumanMessage(content="Use tool")],
            "patient_profile": {},
            "steps_taken": 0,
            "final_report": None,
            "next_agents": []
        }
        
        # We need to handle the fact that the graph will try to execute the tool
        # because of the conditional edge.
        # If we just want to test the agent step, we might want to stop after the first step.
        # But ainvoke runs until end.
        # So we should probably mock the tool execution or expect failure if tool doesn't exist.
        # Or we can just check that the agent produced the message with tool calls.
        # However, the graph will likely error if the tool doesn't exist in the ToolNode.
        
        # Let's add a dummy tool to the registry so ToolNode doesn't crash
        from langchain_core.tools import tool
        
        @tool
        def test_tool(arg: str):
            """Test tool."""
            return f"Executed {arg}"
            
        mock_components["tool_registry"].get_langchain_tools.return_value = [test_tool]
        
        # Rebuild graph with tool
        builder = GraphBuilder(
            llm=mock_llm,
            tool_registry=mock_components["tool_registry"],
            agent_loader=mock_components["agent_loader"],
            specialist_handler=mock_components["specialist_handler"],
            system_prompt="System prompt"
        )
        graph = builder.build()
        
        # We also need to mock the LLM for the SECOND call (after tool execution)
        # The agent loop goes: Agent -> Tool -> Agent -> End
        # So LLM will be called twice.
        # 1. Produces tool call
        # 2. Produces final answer based on tool result
        
        second_response = AIMessage(content="Tool executed successfully")
        mock_llm.ainvoke.side_effect = [expected_response, second_response]
        
        # Run graph
        result = await graph.ainvoke(initial_state)
        
        # Verify
        messages = result["messages"]
        # Expected: User -> Agent(ToolCall) -> Tool(Result) -> Agent(Final)
        assert len(messages) >= 4
        
        # Check tool call message
        tool_call_msg = messages[-3] # Assuming User is -4
        assert isinstance(tool_call_msg, AIMessage)
        assert len(tool_call_msg.tool_calls) == 1
        assert tool_call_msg.tool_calls[0]["name"] == "test_tool"
        
        # Check tool result message
        from langchain_core.messages import ToolMessage
        tool_result_msg = messages[-2]
        assert isinstance(tool_result_msg, ToolMessage)
        assert tool_result_msg.content == "Executed value"
        
        # Check final response
        final_msg = messages[-1]
        assert final_msg.content == "Tool executed successfully"


    @pytest.mark.asyncio
    async def test_agent_delegates_to_specialist(self, mock_llm, mock_components):
        """Test that agent can delegate to a specialist."""
        # Setup
        builder = GraphBuilder(
            llm=mock_llm,
            tool_registry=mock_components["tool_registry"],
            agent_loader=mock_components["agent_loader"],
            specialist_handler=mock_components["specialist_handler"],
            system_prompt="System prompt"
        )
        
        # Mock sub-agents in loader so delegation tool knows about them
        mock_components["agent_loader"].sub_agents = {
            "cardiologist": {"name": "Cardiologist", "role": "cardiologist"}
        }
        
        graph = builder.build()
        
        # Mock LLM response to call delegation tool
        tool_call = {
            "name": "delegate_to_specialist",
            "args": {"specialist_name": "cardiologist", "query": "Analyze ECG"},
            "id": "call_delegate"
        }
        expected_response = AIMessage(
            content="",
            tool_calls=[tool_call]
        )
        
        # Mock specialist handler response
        mock_specialist_response = AIMessage(content="ECG shows normal sinus rhythm")
        mock_components["specialist_handler"].consult_specialists.return_value = [mock_specialist_response]
        
        # Mock LLM response for the final step (after tool execution)
        final_response = AIMessage(content="The cardiologist says ECG is normal.")
        
        mock_llm.ainvoke.side_effect = [expected_response, final_response]
        
        # Input state
        initial_state = {
            "messages": [HumanMessage(content="Check heart")],
            "patient_profile": {},
            "steps_taken": 0,
            "final_report": None,
            "next_agents": []
        }
        
        # Run graph
        result = await graph.ainvoke(initial_state)
        
        # Verify specialist handler was called
        mock_components["specialist_handler"].consult_specialists.assert_called_once()
        call_kwargs = mock_components["specialist_handler"].consult_specialists.call_args[1]
        assert call_kwargs["specialists_needed"] == ["cardiologist"]
        assert call_kwargs["delegation_queries"] == {"cardiologist": "Analyze ECG"}
        
        # Verify final response
        messages = result["messages"]
        assert messages[-1].content == "The cardiologist says ECG is normal."
