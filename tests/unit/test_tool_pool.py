"""Tests for ToolPool."""

import pytest
from src.tools.pool import ToolPool, ToolInfo
from src.skills.base import Skill, SkillMetadata


@pytest.fixture
def clean_pool():
    """Provide a clean ToolPool instance."""
    # Reset singleton
    ToolPool._instance = None
    pool = ToolPool()
    yield pool
    # Cleanup
    pool.clear()
    ToolPool._instance = None


@pytest.fixture
def mock_skill():
    """Create a mock skill with tools."""
    # Create a minimal skill
    class MockSkill:
        def __init__(self):
            self.name = "mock-skill"
            self.tools = {}
        
        def register_tool(self, name, func):
            self.tools[name] = func
    
    skill = MockSkill()
    
    def tool1():
        """Tool 1 description."""
        return "tool1"
    
    def tool2():
        """Tool 2 for testing patient search."""
        return "tool2"
    
    skill.register_tool("tool1", tool1)
    skill.register_tool("tool2", tool2)
    
    return skill


class TestToolPool:
    """Test ToolPool class."""
    
    def test_singleton(self, clean_pool):
        """Test that pool is a singleton."""
        pool1 = ToolPool()
        pool2 = ToolPool()
        
        assert pool1 is pool2
    
    def test_register_tool(self, clean_pool):
        """Test registering a tool."""
        def my_tool():
            """My tool."""
            return "result"
        
        clean_pool.register("my_tool", my_tool, skill_name="test")
        
        assert clean_pool.get("my_tool") == my_tool
        assert clean_pool.get_info("my_tool").skill_name == "test"
    
    def test_register_from_skill(self, clean_pool, mock_skill):
        """Test registering tools from a skill."""
        clean_pool.register_from_skill(mock_skill)
        
        assert clean_pool.get("tool1") is not None
        assert clean_pool.get("tool2") is not None
        assert clean_pool.get_info("tool1").skill_name == "mock-skill"
    
    def test_get_for_skill(self, clean_pool, mock_skill):
        """Test getting tools for a specific skill."""
        clean_pool.register_from_skill(mock_skill)
        
        tools = clean_pool.get_for_skill("mock-skill")
        
        assert len(tools) == 2
    
    def test_get_for_query(self, clean_pool):
        """Test getting tools for a query."""
        def search_patient():
            """Search for patients by name or ID."""
            return "patient"
        
        def get_weather():
            """Get weather information."""
            return "sunny"
        
        clean_pool.register("search_patient", search_patient, "patient")
        clean_pool.register("get_weather", get_weather, "weather")
        
        # Query for patient search
        tools = clean_pool.get_for_query("find patient John", top_k=5)
        
        # Should return search_patient as most relevant
        assert len(tools) >= 1
        assert search_patient in tools
    
    def test_list_tools(self, clean_pool, mock_skill):
        """Test listing all tools."""
        clean_pool.register_from_skill(mock_skill)
        
        tools = clean_pool.list_tools()
        
        assert len(tools) == 2
        tool_names = [t["name"] for t in tools]
        assert "tool1" in tool_names
        assert "tool2" in tool_names
    
    def test_list_by_skill(self, clean_pool, mock_skill):
        """Test listing tools organized by skill."""
        clean_pool.register_from_skill(mock_skill)
        
        by_skill = clean_pool.list_by_skill()
        
        assert "mock-skill" in by_skill
        assert "tool1" in by_skill["mock-skill"]
        assert "tool2" in by_skill["mock-skill"]
    
    def test_get_skill_for_tool(self, clean_pool, mock_skill):
        """Test getting skill name for a tool."""
        clean_pool.register_from_skill(mock_skill)
        
        skill_name = clean_pool.get_skill_for_tool("tool1")
        
        assert skill_name == "mock-skill"
    
    def test_get_skill_for_tool_not_found(self, clean_pool):
        """Test getting skill for nonexistent tool."""
        skill_name = clean_pool.get_skill_for_tool("nonexistent")
        
        assert skill_name is None
    
    def test_clear(self, clean_pool, mock_skill):
        """Test clearing all tools."""
        clean_pool.register_from_skill(mock_skill)
        
        assert len(clean_pool.list_tools()) == 2
        
        clean_pool.clear()
        
        assert len(clean_pool.list_tools()) == 0
        assert len(clean_pool.list_by_skill()) == 0
