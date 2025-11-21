"""Tests for Gemini provider."""

import pytest
from unittest.mock import Mock, MagicMock, patch
from src.llm.gemini import GeminiProvider
from src.llm.provider import Message, LLMResponse


@pytest.fixture
def mock_genai():
    """Mock google.generativeai module."""
    with patch('src.llm.gemini.genai') as mock:
        yield mock


@pytest.fixture
def provider(mock_genai):
    """Create provider with mocked genai."""
    return GeminiProvider(
        api_key="test-key",
        model="gemini-pro",
        max_tokens=4096,
        temperature=0.7
    )


class TestGeminiProvider:
    """Test suite for Gemini provider."""

    def test_initialization(self, mock_genai):
        """Test provider initialization."""
        provider = GeminiProvider(
            api_key="test-api-key",
            model="gemini-pro",
            max_tokens=2048,
            temperature=0.5
        )

        mock_genai.configure.assert_called_once_with(api_key="test-api-key")
        assert provider.model_name == "gemini-pro"
        assert provider.max_tokens == 2048
        assert provider.temperature == 0.5

    def test_bind_tools(self, provider):
        """Test binding tools."""
        tools = [Mock()]
        provider.bind_tools(tools)
        assert provider._tools == tools

    def test_convert_messages(self, provider):
        """Test converting messages to Gemini format."""
        messages = [
            Message(role="system", content="System prompt"),
            Message(role="user", content="User msg"),
            Message(role="assistant", content="Assistant msg"),
            Message(role="tool", content="Tool result", tool_call_id="call_1")
        ]
        
        gemini_msgs = provider._convert_messages(messages)
        
        # System message converted to user message
        assert gemini_msgs[0]["role"] == "user"
        assert gemini_msgs[0]["parts"] == ["System prompt"]
        
        # User message
        assert gemini_msgs[1]["role"] == "user"
        assert gemini_msgs[1]["parts"] == ["User msg"]
        
        # Assistant message
        assert gemini_msgs[2]["role"] == "model"
        assert gemini_msgs[2]["parts"] == ["Assistant msg"]
        
        # Tool message
        assert gemini_msgs[3]["role"] == "user"
        assert "Tool Output (call_1): Tool result" in gemini_msgs[3]["parts"][0]

    def test_generate(self, provider, mock_genai):
        """Test generating response."""
        # Mock model and chat
        mock_model = Mock()
        mock_chat = Mock()
        mock_response = Mock()
        
        mock_genai.GenerativeModel.return_value = mock_model
        mock_model.start_chat.return_value = mock_chat
        mock_chat.send_message.return_value = mock_response
        
        # Setup response
        mock_part = Mock()
        mock_part.text = "Test response"
        mock_part.function_call = None
        mock_response.parts = [mock_part]
        mock_response.usage_metadata.prompt_token_count = 10
        mock_response.usage_metadata.candidates_token_count = 20
        
        messages = [Message(role="user", content="Hello")]
        response = provider.generate(messages)
        
        assert isinstance(response, LLMResponse)
        assert response.content == "Test response"
        assert response.usage["input_tokens"] == 10
        assert response.usage["output_tokens"] == 20
        assert response.tool_calls is None

    def test_generate_with_tools(self, provider, mock_genai):
        """Test generating response with tool calls."""
        # Mock model and chat
        mock_model = Mock()
        mock_chat = Mock()
        mock_response = Mock()
        
        mock_genai.GenerativeModel.return_value = mock_model
        mock_model.start_chat.return_value = mock_chat
        mock_chat.send_message.return_value = mock_response
        
        # Setup response with function call
        mock_part = Mock()
        mock_part.text = ""
        mock_part.function_call.name = "test_tool"
        mock_part.function_call.args = {"arg": "value"}
        
        mock_response.parts = [mock_part]
        
        messages = [Message(role="user", content="Use tool")]
        response = provider.generate(messages)
        
        assert response.tool_calls is not None
        assert len(response.tool_calls) == 1
        assert response.tool_calls[0]["name"] == "test_tool"
        assert response.tool_calls[0]["args"] == {"arg": "value"}

    def test_stream(self, provider, mock_genai):
        """Test streaming response."""
        # Mock model and chat
        mock_model = Mock()
        mock_chat = Mock()
        
        mock_genai.GenerativeModel.return_value = mock_model
        mock_model.start_chat.return_value = mock_chat
        
        # Setup streaming response
        chunk1 = Mock()
        chunk1.text = "Hello "
        chunk2 = Mock()
        chunk2.text = "world"
        
        mock_chat.send_message.return_value = [chunk1, chunk2]
        
        messages = [Message(role="user", content="Hello")]
        chunks = list(provider.stream(messages))
        
        assert chunks == ["Hello ", "world"]

    def test_count_tokens(self, provider, mock_genai):
        """Test token counting."""
        mock_model = Mock()
        mock_genai.GenerativeModel.return_value = mock_model
        mock_model.count_tokens.return_value.total_tokens = 15
        
        count = provider.count_tokens("test text")
        
        assert count == 15
        mock_model.count_tokens.assert_called_once_with("test text")
