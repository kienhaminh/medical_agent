# tests/test_request_specialist_team_tool.py
"""Tests for request_specialist_team tool registration."""
import importlib
from src.tools.registry import ToolRegistry


def test_tool_is_registered():
    # Import the module to trigger registration
    importlib.import_module("src.tools.builtin.request_specialist_team_tool")
    registry = ToolRegistry()
    tools = registry.get_langchain_tools(scope_filter="global")
    names = [t.name for t in tools]
    assert "request_specialist_team" in names


def test_tool_has_correct_scope():
    registry = ToolRegistry()
    scope = registry._tool_scopes.get("request_specialist_team")
    assert scope == "global"
