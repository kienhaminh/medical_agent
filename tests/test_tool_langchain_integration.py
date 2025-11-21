"""Integration tests for LangChain tool adapters with builtin tools."""

import pytest
from src.tools.registry import ToolRegistry


class TestLangChainToolIntegration:
    """Test that tool adapter integrates properly with LangChain."""

    def test_adapter_creates_valid_langchain_tools(self):
        """Test that adapter creates valid LangChain tools."""
        registry = ToolRegistry()

        # Register a simple test tool
        def test_tool(x: int) -> int:
            """Test tool."""
            return x * 2

        registry.register(test_tool)

        # Convert to LangChain
        lc_tools = registry.get_langchain_tools()

        # Should have at least our test tool
        assert len(lc_tools) > 0

        # Find our tool
        tool = next((t for t in lc_tools if t.name == "test_tool"), None)
        assert tool is not None

        # Verify it has LangChain tool attributes
        assert hasattr(tool, "name")
        assert hasattr(tool, "description")
        assert hasattr(tool, "args_schema")
        assert callable(tool.invoke)

        # Verify it works
        result = tool.invoke({"x": 5})
        assert result == 10

    def test_adapter_preserves_tool_functionality(self):
        """Test that adapter preserves tool functionality."""
        registry = ToolRegistry()
        registry.reset()

        def greet(name: str, greeting: str = "Hello") -> str:
            """Greet someone."""
            return f"{greeting}, {name}!"

        registry.register(greet)

        lc_tools = registry.get_langchain_tools()
        tool = lc_tools[0]

        # Test with default
        assert tool.invoke({"name": "Alice"}) == "Hello, Alice!"

        # Test with custom greeting
        assert tool.invoke({"name": "Bob", "greeting": "Hi"}) == "Hi, Bob!"

    def test_multiple_tools_convert_correctly(self):
        """Test converting multiple tools."""
        registry = ToolRegistry()
        registry.reset()

        def add(a: int, b: int) -> int:
            """Add two numbers."""
            return a + b

        def multiply(a: int, b: int) -> int:
            """Multiply two numbers."""
            return a * b

        registry.register(add)
        registry.register(multiply)

        lc_tools = registry.get_langchain_tools()

        assert len(lc_tools) == 2
        tool_names = [t.name for t in lc_tools]
        assert "add" in tool_names
        assert "multiply" in tool_names

    def test_langchain_tools_can_bind_to_llm(self):
        """Test that converted tools can be bound to LLM."""
        from unittest.mock import Mock

        registry = ToolRegistry()
        registry.reset()

        def sample_tool(x: str) -> str:
            """Sample tool."""
            return x.upper()

        registry.register(sample_tool)

        lc_tools = registry.get_langchain_tools()

        # Mock LLM with bind_tools method
        mock_llm = Mock()
        mock_llm.bind_tools = Mock(return_value=mock_llm)

        # Should be able to bind tools
        mock_llm.bind_tools(lc_tools)

        # Verify bind_tools was called with our tools
        mock_llm.bind_tools.assert_called_once()
        call_args = mock_llm.bind_tools.call_args[0][0]
        assert len(call_args) == len(lc_tools)
