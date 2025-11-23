"""Test scope-based tool access control.

Verifies that:
1. Main agent cannot access tools with scope="assignable"
2. Sub-agents can access their assigned tools
3. Tools with scope="both" are accessible by both
"""

import pytest
from src.tools.registry import ToolRegistry


class TestToolScopeRegistration:
    """Test tool registration with different scopes."""

    def setup_method(self):
        """Reset registry before each test."""
        registry = ToolRegistry()
        registry.reset()

    def test_register_tool_with_global_scope(self):
        """Test registering a tool with global scope."""
        registry = ToolRegistry()

        def global_tool():
            """A global tool."""
            return "global"

        registry.register(global_tool, scope="global")

        # Should be in tools dict
        assert global_tool.__name__ in registry._tools
        assert registry._tool_scopes[global_tool.__name__] == "global"

    def test_register_tool_with_assignable_scope(self):
        """Test registering a tool with assignable scope."""
        registry = ToolRegistry()

        def assignable_tool():
            """An assignable tool."""
            return "assignable"

        registry.register(assignable_tool, scope="assignable")

        # Should be in tools dict
        assert assignable_tool.__name__ in registry._tools
        assert registry._tool_scopes[assignable_tool.__name__] == "assignable"

    def test_register_tool_with_both_scope(self):
        """Test registering a tool with both scope."""
        registry = ToolRegistry()

        def both_tool():
            """A tool for both."""
            return "both"

        registry.register(both_tool, scope="both")

        # Should be in tools dict
        assert both_tool.__name__ in registry._tools
        assert registry._tool_scopes[both_tool.__name__] == "both"

    def test_register_tool_with_invalid_scope(self):
        """Test that invalid scope raises ValueError."""
        registry = ToolRegistry()

        def invalid_tool():
            """Invalid scope tool."""
            return "invalid"

        with pytest.raises(ValueError, match="Invalid scope"):
            registry.register(invalid_tool, scope="invalid")

    def test_default_scope_is_global(self):
        """Test that default scope is global when not specified."""
        registry = ToolRegistry()

        def default_tool():
            """Default scope tool."""
            return "default"

        registry.register(default_tool)  # No scope specified

        assert registry._tool_scopes[default_tool.__name__] == "global"


class TestToolScopeFiltering:
    """Test scope-based filtering of tools."""

    def setup_method(self):
        """Reset registry and create test tools."""
        registry = ToolRegistry()
        registry.reset()

        # Create tools with different scopes
        def global_tool():
            """Global tool."""
            return "global"

        def assignable_tool():
            """Assignable tool."""
            return "assignable"

        def both_tool():
            """Both tool."""
            return "both"

        registry.register(global_tool, scope="global")
        registry.register(assignable_tool, scope="assignable")
        registry.register(both_tool, scope="both")

        self.registry = registry

    def test_get_langchain_tools_with_global_filter(self):
        """Test getting tools with global scope filter."""
        # Main agent should get global + both tools
        tools = self.registry.get_langchain_tools(scope_filter="global")

        tool_names = [t.name for t in tools]

        # Should include global and both
        assert "global_tool" in tool_names
        assert "both_tool" in tool_names

        # Should NOT include assignable
        assert "assignable_tool" not in tool_names

    def test_get_langchain_tools_with_assignable_filter(self):
        """Test getting tools with assignable scope filter."""
        # Sub-agents with assigned tools should get assignable + both tools
        tools = self.registry.get_langchain_tools(scope_filter="assignable")

        tool_names = [t.name for t in tools]

        # Should include assignable and both
        assert "assignable_tool" in tool_names
        assert "both_tool" in tool_names

        # Should NOT include global
        assert "global_tool" not in tool_names

    def test_get_langchain_tools_without_filter(self):
        """Test getting all tools without scope filter."""
        tools = self.registry.get_langchain_tools()

        tool_names = [t.name for t in tools]

        # Should include all tools
        assert "global_tool" in tool_names
        assert "assignable_tool" in tool_names
        assert "both_tool" in tool_names

    def test_disabled_tools_not_included(self):
        """Test that disabled tools are not included regardless of scope."""
        self.registry.disable_tool("global_tool")

        tools = self.registry.get_langchain_tools(scope_filter="global")
        tool_names = [t.name for t in tools]

        # Disabled tool should not be included
        assert "global_tool" not in tool_names

        # Other tools should still be there
        assert "both_tool" in tool_names


class TestPatientToolScoping:
    """Test that patient tool has correct scope in database."""

    @pytest.mark.asyncio
    async def test_patient_tool_has_assignable_scope(self):
        """Verify query_patient_info has scope='assignable' in database."""
        from src.config.database import SubAgent, Tool, AgentToolAssignment, AsyncSessionLocal
        from sqlalchemy import select

        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(Tool).where(Tool.name == "query_patient_info")
            )
            patient_tool = result.scalar_one_or_none()

            if patient_tool:
                assert patient_tool.scope == "assignable", \
                    f"Patient tool should have scope='assignable', got '{patient_tool.scope}'"
            else:
                pytest.skip("Patient tool not in database yet. Run seed script first.")


class TestMainAgentToolAccess:
    """Test that main agent cannot access patient tools."""

    def test_main_agent_cannot_access_patient_tool(self):
        """Verify main agent doesn't get patient tool in its tool list."""
        registry = ToolRegistry()
        registry.reset()

        # Simulate patient tool registration
        def query_patient_info(query: str) -> str:
            """Query patient information."""
            return f"Patient: {query}"

        registry.register(query_patient_info, scope="assignable")

        # Main agent requests tools with global filter
        main_agent_tools = registry.get_langchain_tools(scope_filter="global")
        tool_names = [t.name for t in main_agent_tools]

        # Patient tool should NOT be in main agent's tools
        assert "query_patient_info" not in tool_names, \
            "Main agent should NOT have access to patient query tool!"

    def test_subagent_can_access_patient_tool_by_name(self):
        """Verify sub-agents can access patient tool by name."""
        registry = ToolRegistry()
        registry.reset()

        # Simulate patient tool registration
        def query_patient_info(query: str) -> str:
            """Query patient information."""
            return f"Patient: {query}"

        registry.register(query_patient_info, scope="assignable")

        # Sub-agent requests specific tools by name
        subagent_tools = registry.get_tools_by_names(["query_patient_info"])

        # Should have the tool
        assert len(subagent_tools) == 1
        assert subagent_tools[0].name == "query_patient_info"


class TestAgentArchitectureToolScope:
    """Test that get_agent_architecture has global scope."""

    def test_agent_architecture_tool_has_global_scope(self):
        """Verify get_agent_architecture is accessible to main agent."""
        from src.tools.builtin.agent_info_tool import get_agent_architecture

        registry = ToolRegistry()

        # Check if already registered
        if "get_agent_architecture" in registry._tools:
            scope = registry._tool_scopes.get("get_agent_architecture", "global")
            assert scope in ("global", "both"), \
                f"Agent architecture tool should be global or both, got '{scope}'"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
