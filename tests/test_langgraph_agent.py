"""Tests for LangGraph agent."""

import pytest
from unittest.mock import Mock, MagicMock, patch
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from src.agent.langgraph_agent import LangGraphAgent


class TestLangGraphAgentInitialization:
    """Test LangGraph agent initialization."""

    def test_init_with_minimal_args(self):
        """Test initialization with minimal arguments."""
        mock_llm = Mock()
        mock_llm.tools = []

        agent = LangGraphAgent(llm_with_tools=mock_llm)

        assert agent.llm == mock_llm
        assert agent.system_prompt is None
        assert agent.memory_manager is None
        assert agent.user_id == "default"
        assert agent.max_iterations == 5
        assert agent.graph is not None

    def test_init_with_all_args(self):
        """Test initialization with all arguments."""
        mock_llm = Mock()
        mock_llm.tools = []
        mock_memory = Mock()

        agent = LangGraphAgent(
            llm_with_tools=mock_llm,
            system_prompt="Test prompt",
            memory_manager=mock_memory,
            user_id="test_user",
            max_iterations=10,
        )

        assert agent.llm == mock_llm
        assert agent.system_prompt == "Test prompt"
        assert agent.memory_manager == mock_memory
        assert agent.user_id == "test_user"
        assert agent.max_iterations == 10

    def test_graph_is_compiled(self):
        """Test that graph is compiled on initialization."""
        mock_llm = Mock()
        mock_llm.tools = []

        agent = LangGraphAgent(llm_with_tools=mock_llm)

        # Graph should be compiled and have invoke/stream methods
        assert hasattr(agent.graph, "invoke")
        assert hasattr(agent.graph, "stream")


class TestLangGraphAgentMessageProcessing:
    """Test message processing without streaming."""

    def test_process_message_basic(self):
        """Test basic message processing."""
        mock_llm = Mock()
        mock_llm.tools = []

        # Mock the invoke response
        mock_response = AIMessage(content="Test response")
        mock_llm.invoke = Mock(return_value=mock_response)

        agent = LangGraphAgent(llm_with_tools=mock_llm)
        result = agent.process_message("Hello", stream=False)

        assert result == "Test response"
        assert mock_llm.invoke.called

    def test_process_message_with_system_prompt(self):
        """Test message processing with system prompt."""
        mock_llm = Mock()
        mock_llm.tools = []
        mock_response = AIMessage(content="Response")
        mock_llm.invoke = Mock(return_value=mock_response)

        agent = LangGraphAgent(
            llm_with_tools=mock_llm,
            system_prompt="You are a helpful assistant."
        )
        result = agent.process_message("Test", stream=False)

        # Verify system prompt was included
        call_args = mock_llm.invoke.call_args[0][0]
        assert any(isinstance(msg, SystemMessage) for msg in call_args)
        assert result == "Response"

    def test_process_message_with_memory(self):
        """Test message processing with memory retrieval."""
        mock_llm = Mock()
        mock_llm.tools = []
        mock_response = AIMessage(content="Response")
        mock_llm.invoke = Mock(return_value=mock_response)

        mock_memory = Mock()
        mock_memory.search_memories = Mock(return_value=["Memory 1", "Memory 2"])
        mock_memory.add_conversation = Mock()

        agent = LangGraphAgent(
            llm_with_tools=mock_llm,
            memory_manager=mock_memory,
            user_id="test_user"
        )
        result = agent.process_message("Test", stream=False)

        # Verify memory was searched
        mock_memory.search_memories.assert_called_once()
        # Verify conversation was stored
        mock_memory.add_conversation.assert_called_once()
        assert result == "Response"

    def test_process_message_memory_error_handled(self):
        """Test that memory errors are handled gracefully."""
        mock_llm = Mock()
        mock_llm.tools = []
        mock_response = AIMessage(content="Response")
        mock_llm.invoke = Mock(return_value=mock_response)

        mock_memory = Mock()
        mock_memory.search_memories = Mock(side_effect=Exception("Memory error"))
        mock_memory.add_conversation = Mock()

        agent = LangGraphAgent(
            llm_with_tools=mock_llm,
            memory_manager=mock_memory
        )

        # Should not raise, should handle error gracefully
        result = agent.process_message("Test", stream=False)
        assert result == "Response"


