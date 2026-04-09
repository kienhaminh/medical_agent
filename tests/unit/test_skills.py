"""Tests for skill registry and management."""

import pytest
import os
import tempfile
from pathlib import Path

from src.skills.base import Skill, SkillMetadata
from src.skills.registry import SkillRegistry


@pytest.fixture
def temp_skill_dir():
    """Create a temporary skill directory with SKILL.md."""
    with tempfile.TemporaryDirectory() as tmpdir:
        # Create SKILL.md
        skill_md = Path(tmpdir) / "SKILL.md"
        skill_md.write_text("""---
name: test-skill
description: "A test skill for unit tests"
when_to_use:
  - "When testing"
  - "When debugging"
when_not_to_use:
  - "In production"
keywords:
  - test
  - debug
---

# Test Skill

This is a test skill.
""")
        
        # Create tools.py
        tools_py = Path(tmpdir) / "tools.py"
        tools_py.write_text("""
def test_tool():
    '''A test tool.'''
    return "test result"

def another_tool(name: str) -> str:
    '''Another test tool with args.
    
    Args:
        name: Name to greet
        
    Returns:
        Greeting string
    '''
    return f"Hello, {name}!"
""")
        
        yield tmpdir


@pytest.fixture
def clean_registry():
    """Provide a clean SkillRegistry instance."""
    # Reset singleton
    SkillRegistry._instance = None
    registry = SkillRegistry()
    yield registry
    # Cleanup
    registry.reset()
    SkillRegistry._instance = None


class TestSkillMetadata:
    """Test SkillMetadata class."""
    
    def test_from_markdown_valid(self):
        """Test parsing valid SKILL.md content."""
        content = """---
name: test-skill
description: "A test skill"
when_to_use:
  - "When testing"
when_not_to_use:
  - "Never"
keywords:
  - test
---

# Test Skill
"""
        metadata = SkillMetadata.from_markdown(content)
        
        assert metadata.name == "test-skill"
        assert metadata.description == "A test skill"
        assert "When testing" in metadata.when_to_use
        assert "Never" in metadata.when_not_to_use
        assert "test" in metadata.keywords
    
    def test_from_markdown_no_frontmatter(self):
        """Test parsing markdown without frontmatter."""
        content = "# Just a markdown file\nNo frontmatter here."
        
        with pytest.raises(ValueError, match="No valid frontmatter"):
            SkillMetadata.from_markdown(content)


class TestSkill:
    """Test Skill class."""
    
    def test_load_metadata(self, temp_skill_dir):
        """Test loading metadata from SKILL.md."""
        skill = Skill(temp_skill_dir)
        
        assert skill.name == "test-skill"
        assert skill.description == "A test skill for unit tests"
        assert "When testing" in skill.metadata.when_to_use
    
    def test_register_and_get_tool(self, temp_skill_dir):
        """Test registering and retrieving tools."""
        skill = Skill(temp_skill_dir)
        
        # Register a tool manually
        def manual_tool():
            return "manual"
        
        skill.register_tool("manual_tool", manual_tool)
        
        assert "manual_tool" in skill.list_tools()
        assert skill.get_tool("manual_tool") == manual_tool
        assert skill.get_tool("nonexistent") is None
    
    def test_load_tools_from_module(self, temp_skill_dir):
        """Test loading tools from tools.py."""
        skill = Skill(temp_skill_dir)
        skill.load_tools_from_module()
        
        # Should have loaded test_tool and another_tool
        assert "test_tool" in skill.list_tools()
        assert "another_tool" in skill.list_tools()
    
    def test_to_dict(self, temp_skill_dir):
        """Test converting skill to dictionary."""
        skill = Skill(temp_skill_dir)
        skill.load_tools_from_module()
        
        data = skill.to_dict()
        
        assert data["name"] == "test-skill"
        assert data["description"] == "A test skill for unit tests"
        assert "test" in data["keywords"]
        assert data["tool_count"] >= 2


class TestSkillRegistry:
    """Test SkillRegistry class."""
    
    def test_singleton(self, clean_registry):
        """Test that registry is a singleton."""
        registry1 = SkillRegistry()
        registry2 = SkillRegistry()
        
        assert registry1 is registry2
    
    def test_register_and_get(self, clean_registry, temp_skill_dir):
        """Test registering and retrieving skills."""
        skill = Skill(temp_skill_dir)
        
        clean_registry.register(skill)
        
        assert clean_registry.get("test-skill") == skill
        assert clean_registry.get("nonexistent") is None
    
    def test_register_duplicate(self, clean_registry, temp_skill_dir):
        """Test that duplicate registration raises error."""
        skill = Skill(temp_skill_dir)
        
        clean_registry.register(skill)
        
        with pytest.raises(ValueError, match="already registered"):
            clean_registry.register(skill)
    
    def test_list_skills(self, clean_registry, temp_skill_dir):
        """Test listing all skills."""
        skill = Skill(temp_skill_dir)
        clean_registry.register(skill)
        
        skills = clean_registry.list_skills()
        
        assert len(skills) == 1
        assert skills[0]["name"] == "test-skill"
    
    def test_discover_skills(self, clean_registry):
        """Test discovering skills from directory."""
        # Use the actual skills directory in the project
        skills_dir = os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
            "src", "skills"
        )
        
        if os.path.exists(skills_dir):
            count = clean_registry.discover_skills([skills_dir])
            
            # Should discover at least the diagnosis skill (no DB deps)
            assert count >= 1
            
            # Check that skills were registered
            skills = clean_registry.list_skills()
            skill_names = [s["name"] for s in skills]
            assert "diagnosis" in skill_names
    
    def test_select_skills(self, clean_registry, temp_skill_dir):
        """Test selecting skills based on query."""
        skill = Skill(temp_skill_dir)
        clean_registry.register(skill)
        
        # Query that matches the test skill
        selected = clean_registry.select_skills("I need to test something", top_k=3)
        
        assert len(selected) >= 1
        assert selected[0].name == "test-skill"
    
    def test_select_skills_no_match(self, clean_registry, temp_skill_dir):
        """Test selecting skills with no matches."""
        skill = Skill(temp_skill_dir)
        clean_registry.register(skill)
        
        # Query that doesn't match
        selected = clean_registry.select_skills("something completely unrelated to testing xyz")
        
        # Should return empty list or low-confidence results
        assert isinstance(selected, list)
    
    def test_reset(self, clean_registry, temp_skill_dir):
        """Test resetting the registry."""
        skill = Skill(temp_skill_dir)
        clean_registry.register(skill)
        
        assert len(clean_registry.list_skills()) == 1
        
        clean_registry.reset()
        
        assert len(clean_registry.list_skills()) == 0
