"""Unified LangGraph Agent with Tool Execution.

Single-agent architecture using ReAct pattern with direct tool execution.
"""

import logging
from typing import Union, AsyncGenerator
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage

from ..prompt.system import SYSTEM_PROMPT
from ..utils.token_budget import trim_to_token_budget
from .builder import GraphBuilder
from ..tools.registry import ToolRegistry

logger = logging.getLogger(__name__)


class LangGraphAgent:
    """Unified agent with direct tool execution.

    Single fixed agent instance using the ReAct pattern. No per-user
    state — conversation history is passed in on each request.
    """

    def __init__(
        self,
        llm_with_tools,
        system_prompt: str = None,
        max_iterations: int = 10,
        allowed_tools: list[str] | None = None,
        **kwargs,
    ):
        self.llm = llm_with_tools
        self.system_prompt = system_prompt or SYSTEM_PROMPT
        self.max_iterations = max_iterations

        self.tool_registry = ToolRegistry()

        # Register tools (side-effect imports)
        import src.tools  # noqa: F401

        # Build the graph
        self.graph_builder = GraphBuilder(
            llm=self.llm,
            tool_registry=self.tool_registry,
            system_prompt=self.system_prompt,
            max_iterations=max_iterations,
        )
        self.graph = self.graph_builder.build(allowed_tools=allowed_tools)

        logger.debug("LangGraphAgent initialized (max_iterations=%s, tools=%s)", max_iterations, allowed_tools or "all")

    async def process_message(
        self,
        user_message: str,
        stream: bool = False,
        chat_history: list = None,
        patient_id: int = None,
        patient_name: str = None,
    ) -> Union[str, AsyncGenerator[dict, None]]:
        """Process user message through the agent."""
        logger.info("Processing message (patient_id=%s)", patient_id)

        messages = []

        if self.system_prompt:
            messages.append(SystemMessage(content=self.system_prompt))

        if chat_history:
            history_messages = []
            for msg in chat_history:
                if msg["role"] == "user":
                    history_messages.append(HumanMessage(content=msg["content"]))
                elif msg["role"] == "assistant":
                    history_messages.append(AIMessage(content=msg["content"]))
            messages.extend(trim_to_token_budget(history_messages, budget=2000))

        messages.append(HumanMessage(content=user_message))

        initial_state = {
            "messages": messages,
        }

        config = {"recursion_limit": self.max_iterations * 3}

        if stream:
            return self._stream_response(initial_state, config)
        return await self._generate_response(initial_state, config)

    async def _generate_response(self, initial_state: dict, config: dict) -> str:
        """Non-streaming: invoke graph and return final content."""
        final_state = await self.graph.ainvoke(initial_state, config=config)
        messages = final_state["messages"]
        logger.debug(
            "Agent response messages (%d total):\n%s",
            len(messages),
            "\n".join(
                f"  [{i}] {type(m).__name__}: {getattr(m, 'content', '')[:200]!r}"
                for i, m in enumerate(messages)
            ),
        )
        return messages[-1].content

    async def _stream_response(
        self, initial_state: dict, config: dict
    ) -> AsyncGenerator[dict, None]:
        """Streaming: yield content, tool events, and usage metadata."""
        async for event in self.graph.astream_events(initial_state, config=config, version="v2"):
            event_type = event.get("event")

            if event_type == "on_chain_end" and event.get("name") == "LangGraph":
                messages = event.get("data", {}).get("output", {}).get("messages", [])
                if messages:
                    logger.debug(
                        "Agent response messages (%d total):\n%s",
                        len(messages),
                        "\n".join(
                            f"  [{i}] {type(m).__name__}: {getattr(m, 'content', '')[:200]!r}"
                            for i, m in enumerate(messages)
                        ),
                    )

            if event_type == "on_custom_event" and event.get("name") == "agent_log":
                yield {"type": "log", "content": event["data"]}

            elif event_type == "on_chat_model_stream":
                node = event.get("metadata", {}).get("langgraph_node")
                if node == "agent":
                    chunk = event["data"].get("chunk")
                    if not chunk:
                        continue

                    if hasattr(chunk, "usage_metadata") and chunk.usage_metadata:
                        um = chunk.usage_metadata
                        usage = {
                            "prompt_tokens": getattr(um, "input_tokens", 0),
                            "completion_tokens": getattr(um, "output_tokens", 0),
                            "total_tokens": getattr(um, "total_tokens", 0),
                        }
                        if usage["total_tokens"] > 0:
                            yield {"type": "usage", "usage": usage}

                    reasoning = (chunk.additional_kwargs or {}).get("reasoning_content", "")
                    if reasoning:
                        yield {"type": "reasoning", "content": reasoning}

                    if hasattr(chunk, "content") and chunk.content:
                        yield {"type": "content", "content": chunk.content}

            elif event_type == "on_tool_start":
                yield {
                    "type": "tool_call",
                    "id": event.get("run_id"),
                    "tool": event.get("name"),
                    "args": event.get("data", {}).get("input"),
                }

            elif event_type == "on_tool_end":
                output = event.get("data", {}).get("output")
                # LangGraph wraps tool output in a ToolMessage; extract .content
                if hasattr(output, "content"):
                    result_str = output.content if isinstance(output.content, str) else str(output.content)
                else:
                    result_str = str(output)
                yield {
                    "type": "tool_result",
                    "id": event.get("run_id"),
                    "result": result_str,
                }

            elif event_type == "on_chat_model_end":
                output = event.get("data", {}).get("output")
                if not output:
                    continue
                usage = None
                if hasattr(output, "usage_metadata") and output.usage_metadata:
                    usage = output.usage_metadata
                elif hasattr(output, "response_metadata"):
                    rm = output.response_metadata or {}
                    usage = rm.get("token_usage") or rm.get("usage")
                elif isinstance(output, dict):
                    usage = output.get("token_usage") or output.get("usage")
                if usage:
                    yield {"type": "usage", "usage": usage}

    def __repr__(self) -> str:
        return f"LangGraphAgent(tools={len(self.tool_registry.tools)})"