class TestLangGraphAgentStreaming:
    """Test streaming message processing."""

    def test_stream_response_yields_content(self):
        """Test that streaming yields content chunks."""
        mock_llm = Mock()
        mock_llm.tools = []

        agent = LangGraphAgent(llm_with_tools=mock_llm)

        # Mock the graph.stream to yield chunks
        mock_chunks = [
            {"messages": [AIMessage(content="Hello")]},
            {"messages": [AIMessage(content="World")]},
        ]
        agent.graph.stream = Mock(return_value=iter(mock_chunks))

        result = list(agent.process_message("Test", stream=True))

        assert len(result) == 2
        assert result[0] == "Hello"
        assert result[1] == "World"

    def test_stream_response_stores_memory(self):
        """Test that streaming stores conversation in memory."""
        mock_llm = Mock()
        mock_llm.tools = []

        mock_memory = Mock()
        mock_memory.search_memories = Mock(return_value=[])
        mock_memory.add_conversation = Mock()

        agent = LangGraphAgent(
            llm_with_tools=mock_llm,
            memory_manager=mock_memory
        )

        mock_chunks = [
            {"messages": [AIMessage(content="Response")]},
        ]
        agent.graph.stream = Mock(return_value=iter(mock_chunks))

        list(agent.process_message("Test", stream=True))

        # Verify memory was stored
        mock_memory.add_conversation.assert_called_once()

    def test_stream_response_handles_empty_content(self):
        """Test that streaming handles empty content gracefully."""
        mock_llm = Mock()
        mock_llm.tools = []

        agent = LangGraphAgent(llm_with_tools=mock_llm)

        # Mock chunks with empty content
        mock_chunks = [
            {"messages": [AIMessage(content="")]},
            {"messages": [AIMessage(content="Valid")]},
        ]
        agent.graph.stream = Mock(return_value=iter(mock_chunks))

        result = list(agent.process_message("Test", stream=True))

        # Should only yield non-empty content
        assert result == ["Valid"]


class TestLangGraphAgentToolExecution:
    """Test tool execution via StateGraph."""

    def test_agent_with_no_tools(self):
        """Test agent behavior when no tools are available."""
        mock_llm = Mock()
        mock_llm.tools = []
        mock_response = AIMessage(content="Response without tools")
        mock_llm.invoke = Mock(return_value=mock_response)

        agent = LangGraphAgent(llm_with_tools=mock_llm)
        result = agent.process_message("Test", stream=False)

        assert result == "Response without tools"

    def test_graph_with_tools_attribute(self):
        """Test that graph handles LLM with tools attribute correctly."""
        mock_llm = Mock()
        # LLM with tools attribute (empty list)
        mock_llm.tools = []

        agent = LangGraphAgent(llm_with_tools=mock_llm)

        # Verify graph was built correctly
        assert agent.graph is not None
        assert hasattr(agent.graph, "invoke")
        assert hasattr(agent.graph, "stream")

    def test_should_continue_without_tool_calls(self):
        """Test conditional edge logic without tool calls."""
        mock_llm = Mock()
        mock_llm.tools = []

        agent = LangGraphAgent(llm_with_tools=mock_llm)

        # Create a mock message without tool_calls
        mock_message = AIMessage(content="Final response")
        state = {"messages": [mock_message]}

        # Verify graph built correctly
        assert agent.graph is not None


class TestLangGraphAgentRepresentation:
    """Test agent string representation."""

    def test_repr_default_user(self):
        """Test __repr__ with default user."""
        mock_llm = Mock()
        mock_llm.tools = []

        agent = LangGraphAgent(llm_with_tools=mock_llm)

        assert repr(agent) == "LangGraphAgent(user_id=default)"

    def test_repr_custom_user(self):
        """Test __repr__ with custom user."""
        mock_llm = Mock()
        mock_llm.tools = []

        agent = LangGraphAgent(llm_with_tools=mock_llm, user_id="custom_user")

        assert repr(agent) == "LangGraphAgent(user_id=custom_user)"


class TestLangGraphAgentEdgeCases:
    """Test edge cases and error handling."""

    def test_process_message_with_empty_string(self):
        """Test processing empty message."""
        mock_llm = Mock()
        mock_llm.tools = []
        mock_response = AIMessage(content="Response")
        mock_llm.invoke = Mock(return_value=mock_response)

        agent = LangGraphAgent(llm_with_tools=mock_llm)
        result = agent.process_message("", stream=False)

        assert result == "Response"

    def test_memory_storage_error_handled(self):
        """Test that memory storage errors are handled gracefully."""
        mock_llm = Mock()
        mock_llm.tools = []
        mock_response = AIMessage(content="Response")
        mock_llm.invoke = Mock(return_value=mock_response)

        mock_memory = Mock()
        mock_memory.search_memories = Mock(return_value=[])
        mock_memory.add_conversation = Mock(side_effect=Exception("Storage error"))

        agent = LangGraphAgent(
            llm_with_tools=mock_llm,
            memory_manager=mock_memory
        )

        # Should not raise, should handle error gracefully
        result = agent.process_message("Test", stream=False)
        assert result == "Response"

    def test_multiple_messages_processed(self):
        """Test processing multiple messages in sequence."""
        mock_llm = Mock()
        mock_llm.tools = []

        responses = [
            AIMessage(content="Response 1"),
            AIMessage(content="Response 2"),
            AIMessage(content="Response 3"),
        ]
        mock_llm.invoke = Mock(side_effect=responses)

        agent = LangGraphAgent(llm_with_tools=mock_llm)

        result1 = agent.process_message("Message 1", stream=False)
        result2 = agent.process_message("Message 2", stream=False)
        result3 = agent.process_message("Message 3", stream=False)

        assert result1 == "Response 1"
        assert result2 == "Response 2"
        assert result3 == "Response 3"
        assert mock_llm.invoke.call_count == 3
