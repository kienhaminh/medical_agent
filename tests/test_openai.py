"""Tests for OpenAI provider."""

import pytest
from unittest.mock import Mock, MagicMock, patch
from src.llm.openai import OpenAIProvider
from src.llm.provider import Message, LLMResponse


@pytest.fixture
def mock_chat_openai():
    """Mock ChatOpenAI class."""
    with patch("src.llm.openai.ChatOpenAI") as mock:
        yield mock


@pytest.fixture
def provider(mock_chat_openai):
    """Create provider with mocked ChatOpenAI."""
    # Setup mock LLM
    mock_llm = Mock()
    mock_llm.model_name = "gpt-4o-mini"
    mock_chat_openai.return_value = mock_llm

    provider = OpenAIProvider(
        api_key="test-key", model="gpt-4o-mini", temperature=0.7
    )
    return provider


class TestOpenAIProvider:
    """Test suite for OpenAI provider."""

    def test_initialization(self, mock_chat_openai):
        """Test provider initialization."""
        mock_llm = Mock()
        mock_llm.model_name = "gpt-4o-mini"
        mock_chat_openai.return_value = mock_llm

        provider = OpenAIProvider(
            api_key="test-api-key",
            model="gpt-4o-mini",
            max_tokens=2048,
            temperature=0.5,
        )

        # Verify ChatOpenAI was initialized with correct params
        mock_chat_openai.assert_called_once()
        call_kwargs = mock_chat_openai.call_args[1]
        assert call_kwargs["model"] == "gpt-4o-mini"
        assert call_kwargs["api_key"] == "test-api-key"
        assert call_kwargs["temperature"] == 0.5
        assert call_kwargs["max_tokens"] == 2048

    def test_bind_tools(self, provider):
        """Test binding tools."""
        tools = [Mock(), Mock()]
        mock_bound_llm = Mock()

        # Store original llm
        original_llm = provider.llm
        original_llm.bind_tools = Mock(return_value=mock_bound_llm)

        provider.bind_tools(tools)

        # Verify bind_tools was called on the original llm
        original_llm.bind_tools.assert_called_once_with(tools)
        # Verify the llm was replaced with the bound version
        assert provider.llm == mock_bound_llm

    def test_generate(self, provider):
        """Test generating response."""
        # Mock response
        mock_response = Mock()
        mock_response.content = "Test response"
        mock_response.usage_metadata = {
            "input_tokens": 10,
            "output_tokens": 20,
        }
        mock_response.tool_calls = None

        provider.llm.invoke = Mock(return_value=mock_response)

        messages = [Message(role="user", content="Hello")]
        response = provider.generate(messages)

        assert isinstance(response, LLMResponse)
        assert response.content == "Test response"
        assert response.model == "gpt-4o-mini"
        assert response.usage["input_tokens"] == 10
        assert response.usage["output_tokens"] == 20
        assert response.tool_calls is None

    def test_generate_with_tools(self, provider):
        """Test generating response with tool calls."""
        # Mock response with tool calls
        mock_response = Mock()
        mock_response.content = ""
        mock_response.usage_metadata = {
            "input_tokens": 15,
            "output_tokens": 25,
        }
        mock_response.tool_calls = [
            {
                "name": "get_weather",
                "args": {"location": "San Francisco"},
                "id": "call_123",
            }
        ]

        provider.llm.invoke = Mock(return_value=mock_response)

        messages = [Message(role="user", content="What's the weather?")]
        response = provider.generate(messages)

        assert response.tool_calls is not None
        assert len(response.tool_calls) == 1
        assert response.tool_calls[0]["name"] == "get_weather"
        assert response.tool_calls[0]["args"]["location"] == "San Francisco"
        assert response.tool_calls[0]["id"] == "call_123"

    def test_stream(self, provider):
        """Test streaming response."""
        # Mock streaming chunks
        chunk1 = Mock()
        chunk1.content = "Hello "
        chunk2 = Mock()
        chunk2.content = "world"
        chunk3 = Mock()
        chunk3.content = "!"

        provider.llm.stream = Mock(return_value=[chunk1, chunk2, chunk3])

        messages = [Message(role="user", content="Hello")]
        chunks = list(provider.stream(messages))

        assert chunks == ["Hello ", "world", "!"]

    def test_stream_empty_chunks(self, provider):
        """Test streaming with empty chunks."""
        # Mock chunks with some empty content
        chunk1 = Mock()
        chunk1.content = "Hello"
        chunk2 = Mock()
        chunk2.content = ""
        chunk3 = Mock()
        chunk3.content = "world"

        provider.llm.stream = Mock(return_value=[chunk1, chunk2, chunk3])

        messages = [Message(role="user", content="Hi")]
        chunks = list(provider.stream(messages))

        # Empty chunks should be filtered out
        assert chunks == ["Hello", "world"]

    def test_count_tokens(self, provider):
        """Test token counting."""
        provider.llm.get_num_tokens = Mock(return_value=42)

        count = provider.count_tokens("test text")

        assert count == 42
        provider.llm.get_num_tokens.assert_called_once_with("test text")

    def test_count_tokens_fallback(self, provider):
        """Test token counting fallback when method not available."""
        # Simulate get_num_tokens not being available
        provider.llm.get_num_tokens = Mock(
            side_effect=AttributeError("Method not available")
        )

        count = provider.count_tokens("1234567890")

        # Should fallback to ~4 chars per token estimate
        assert count == 2  # 10 chars // 4 = 2

    def test_message_conversion(self, provider):
        """Test message conversion to LangChain format."""
        messages = [
            Message(role="system", content="You are helpful"),
            Message(role="user", content="Hello"),
            Message(role="assistant", content="Hi there"),
            Message(role="tool", content="Result", tool_call_id="call_1"),
        ]

        # Mock invoke to capture converted messages
        def capture_messages(lc_messages, **kwargs):
            mock_response = Mock()
            mock_response.content = "Done"
            mock_response.usage_metadata = {}
            mock_response.tool_calls = None

            # Verify message types
            from langchain_core.messages import (
                SystemMessage,
                HumanMessage,
                AIMessage,
                ToolMessage,
            )

            assert isinstance(lc_messages[0], SystemMessage)
            assert lc_messages[0].content == "You are helpful"
            assert isinstance(lc_messages[1], HumanMessage)
            assert lc_messages[1].content == "Hello"
            assert isinstance(lc_messages[2], AIMessage)
            assert lc_messages[2].content == "Hi there"
            assert isinstance(lc_messages[3], ToolMessage)
            assert lc_messages[3].content == "Result"
            assert lc_messages[3].tool_call_id == "call_1"

            return mock_response

        provider.llm.invoke = Mock(side_effect=capture_messages)
        provider.generate(messages)

        provider.llm.invoke.assert_called_once()
