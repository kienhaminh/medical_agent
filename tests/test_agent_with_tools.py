"""Integration tests for Agent with tool execution."""

import pytest
from unittest.mock import Mock, patch, MagicMock
from datetime import datetime
from zoneinfo import ZoneInfo

from src.agent.core import Agent
from src.llm.gemini import GeminiProvider
from src.llm.provider import LLMResponse, Message
from src.tools.registry import ToolRegistry
from src.tools.builtin.datetime_tool import get_current_datetime
from src.tools.builtin.location_tool import get_location
from src.tools.builtin.weather_tool import get_current_weather


@pytest.fixture
def registry():
    """Create fresh registry for each test."""
    reg = ToolRegistry()
    reg.reset()
    # Re-register builtin tools
    reg.register(get_current_datetime)
    reg.register(get_location)
    reg.register(get_current_weather)
    return reg


@pytest.fixture
def mock_llm_provider():
    """Create mock LLM provider."""
    provider = Mock(spec=GeminiProvider)
    provider.count_tokens = Mock(return_value=10)
    provider.bind_tools = Mock()
    return provider


@pytest.fixture
def agent(mock_llm_provider, registry):
    """Create agent with mock LLM provider."""
    return Agent(
        llm_provider=mock_llm_provider,
        system_prompt="You are a helpful assistant.",
        max_tool_iterations=5
    )


class TestAgentToolExecution:
    """Test suite for agent tool execution."""

    def test_agent_initializes_with_tools(self, agent):
        """Test that agent initializes tool system."""
        assert agent.tool_registry is not None
        assert agent.tool_executor is not None
        assert "get_current_datetime" in agent.tool_registry.list_tools()
        assert "get_location" in agent.tool_registry.list_tools()

    def test_agent_binds_tools_to_llm(self, mock_llm_provider):
        """Test that agent binds tools to LLM provider."""
        agent = Agent(
            llm_provider=mock_llm_provider,
            system_prompt="Test",
        )

        # Verify bind_tools was called
        mock_llm_provider.bind_tools.assert_called_once()

        # Verify tools were passed
        call_args = mock_llm_provider.bind_tools.call_args
        tools = call_args[0][0]  # First positional argument
        assert len(tools) >= 2  # At least datetime and location tools

    def test_agent_executes_single_tool_call(self, agent, mock_llm_provider):
        """Test agent executes single tool call and returns final response."""
        # First call: LLM requests tool
        tool_call_response = LLMResponse(
            content="",
            model="gemini",
            usage={"input_tokens": 10, "output_tokens": 5},
            stop_reason="tool_calls",
            tool_calls=[{
                "id": "call_1",
                "name": "get_current_datetime",
                "args": {"timezone": "UTC"}
            }]
        )

        # Second call: LLM uses tool result
        final_response = LLMResponse(
            content="The current time is 2:30 PM UTC.",
            model="gemini",
            usage={"input_tokens": 20, "output_tokens": 10},
            stop_reason="stop",
            tool_calls=None
        )

        mock_llm_provider.generate.side_effect = [tool_call_response, final_response]

        result = agent.process_message("What time is it?")

        assert result == "The current time is 2:30 PM UTC."
        assert mock_llm_provider.generate.call_count == 2

    def test_agent_handles_multiple_tool_calls(self, agent, mock_llm_provider):
        """Test agent handles multiple tool calls in one iteration."""
        # LLM requests two tools
        tool_call_response = LLMResponse(
            content="",
            model="gemini",
            usage={"input_tokens": 10, "output_tokens": 5},
            stop_reason="tool_calls",
            tool_calls=[
                {
                    "id": "call_1",
                    "name": "get_current_datetime",
                    "args": {"timezone": "UTC"}
                },
                {
                    "id": "call_2",
                    "name": "get_current_datetime",
                    "args": {"timezone": "Asia/Tokyo"}
                }
            ]
        )

        # Final response
        final_response = LLMResponse(
            content="UTC is 2:30 PM, Tokyo is 11:30 PM.",
            model="gemini",
            usage={"input_tokens": 30, "output_tokens": 15},
            stop_reason="stop"
        )

        mock_llm_provider.generate.side_effect = [tool_call_response, final_response]

        result = agent.process_message("What time is it in UTC and Tokyo?")

        assert "UTC" in result or "Tokyo" in result
        assert mock_llm_provider.generate.call_count == 2

    def test_agent_enforces_iteration_limit(self, agent, mock_llm_provider):
        """Test agent stops after max iterations."""
        # Always return tool calls (infinite loop simulation)
        tool_call_response = LLMResponse(
            content="",
            model="gemini",
            usage={"input_tokens": 10, "output_tokens": 5},
            stop_reason="tool_calls",
            tool_calls=[{
                "id": "call_1",
                "name": "get_current_datetime",
                "args": {"timezone": "UTC"}
            }]
        )

        mock_llm_provider.generate.return_value = tool_call_response

        result = agent.process_message("Test infinite loop")

        assert "exceeded" in result.lower() or "maximum" in result.lower()
        assert mock_llm_provider.generate.call_count == 5  # max_tool_iterations

    def test_agent_handles_tool_execution_error(self, agent, mock_llm_provider):
        """Test agent handles tool execution errors gracefully."""
        # Request invalid tool
        tool_call_response = LLMResponse(
            content="",
            model="gemini",
            usage={"input_tokens": 10, "output_tokens": 5},
            stop_reason="tool_calls",
            tool_calls=[{
                "id": "call_1",
                "name": "nonexistent_tool",
                "args": {}
            }]
        )

        # LLM receives error message
        final_response = LLMResponse(
            content="I apologize, I encountered an error.",
            model="gemini",
            usage={"input_tokens": 20, "output_tokens": 10},
            stop_reason="stop"
        )

        mock_llm_provider.generate.side_effect = [tool_call_response, final_response]

        result = agent.process_message("Test error handling")

        # Should complete without raising exception
        assert isinstance(result, str)
        assert mock_llm_provider.generate.call_count == 2

    def test_agent_adds_tool_results_to_context(self, agent, mock_llm_provider):
        """Test that tool results are added to context."""
        tool_call_response = LLMResponse(
            content="",
            model="gemini",
            usage={"input_tokens": 10, "output_tokens": 5},
            stop_reason="tool_calls",
            tool_calls=[{
                "id": "call_1",
                "name": "get_current_datetime",
                "args": {"timezone": "UTC"}
            }]
        )

        final_response = LLMResponse(
            content="The time is 2:30 PM.",
            model="gemini",
            usage={"input_tokens": 20, "output_tokens": 10},
            stop_reason="stop"
        )

        mock_llm_provider.generate.side_effect = [tool_call_response, final_response]

        agent.process_message("What time is it?")

        # Check context contains tool message
        messages = agent.context.get_messages()
        tool_messages = [m for m in messages if m.role == "tool"]

        assert len(tool_messages) >= 1
        assert tool_messages[0].tool_call_id == "call_1"

    def test_agent_without_tool_calls(self, agent, mock_llm_provider):
        """Test agent works normally without tool calls."""
        # Regular response without tools
        response = LLMResponse(
            content="Hello! How can I help you today?",
            model="gemini",
            usage={"input_tokens": 10, "output_tokens": 8},
            stop_reason="stop",
            tool_calls=None
        )

        mock_llm_provider.generate.return_value = response

        result = agent.process_message("Hello")

        assert result == "Hello! How can I help you today?"
        assert mock_llm_provider.generate.call_count == 1


