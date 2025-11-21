"""Tests for tool adapters."""

import pytest
from unittest.mock import Mock
from src.tools.adapters import convert_to_langchain_tool, get_langchain_tools_from_registry
from src.tools.registry import ToolRegistry


def sample_tool(arg1: str, arg2: int = 5) -> str:
    """Sample tool for testing.

    Args:
        arg1: First argument
        arg2: Second argument with default

    Returns:
        Formatted string
    """
    return f"Result: {arg1}, {arg2}"


class TestConvertToLangChainTool:
    """Test suite for tool conversion."""

    def test_convert_preserves_function_name(self):
        """Test that conversion preserves function name."""
        lc_tool = convert_to_langchain_tool(sample_tool)

        assert lc_tool.name == "sample_tool"

    def test_convert_preserves_docstring(self):
        """Test that conversion preserves docstring."""
        lc_tool = convert_to_langchain_tool(sample_tool)

        assert "Sample tool for testing" in lc_tool.description

    def test_convert_creates_schema(self):
        """Test that conversion creates argument schema."""
        lc_tool = convert_to_langchain_tool(sample_tool)

        # LangChain tools have args_schema attribute
        assert hasattr(lc_tool, "args_schema")

    def test_converted_tool_is_callable(self):
        """Test that converted tool can be called."""
        lc_tool = convert_to_langchain_tool(sample_tool)

        result = lc_tool.invoke({"arg1": "test", "arg2": 10})

        assert result == "Result: test, 10"

    def test_converted_tool_uses_defaults(self):
        """Test that converted tool uses default arguments."""
        lc_tool = convert_to_langchain_tool(sample_tool)

        result = lc_tool.invoke({"arg1": "test"})

        assert result == "Result: test, 5"

    def test_convert_multiple_tools(self):
        """Test converting multiple different tools."""

        def tool1(x: int) -> int:
            """Tool 1."""
            return x * 2

        def tool2(y: str) -> str:
            """Tool 2."""
            return y.upper()

        lc_tool1 = convert_to_langchain_tool(tool1)
        lc_tool2 = convert_to_langchain_tool(tool2)

        assert lc_tool1.name == "tool1"
        assert lc_tool2.name == "tool2"
        assert lc_tool1.invoke({"x": 5}) == 10
        assert lc_tool2.invoke({"y": "hello"}) == "HELLO"


class TestGetLangChainToolsFromRegistry:
    """Test suite for registry conversion."""

    def test_convert_empty_registry(self):
        """Test converting empty registry."""
        registry = ToolRegistry()
        registry.reset()

        lc_tools = get_langchain_tools_from_registry(registry)

        assert lc_tools == []

    def test_convert_registry_with_tools(self):
        """Test converting registry with registered tools."""
        registry = ToolRegistry()
        registry.reset()

        def tool_a(x: int) -> int:
            """Tool A."""
            return x + 1

        def tool_b(y: str) -> str:
            """Tool B."""
            return y * 2

        registry.register(tool_a)
        registry.register(tool_b)

        lc_tools = get_langchain_tools_from_registry(registry)

        assert len(lc_tools) == 2
        tool_names = [t.name for t in lc_tools]
        assert "tool_a" in tool_names
        assert "tool_b" in tool_names

    def test_converted_tools_are_usable(self):
        """Test that converted tools from registry are usable."""
        registry = ToolRegistry()
        registry.reset()

        def multiply(a: int, b: int) -> int:
            """Multiply two numbers."""
            return a * b

        registry.register(multiply)

        lc_tools = get_langchain_tools_from_registry(registry)

        assert len(lc_tools) == 1
        result = lc_tools[0].invoke({"a": 3, "b": 4})
        assert result == 12


class TestToolRegistryIntegration:
    """Test ToolRegistry.get_langchain_tools() method."""

    def test_get_langchain_tools_empty(self):
        """Test get_langchain_tools on empty registry."""
        registry = ToolRegistry()
        registry.reset()

        lc_tools = registry.get_langchain_tools()

        assert lc_tools == []

    def test_get_langchain_tools_with_tools(self):
        """Test get_langchain_tools with registered tools."""
        registry = ToolRegistry()
        registry.reset()

        def add(x: int, y: int) -> int:
            """Add two numbers."""
            return x + y

        def subtract(x: int, y: int) -> int:
            """Subtract y from x."""
            return x - y

        registry.register(add)
        registry.register(subtract)

        lc_tools = registry.get_langchain_tools()

        assert len(lc_tools) == 2
        tool_names = [t.name for t in lc_tools]
        assert "add" in tool_names
        assert "subtract" in tool_names

    def test_get_langchain_tools_preserves_functionality(self):
        """Test that tools from registry work correctly."""
        registry = ToolRegistry()
        registry.reset()

        def greet(name: str, greeting: str = "Hello") -> str:
            """Greet a person."""
            return f"{greeting}, {name}!"

        registry.register(greet)

        lc_tools = registry.get_langchain_tools()

        assert len(lc_tools) == 1
        result = lc_tools[0].invoke({"name": "Alice"})
        assert result == "Hello, Alice!"

        result_custom = lc_tools[0].invoke({"name": "Bob", "greeting": "Hi"})
        assert result_custom == "Hi, Bob!"

    def test_get_langchain_tools_multiple_calls(self):
        """Test that get_langchain_tools can be called multiple times."""
        registry = ToolRegistry()
        registry.reset()

        def tool1(x: int) -> int:
            """Tool 1."""
            return x

        registry.register(tool1)

        lc_tools_1 = registry.get_langchain_tools()
        lc_tools_2 = registry.get_langchain_tools()

        assert len(lc_tools_1) == 1
        assert len(lc_tools_2) == 1
        # Each call creates new tool instances
        assert lc_tools_1[0] is not lc_tools_2[0]
