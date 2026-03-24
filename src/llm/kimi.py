"""Kimi (Moonshot AI) provider."""

import json
import logging
from typing import Optional, Iterator, Union

from openai import OpenAI

from .provider import Message, LLMResponse
from ..utils.enums import MessageRole
from .langchain_adapter import LangChainAdapter
from langchain_openai import ChatOpenAI

logger = logging.getLogger(__name__)


class KimiProvider(LangChainAdapter):
    """Kimi provider using Moonshot AI API (OpenAI-compatible)."""

    def __init__(
        self,
        api_key: str,
        model: str = "kimi-k2-thinking",
        base_url: str = "https://api.moonshot.ai/v1",
        max_tokens: int = 4096,
        temperature: float = 0.3,
        max_retries: int = 2,
        streaming: bool = True,
        stream_usage: bool = True,
        **kwargs,
    ):
        llm = ChatOpenAI(
            model=model,
            api_key=api_key,
            base_url=base_url,
            temperature=temperature,
            max_tokens=max_tokens,
            max_retries=max_retries,
            streaming=streaming,
            stream_usage=stream_usage,
            **kwargs,
        )

        super().__init__(llm)

        self.api_key = api_key
        self.base_url = base_url
        self.model = model
        self.temperature = temperature
        self.max_tokens = max_tokens
        self.max_retries = max_retries

        # Reusable OpenAI client (avoids creating a new connection pool per call)
        self._client = OpenAI(api_key=api_key, base_url=base_url)

        # Fast LLM for routing/classification tasks — small token budget is sufficient
        self.fast_llm = ChatOpenAI(
            model="moonshot-v1-8k",
            api_key=api_key,
            base_url=base_url,
            temperature=temperature,
            max_tokens=512,
            max_retries=max_retries,
            streaming=False,
        )

    def _format_messages_for_api(self, messages: list[Message]) -> list[dict]:
        """Convert internal messages to the OpenAI API dict format.

        Shared by generate() and stream() to avoid duplication.
        """
        lc_messages = self._convert_messages(messages)
        formatted = []
        for msg in lc_messages:
            role = MessageRole.USER
            if msg.type == "system":
                role = MessageRole.SYSTEM
            elif msg.type == "ai":
                role = MessageRole.ASSISTANT
            elif msg.type == "tool":
                role = MessageRole.TOOL

            entry: dict = {"role": role.value, "content": msg.content}
            if role == MessageRole.TOOL:
                entry["tool_call_id"] = msg.tool_call_id
            elif role == MessageRole.ASSISTANT and hasattr(msg, "tool_calls") and msg.tool_calls:
                entry["tool_calls"] = [
                    {
                        "id": tc["id"],
                        "type": "function",
                        "function": {
                            "name": tc["name"],
                            "arguments": json.dumps(tc["args"]) if isinstance(tc["args"], dict) else str(tc["args"]),
                        },
                    }
                    for tc in msg.tool_calls
                ]
            formatted.append(entry)
        return formatted

    def generate(self, messages: list[Message], **kwargs) -> LLMResponse:
        """Generate a response from Kimi with reasoning content support."""
        formatted_messages = self._format_messages_for_api(messages)

        tools_param = None
        if hasattr(self.llm, "kwargs") and "tools" in self.llm.kwargs:
            tools_param = self.llm.kwargs["tools"]

        completion_params = {
            "model": self.model,
            "messages": formatted_messages,
            "temperature": self.temperature,
            "max_tokens": self.max_tokens,
        }
        if tools_param:
            completion_params["tools"] = tools_param
        completion_params.update(kwargs)

        response = self._client.chat.completions.create(**completion_params)

        choice = response.choices[0]
        message = choice.message

        # Combine reasoning_content and content
        content = ""
        if hasattr(message, "reasoning_content") and message.reasoning_content:
            content = message.reasoning_content + "\n\n"
        if message.content:
            content += message.content

        # Extract tool calls if present
        tool_calls = None
        if hasattr(message, "tool_calls") and message.tool_calls:
            tool_calls = [
                {
                    "name": tc.function.name,
                    "args": json.loads(tc.function.arguments) if tc.function.arguments else {},
                    "id": tc.id,
                }
                for tc in message.tool_calls
            ]

        usage = {"input_tokens": 0, "output_tokens": 0}
        if hasattr(response, "usage") and response.usage:
            usage = {
                "input_tokens": response.usage.prompt_tokens,
                "output_tokens": response.usage.completion_tokens,
            }

        return LLMResponse(
            content=content,
            model=self.model,
            usage=usage,
            stop_reason=choice.finish_reason or "stop",
            tool_calls=tool_calls,
        )

    def bind_tools(self, tools: list) -> None:
        """Bind tools to LLM for function calling."""
        self.llm = self.llm.bind_tools(tools)

    def stream(self, messages: list[Message], **kwargs) -> Iterator[Union[str, dict]]:
        """Stream response from Kimi with reasoning content support.

        Yields:
            - {"type": "reasoning", "content": "..."}
            - {"type": "content", "content": "..."}
            - {"type": "usage", "usage": {...}}
        """
        formatted_messages = self._format_messages_for_api(messages)

        tools_param = None
        if hasattr(self.llm, "kwargs") and "tools" in self.llm.kwargs:
            tools_param = self.llm.kwargs["tools"]

        stream_params = {
            "model": self.model,
            "messages": formatted_messages,
            "stream": True,
            "temperature": self.temperature,
            "max_tokens": self.max_tokens,
        }
        if tools_param:
            stream_params["tools"] = tools_param
        stream_params.update(kwargs)

        stream = self._client.chat.completions.create(**stream_params)

        total_usage = {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}

        for chunk in stream:
            delta = chunk.choices[0].delta

            if hasattr(delta, "reasoning_content") and delta.reasoning_content:
                yield {"type": "reasoning", "content": delta.reasoning_content}

            if delta.content:
                yield {"type": "content", "content": delta.content}

            if hasattr(chunk, "usage") and chunk.usage:
                if hasattr(chunk.usage, "prompt_tokens"):
                    total_usage["prompt_tokens"] = chunk.usage.prompt_tokens
                if hasattr(chunk.usage, "completion_tokens"):
                    total_usage["completion_tokens"] = chunk.usage.completion_tokens
                if hasattr(chunk.usage, "total_tokens"):
                    total_usage["total_tokens"] = chunk.usage.total_tokens

        if total_usage["total_tokens"] > 0:
            yield {"type": "usage", "usage": total_usage}
