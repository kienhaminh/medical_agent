"""Unit tests for Tool Registry."""
import pytest

from src.tools.registry import ToolRegistry
from src.tools.base import BaseTool


class MockTool(BaseTool):
    """Mock tool for testing."""
    name = "mock_tool"
    description = "A mock tool for testing"
    
    def execute(self, **kwargs):
        return {"result": "mock result"}
    
    def get_schema(self):
        return {
            "name": self.name,
            "description": self.description,
            "parameters": {}
        }


@pytest.fixture
def registry():
    """Create a fresh tool registry."""
    return ToolRegistry()


class TestToolRegistry:
    """Test ToolRegistry functionality."""
    
    def test_singleton_pattern(self):
        """Test that ToolRegistry is a singleton."""
        reg1 = ToolRegistry()
        reg2 = ToolRegistry()
        assert reg1 is reg2
    
    def test_register_tool(self, registry):
        """Test registering a tool."""
        tool = MockTool()
        registry.register(tool)
        
        assert "mock_tool" in registry.tools
        assert registry.get("mock_tool") is tool
    
    def test_get_nonexistent_tool(self, registry):
        """Test getting a tool that doesn't exist."""
        result = registry.get("nonexistent")
        assert result is None
    
    def test_list_tools(self, registry):
        """Test listing registered tools."""
        tool1 = MockTool()
        tool2 = MockTool()
        tool2.name = "mock_tool_2"
        
        registry.register(tool1)
        registry.register(tool2)
        
        tools = registry.list_tools()
        assert len(tools) >= 2
        assert any(t.name == "mock_tool" for t in tools)
        assert any(t.name == "mock_tool_2" for t in tools)
    
    def test_register_duplicate_tool(self, registry):
        """Test that registering duplicate tool overwrites."""
        tool1 = MockTool()
        tool2 = MockTool()
        
        registry.register(tool1)
        registry.register(tool2)
        
        # Should have the second tool
        assert registry.get("mock_tool") is tool2
