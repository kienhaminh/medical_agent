"""End-to-end test for LangGraph agent with OpenAI."""

import os
import pytest
from unittest.mock import Mock, patch, MagicMock
from langchain_core.messages import AIMessage

from src.agent.langgraph_agent import LangGraphAgent
from src.llm.openai import OpenAIProvider
from src.tools.registry import ToolRegistry


class TestLangGraphEndToEnd:
    """Test LangGraph agent end-to-end with OpenAI provider."""

    def test_create_openai_provider_with_tools(self):
        """Test creating OpenAI provider and binding tools."""
        # Mock the OpenAI API
        with patch("src.llm.openai.ChatOpenAI") as mock_chat_openai:
            mock_llm = Mock()
            mock_llm.bind_tools = Mock(return_value=mock_llm)
            mock_chat_openai.return_value = mock_llm

            # Create provider
            provider = OpenAIProvider(api_key="test-key")

            # Get tools from registry
            registry = ToolRegistry()
            langchain_tools = registry.get_langchain_tools()

            # Bind tools
            provider.bind_tools(langchain_tools)

            # Verify tools were bound
            assert mock_llm.bind_tools.called
            assert provider.llm == mock_llm

    def test_langgraph_agent_with_openai_provider(self):
        """Test LangGraph agent with OpenAI provider."""
        # Mock OpenAI LLM
        mock_llm = Mock()
        mock_llm.tools = []
        mock_llm.invoke = Mock(return_value=AIMessage(content="Hello! How can I help?"))

        # Create LangGraph agent
        agent = LangGraphAgent(llm_with_tools=mock_llm)

        # Process message
        response = agent.process_message("Hi", stream=False)

        # Verify response
        assert response == "Hello! How can I help?"
        assert mock_llm.invoke.called

    def test_langgraph_agent_with_tools_bound(self):
        """Test LangGraph agent with tools properly bound."""
        # Mock OpenAI provider with tools
        with patch("src.llm.openai.ChatOpenAI") as mock_chat_openai:
            mock_llm = Mock()
            mock_llm.tools = []  # Empty tools list for testing
            mock_llm.bind_tools = Mock(return_value=mock_llm)
            mock_llm.invoke = Mock(return_value=AIMessage(content="Test response"))
            mock_chat_openai.return_value = mock_llm

            # Create provider
            provider = OpenAIProvider(api_key="test-key")

            # Get and bind tools
            registry = ToolRegistry()
            langchain_tools = registry.get_langchain_tools()
            provider.bind_tools(langchain_tools)

            # Create agent with bound LLM
            agent = LangGraphAgent(llm_with_tools=provider.llm)

            # Process message
            response = agent.process_message("What time is it?", stream=False)

            # Verify
            assert response == "Test response"
            assert mock_llm.invoke.called

    def test_full_integration_with_mocked_openai(self):
        """Test full integration with mocked OpenAI API."""
        with patch("src.llm.openai.ChatOpenAI") as mock_chat_openai:
            # Setup mock
            mock_llm = Mock()
            mock_llm.tools = []
            mock_llm.bind_tools = Mock(return_value=mock_llm)
            mock_llm.invoke = Mock(
                return_value=AIMessage(content="The weather is sunny and 72°F")
            )
            mock_chat_openai.return_value = mock_llm

            # Create full stack
            provider = OpenAIProvider(api_key="test-key", model="gpt-4o-mini")

            # Bind tools
            registry = ToolRegistry()
            tools = registry.get_langchain_tools()
            provider.bind_tools(tools)

            # Create agent
            agent = LangGraphAgent(
                llm_with_tools=provider.llm,
                system_prompt="You are a helpful assistant.",
                user_id="test_user",
            )

            # Test message processing
            response = agent.process_message("What's the weather?", stream=False)

            # Verify
            assert "weather" in response.lower() or "sunny" in response.lower()
            assert mock_llm.invoke.called

    def test_streaming_with_langgraph(self):
        """Test streaming response with LangGraph agent."""
        mock_llm = Mock()
        mock_llm.tools = []

        agent = LangGraphAgent(llm_with_tools=mock_llm)

        # Mock the graph stream
        mock_chunks = [
            {"messages": [AIMessage(content="Hello")]},
            {"messages": [AIMessage(content=" world")]},
        ]
        agent.graph.stream = Mock(return_value=iter(mock_chunks))

        # Test streaming
        chunks = list(agent.process_message("Test", stream=True))

        assert len(chunks) == 2
        assert chunks[0] == "Hello"
        assert chunks[1] == " world"

    def test_agent_with_memory(self):
        """Test LangGraph agent with memory manager."""
        mock_llm = Mock()
        mock_llm.tools = []
        mock_llm.invoke = Mock(return_value=AIMessage(content="I remember that"))

        mock_memory = Mock()
        mock_memory.search_memories = Mock(return_value=["Previous conversation"])
        mock_memory.add_conversation = Mock()

        agent = LangGraphAgent(
            llm_with_tools=mock_llm,
            memory_manager=mock_memory,
            user_id="test_user",
        )

        response = agent.process_message("Recall our conversation", stream=False)

        # Verify memory was used
        assert mock_memory.search_memories.called
        assert mock_memory.add_conversation.called
        assert response == "I remember that"


class TestFeatureFlagIntegration:
    """Test feature flag integration in API server."""

    def test_use_langgraph_flag_true(self):
        """Test that USE_LANGGRAPH=true creates LangGraph agent."""
        with patch.dict(os.environ, {"USE_LANGGRAPH": "true", "OPENAI_API_KEY": "test-key"}):
            # Import after setting env var
            import importlib
            import src.api.server

            importlib.reload(src.api.server)

            # Verify flag is set
            assert src.api.server.USE_LANGGRAPH is True

    def test_use_langgraph_flag_false(self):
        """Test that USE_LANGGRAPH=false creates legacy Agent."""
        with patch.dict(
            os.environ, {"USE_LANGGRAPH": "false", "GOOGLE_API_KEY": "test-key"}
        ):
            # Import after setting env var
            import importlib
            import src.api.server

            importlib.reload(src.api.server)

            # Verify flag is set
            assert src.api.server.USE_LANGGRAPH is False

    def test_use_langgraph_default_false(self):
        """Test that USE_LANGGRAPH defaults to false."""
        env_vars = os.environ.copy()
        # Remove USE_LANGGRAPH if it exists
        if "USE_LANGGRAPH" in env_vars:
            del env_vars["USE_LANGGRAPH"]

        with patch.dict(os.environ, env_vars, clear=True):
            # Ensure required keys exist
            os.environ["GOOGLE_API_KEY"] = "test-key"

            # Import after setting env var
            import importlib
            import src.api.server

            importlib.reload(src.api.server)

            # Default should be False
            assert src.api.server.USE_LANGGRAPH is False
