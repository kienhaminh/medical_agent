"""Graph Builder for LangGraph Agent.

Handles construction of the state graph using LangGraph's prebuilt
create_react_agent for agent orchestration.
"""

import logging

from langgraph.prebuilt import create_react_agent

from .state import AgentState
from ..tools.registry import ToolRegistry

logger = logging.getLogger(__name__)


class GraphBuilder:
    """Builds the LangGraph state graph for single-agent orchestration."""

    def __init__(
        self,
        llm,
        tool_registry: ToolRegistry,
        system_prompt: str,
        max_iterations: int = 10,
    ):
        """Initialize graph builder."""
        self.llm = llm
        self.tool_registry = tool_registry
        self.system_prompt = system_prompt
        self.max_iterations = max_iterations

    def build(self):
        """Build LangGraph using create_react_agent (Agent + Tools)."""
        logger.debug("Building LangGraph workflow via create_react_agent")

        all_tools = self.tool_registry.list_tools()

        graph = create_react_agent(
            model=self.llm,
            tools=all_tools,
            state_schema=AgentState,
            prompt=self.system_prompt,
        )

        logger.debug("LangGraph workflow built (create_react_agent, %d tools)", len(all_tools))
        return graph
