"""Shared stream processor for agent event accumulation.

Accumulates content, tool calls, logs, and usage from the agent's event stream.
"""

import json
from dataclasses import dataclass, field
from datetime import datetime, timezone


@dataclass
class StreamResult:
    """Accumulated result from a completed agent stream."""
    content: str = ""
    tool_calls: list = field(default_factory=list)
    logs: list = field(default_factory=list)
    reasoning: str = ""
    usage: dict = field(default_factory=lambda: {
        "prompt_tokens": 0,
        "completion_tokens": 0,
        "total_tokens": 0,
    })

    def tool_calls_json(self) -> str | None:
        return json.dumps(self.tool_calls) if self.tool_calls else None

    def logs_json(self) -> str | None:
        return json.dumps(self.logs) if self.logs else None

    def usage_json(self) -> str | None:
        return json.dumps(self.usage) if self.usage["total_tokens"] > 0 else None


class StreamProcessor:
    """Processes agent events and accumulates results.

    Iterate over the agent stream with `process()`, which yields each event
    (for forwarding to SSE/Redis) while accumulating into `self.result`.
    """

    def __init__(self):
        self.result = StreamResult()

    async def process(self, stream):
        """Iterate agent event stream, accumulate state, yield each event.

        Args:
            stream: Async generator from agent.process_message(stream=True)

        Yields:
            Each event dict from the agent stream, unchanged.
        """
        async for event in stream:
            if not isinstance(event, dict):
                self.result.content = event
                yield event
                continue

            event_type = event.get("type")

            if event_type == "content":
                self.result.content += event["content"]

            elif event_type == "tool_call":
                self.result.tool_calls.append(event)

            elif event_type == "tool_result":
                for tc in self.result.tool_calls:
                    if tc.get("id") == event.get("id"):
                        tc["result"] = event.get("result")
                self.result.logs.append({
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "type": "tool_result",
                    "content": event,
                })

            elif event_type == "reasoning":
                self.result.reasoning += event["content"]

            elif event_type == "log":
                self.result.logs.append({
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "type": "log",
                    "content": event["content"],
                })

            elif event_type == "usage":
                usage = event.get("usage", {})
                if isinstance(usage, dict):
                    self.result.usage["prompt_tokens"] += usage.get("prompt_tokens", usage.get("input_tokens", 0))
                    self.result.usage["completion_tokens"] += usage.get("completion_tokens", usage.get("output_tokens", 0))
                    self.result.usage["total_tokens"] += usage.get("total_tokens", 0)

            yield event