class TestAgentToolIntegration:
    """Integration tests with real tools."""

    def test_agent_with_real_datetime_tool(self, mock_llm_provider, registry):
        """Test agent with real datetime tool execution."""
        agent = Agent(
            llm_provider=mock_llm_provider,
            max_tool_iterations=3
        )

        # Simulate LLM requesting datetime tool
        tool_call_response = LLMResponse(
            content="",
            model="gemini",
            usage={"input_tokens": 10, "output_tokens": 5},
            stop_reason="tool_calls",
            tool_calls=[{
                "id": "call_1",
                "name": "get_current_datetime",
                "args": {"timezone": "UTC"}
            }]
        )

        # Final response uses actual tool result
        def final_response_generator(messages):
            # Extract tool result from messages
            tool_msg = next((m for m in messages if m.role == "tool"), None)
            if tool_msg:
                return LLMResponse(
                    content=f"According to the tool: {tool_msg.content}",
                    model="gemini",
                    usage={"input_tokens": 20, "output_tokens": 15},
                    stop_reason="stop"
                )
            return LLMResponse(
                content="No tool result found",
                model="gemini",
                usage={"input_tokens": 10, "output_tokens": 5},
                stop_reason="stop"
            )

        mock_llm_provider.generate.side_effect = [
            tool_call_response,
            final_response_generator(agent.context.get_messages())
        ]

        # Note: We can't easily test the actual tool result without mocking datetime,
        # but we can verify the tool was executed
        result = agent.process_message("What time is it in UTC?")

        # Verify tool was executed
        messages = agent.context.get_messages()
        tool_messages = [m for m in messages if m.role == "tool"]
        assert len(tool_messages) == 1
        assert "UTC" in tool_messages[0].content or "Current time" in tool_messages[0].content

    @patch('src.tools.builtin.location_tool._get_location_from_ipapi')
    def test_agent_with_mocked_location_tool(self, mock_ipapi, mock_llm_provider, registry):
        """Test agent with mocked location tool."""
        # Mock location API response
        mock_ipapi.return_value = {
            "ip": "8.8.8.8",
            "city": "Mountain View",
            "country": "United States",
            "latitude": 37.4056,
            "longitude": -122.0775,
            "timezone": "America/Los_Angeles"
        }

        agent = Agent(
            llm_provider=mock_llm_provider,
            max_tool_iterations=3
        )

        # Simulate LLM requesting location tool
        tool_call_response = LLMResponse(
            content="",
            model="gemini",
            usage={"input_tokens": 10, "output_tokens": 5},
            stop_reason="tool_calls",
            tool_calls=[{
                "id": "call_1",
                "name": "get_location",
                "args": {"ip_address": "8.8.8.8"}
            }]
        )

        final_response = LLMResponse(
            content="The location is Mountain View, California.",
            model="gemini",
            usage={"input_tokens": 25, "output_tokens": 10},
            stop_reason="stop"
        )

        mock_llm_provider.generate.side_effect = [tool_call_response, final_response]

        result = agent.process_message("Where is IP 8.8.8.8?")

        # Verify tool was executed
        messages = agent.context.get_messages()
        tool_messages = [m for m in messages if m.role == "tool"]
        assert len(tool_messages) == 1
        assert "Mountain View" in tool_messages[0].content
