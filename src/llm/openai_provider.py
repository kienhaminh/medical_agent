"""OpenAI provider."""

import json
from typing import Iterator, Union

from openai import OpenAI
from langchain_openai import ChatOpenAI

from .provider import Message, LLMResponse
from .langchain_adapter import LangChainAdapter
from ..utils.enums import MessageRole


class OpenAIProvider(LangChainAdapter):
    """OpenAI provider using the official OpenAI API."""

    def __init__(
        self,
        api_key: str,
        model: str = "gpt-4o",
        max_tokens: int = 4096,
        temperature: float = 0.3,
        max_retries: int = 2,
        streaming: bool = True,
        **kwargs,
    ):
        llm = ChatOpenAI(
            model=model,
            api_key=api_key,
            temperature=temperature,
            max_tokens=max_tokens,
            max_retries=max_retries,
            streaming=streaming,
            **kwargs,
        )

        super().__init__(llm)

        self.api_key = api_key
        self.model = model
        self.temperature = temperature
        self.max_tokens = max_tokens
        self.max_retries = max_retries

        # Reusable OpenAI client (avoids creating a new connection pool per call)
        self._client = OpenAI(api_key=api_key)

        # Fast LLM for routing/classification — small token budget is sufficient
        self.fast_llm = ChatOpenAI(
            model="gpt-4o-mini",
            api_key=api_key,
            temperature=temperature,
            max_tokens=512,
            max_retries=max_retries,
            streaming=False,
        )

    def bind_tools(self, tools: list) -> None:
        """Bind tools to LLM for function calling."""
        self.llm = self.llm.bind_tools(tools)

    def stream(self, messages: list[Message], **kwargs) -> Iterator[Union[str, dict]]:
        """Stream response from OpenAI.

        Yields:
            - {"type": "content", "content": "..."}
            - {"type": "usage", "usage": {...}}
        """
        lc_messages = self._convert_messages(messages)
        formatted_messages = []
        for msg in lc_messages:
            role = MessageRole.USER
            if msg.type == "system":
                role = MessageRole.SYSTEM
            elif msg.type == "ai":
                role = MessageRole.ASSISTANT
            elif msg.type == "tool":
                role = MessageRole.TOOL

            formatted_msg = {"role": role.value, "content": msg.content}
            if role == MessageRole.TOOL:
                formatted_msg["tool_call_id"] = msg.tool_call_id
            elif role == MessageRole.ASSISTANT and hasattr(msg, "tool_calls") and msg.tool_calls:
                formatted_msg["tool_calls"] = [
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
            formatted_messages.append(formatted_msg)

        tools_param = None
        if hasattr(self.llm, "kwargs") and "tools" in self.llm.kwargs:
            tools_param = self.llm.kwargs["tools"]

        stream_params = {
            "model": self.model,
            "messages": formatted_messages,
            "stream": True,
            "temperature": self.temperature,
            "max_tokens": self.max_tokens,
            "stream_options": {"include_usage": True},
        }
        if tools_param:
            stream_params["tools"] = tools_param
        stream_params.update(kwargs)

        stream = self._client.chat.completions.create(**stream_params)

        total_usage = {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}

        for chunk in stream:
            if not chunk.choices:
                if hasattr(chunk, "usage") and chunk.usage:
                    total_usage["prompt_tokens"] = chunk.usage.prompt_tokens
                    total_usage["completion_tokens"] = chunk.usage.completion_tokens
                    total_usage["total_tokens"] = chunk.usage.total_tokens
                continue

            delta = chunk.choices[0].delta

            if delta.content:
                yield {"type": "content", "content": delta.content}

            if hasattr(chunk, "usage") and chunk.usage:
                total_usage["prompt_tokens"] = chunk.usage.prompt_tokens
                total_usage["completion_tokens"] = chunk.usage.completion_tokens
                total_usage["total_tokens"] = chunk.usage.total_tokens

        if total_usage["total_tokens"] > 0:
            yield {"type": "usage", "usage": total_usage}
