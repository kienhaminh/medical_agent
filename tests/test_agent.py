"""Tests for agent core."""

import pytest
from unittest.mock import Mock

from src.agent.core import Agent
from src.context.manager import ContextManager
from src.llm.provider import LLMResponse, Message
from src.utils.errors import AIAgentError


@pytest.fixture
def mock_llm_provider():
    """Create a mock LLM provider."""
    provider = Mock()
    provider.count_tokens = Mock(side_effect=lambda text: len(text) // 4)
    provider.generate = Mock(
        return_value=LLMResponse(
            content="Hello! I'm an AI assistant.",
            model="gemini-pro",
            usage={"input_tokens": 10, "output_tokens": 8},
        )
    )
    provider.stream = Mock(return_value=iter(["Hello", "!", " How", " can", " I", " help", "?"]))
    return provider


def test_agent_initialization(mock_llm_provider):
    """Test agent initialization."""
    agent = Agent(llm_provider=mock_llm_provider)

    assert agent.llm_provider == mock_llm_provider
    assert isinstance(agent.context, ContextManager)
    assert len(agent.context) == 0


def test_agent_with_system_prompt(mock_llm_provider):
    """Test agent with system prompt."""
    system_prompt = "You are a helpful assistant."
    agent = Agent(llm_provider=mock_llm_provider, system_prompt=system_prompt)

    # Should have system message in context
    assert len(agent.context) == 1
    messages = agent.context.get_messages()
    assert messages[0].role == "system"
    assert messages[0].content == system_prompt


def test_agent_process_message(mock_llm_provider):
    """Test processing a message."""
    agent = Agent(llm_provider=mock_llm_provider)

    response = agent.process_message("Hello")

    # Should add user message and assistant response to context
    assert len(agent.context) == 2

    messages = agent.context.get_messages()
    assert messages[0].role == "user"
    assert messages[0].content == "Hello"
    assert messages[1].role == "assistant"

    # Should return response content
    assert response == "Hello! I'm an AI assistant."

    # Should have called generate
    mock_llm_provider.generate.assert_called_once()


def test_agent_stream_message(mock_llm_provider):
    """Test streaming a message."""
    agent = Agent(llm_provider=mock_llm_provider)

    chunks = list(agent.process_message("Hello", stream=True))

    # Should return all chunks
    assert chunks == ["Hello", "!", " How", " can", " I", " help", "?"]

    # Should add messages to context
    assert len(agent.context) == 2

    # Should have called stream
    mock_llm_provider.stream.assert_called_once()


def test_agent_clear_context(mock_llm_provider):
    """Test clearing context."""
    system_prompt = "You are helpful."
    agent = Agent(llm_provider=mock_llm_provider, system_prompt=system_prompt)

    agent.process_message("Hello")
    assert len(agent.context) == 3  # system + user + assistant

    # Clear but keep system
    agent.clear_context(keep_system=True)
    assert len(agent.context) == 1

    messages = agent.context.get_messages()
    assert messages[0].role == "system"

    # Clear completely
    agent.clear_context(keep_system=False)
    assert len(agent.context) == 0


def test_agent_get_context_info(mock_llm_provider):
    """Test getting context info."""
    agent = Agent(llm_provider=mock_llm_provider)

    agent.process_message("Hello")

    info = agent.get_context_info()

    assert "message_count" in info
    assert "token_count" in info
    assert "last_message" in info
    assert info["message_count"] == 2


def test_agent_error_handling(mock_llm_provider):
    """Test error handling."""
    # Make provider raise an error
    mock_llm_provider.generate.side_effect = Exception("API error")

    agent = Agent(llm_provider=mock_llm_provider)

    with pytest.raises(AIAgentError, match="Failed to process message"):
        agent.process_message("Hello")


def test_agent_streaming_error_handling(mock_llm_provider):
    """Test error handling during streaming."""
    # Make stream raise an error
    mock_llm_provider.stream.side_effect = Exception("Streaming error")

    agent = Agent(llm_provider=mock_llm_provider)

    with pytest.raises(AIAgentError, match="Failed to stream response"):
        list(agent.process_message("Hello", stream=True))


def test_agent_repr(mock_llm_provider):
    """Test agent string representation."""
    agent = Agent(llm_provider=mock_llm_provider)
    agent.process_message("Hello")

    repr_str = repr(agent)

    assert "Agent" in repr_str
    assert "messages=" in repr_str
    assert "tokens" in repr_str
