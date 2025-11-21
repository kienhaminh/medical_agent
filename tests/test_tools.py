"""Tests for tool registry and executor."""

import pytest

from src.tools.registry import ToolRegistry
from src.tools.executor import ToolExecutor
from src.tools.base import ToolResult


@pytest.fixture
def registry():
    """Create fresh registry for each test."""
    reg = ToolRegistry()
    reg.reset()  # Clear any previously registered tools
    return reg


@pytest.fixture
def executor(registry):
    """Create executor with fresh registry."""
    return ToolExecutor(registry)


# Define sample tools for testing
def sample_tool(message: str) -> str:
    """A sample tool for testing."""
    return f"Processed: {message}"


def error_tool(should_fail: bool = True) -> str:
    """A tool that raises errors for testing."""
    if should_fail:
        raise ValueError("Intentional error for testing")
    return "Success"


def math_tool(a: int, b: int) -> int:
    """Add two numbers."""
    return a + b


class TestToolRegistry:
    """Test suite for ToolRegistry."""

    def test_registry_singleton(self):
        """Test that ToolRegistry is a singleton."""
        registry1 = ToolRegistry()
        registry2 = ToolRegistry()
        assert registry1 is registry2

    def test_register_tool(self, registry):
        """Test registering a tool."""
        registry.register(sample_tool)
        assert sample_tool.__name__ in registry.list_tools()

    def test_register_duplicate_tool(self, registry):
        """Test that registering duplicate tool raises error."""
        registry.register(sample_tool)
        with pytest.raises(ValueError, match="already registered"):
            registry.register(sample_tool)

    def test_get_tool(self, registry):
        """Test getting a tool by name."""
        registry.register(sample_tool)
        tool = registry.get(sample_tool.__name__)
        assert tool is not None
        assert tool.__name__ == sample_tool.__name__

    def test_get_nonexistent_tool(self, registry):
        """Test getting a tool that doesn't exist."""
        tool = registry.get("nonexistent_tool")
        assert tool is None

    def test_list_tools(self, registry):
        """Test listing all registered tools."""
        registry.register(sample_tool)
        registry.register(math_tool)
        tools = registry.list_tools()
        assert len(tools) == 2
        assert sample_tool.__name__ in tools
        assert math_tool.__name__ in tools
        assert tools == sorted(tools)  # Should be sorted

    def test_get_all_tools(self, registry):
        """Test getting tools for binding."""
        registry.register(sample_tool)
        registry.register(math_tool)
        tools = registry.get_all_tools()
        assert len(tools) == 2
        assert sample_tool in tools
        assert math_tool in tools

    def test_reset(self, registry):
        """Test resetting the registry."""
        registry.register(sample_tool)
        registry.register(math_tool)
        assert len(registry.list_tools()) == 2

        registry.reset()
        assert len(registry.list_tools()) == 0


class TestToolExecutor:
    """Test suite for ToolExecutor."""

    def test_execute_successful_tool(self, executor, registry):
        """Test executing a tool successfully."""
        registry.register(sample_tool)
        result = executor.execute(sample_tool.__name__, {"message": "test"})

        assert isinstance(result, ToolResult)
        assert result.success is True
        assert result.data == "Processed: test"
        assert result.error is None

    def test_execute_nonexistent_tool(self, executor):
        """Test executing a tool that doesn't exist."""
        result = executor.execute("nonexistent_tool", {})

        assert isinstance(result, ToolResult)
        assert result.success is False
        assert result.error == "Tool 'nonexistent_tool' not found"
        assert result.data is None

    def test_execute_tool_with_error(self, executor, registry):
        """Test executing a tool that raises an error."""
        registry.register(error_tool)
        result = executor.execute(error_tool.__name__, {"should_fail": True})

        assert isinstance(result, ToolResult)
        assert result.success is False
        assert "Intentional error for testing" in result.error
        assert result.data is None

    def test_execute_tool_with_invalid_args(self, executor, registry):
        """Test executing a tool with invalid arguments."""
        registry.register(math_tool)
        # Missing required parameter
        result = executor.execute(math_tool.__name__, {"a": 5})

        # Python functions raise TypeError when missing arguments
        assert isinstance(result, ToolResult)
        assert result.success is False
        assert result.error is not None
        assert "missing" in result.error.lower()

    def test_execute_tool_with_correct_args(self, executor, registry):
        """Test executing a tool with correct arguments."""
        registry.register(math_tool)
        result = executor.execute(math_tool.__name__, {"a": 5, "b": 3})

        assert isinstance(result, ToolResult)
        assert result.success is True
        assert result.data == 8


class TestToolResult:
    """Test suite for ToolResult."""

    def test_success_result_to_string(self):
        """Test converting successful result to string."""
        result = ToolResult(success=True, data="Test data")
        assert result.to_string() == "Test data"

    def test_error_result_to_string(self):
        """Test converting error result to string."""
        result = ToolResult(success=False, error="Test error")
        assert result.to_string() == "Error: Test error"

    def test_success_result_with_number(self):
        """Test successful result with numeric data."""
        result = ToolResult(success=True, data=42)
        assert result.to_string() == "42"

    def test_success_result_with_dict(self):
        """Test successful result with dictionary data."""
        data = {"key": "value", "number": 123}
        result = ToolResult(success=True, data=data)
        assert "key" in result.to_string()
        assert "value" in result.to_string()
