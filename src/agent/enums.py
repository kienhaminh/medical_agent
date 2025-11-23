"""Enum definitions for the agent."""

from enum import Enum

class GraphNode(str, Enum):
    """Enum for LangGraph nodes."""
    AGENT = "agent"
    TOOLS = "tools"
    SUPERVISOR = "supervisor"
