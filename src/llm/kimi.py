"""Kimi (Moonshot AI) provider."""

import json
import logging
from typing import Any, AsyncIterator, Optional, Iterator, List, Type, Union

from openai import OpenAI
from langchain_core.messages import AIMessageChunk, BaseMessageChunk
from langchain_core.outputs import ChatGenerationChunk
from langchain_core.language_models.chat_models import AsyncCallbackManagerForLLMRun
from langchain_openai import ChatOpenAI
from langchain_openai.chat_models.base import _convert_message_to_dict, _convert_chunk_to_generation_chunk

from .provider import Message, LLMResponse
from ..utils.enums import MessageRole
from .langchain_adapter import LangChainAdapter

logger = logging.getLogger(__name__)


class KimiChatOpenAI(ChatOpenAI):
    """ChatOpenAI that preserves reasoning_content in replayed history.

    Kimi's thinking mode requires assistant messages with tool calls to include
    reasoning_content when sent back in subsequent turns. LangChain's default
    _convert_message_to_dict drops additional_kwargs fields, so we inject it here.
    """

    def _get_request_payload(
        self,
        input_: Any,
        *,
        stop: Optional[List[str]] = None,
        **kwargs: Any,
    ) -> dict:
        messages = self._convert_input(input_).to_messages()
        if stop is not None:
            kwargs["stop"] = stop

        formatted = []
        for i, msg in enumerate(messages):
            d = _convert_message_to_dict(msg)
            # Kimi thinking mode requires reasoning_content on every assistant message
            # that has tool_calls. We capture it from the raw stream in _astream and
            # store it in additional_kwargs so it can be replayed here.
            if d.get("role") == "assistant" and d.get("tool_calls"):
                d["reasoning_content"] = getattr(msg, "additional_kwargs", {}).get(
                    "reasoning_content", ""
                )
            formatted.append(d)

        return {
            "messages": formatted,
            **self._default_params,
            **kwargs,
        }

    async def _astream(
        self,
        messages: List,
        stop: Optional[List[str]] = None,
        run_manager: Optional[AsyncCallbackManagerForLLMRun] = None,
        **kwargs: Any,
    ) -> AsyncIterator[ChatGenerationChunk]:
        """Override to capture reasoning_content from Kimi's thinking mode.

        Kimi's thinking model streams reasoning_content in the delta. LangChain's
        _convert_delta_to_message_chunk ignores it, so we capture it here and emit
        a synthetic trailing chunk that stores it in AIMessage.additional_kwargs.
        _get_request_payload then replays the real value in subsequent turns.
        """
        # Mirror ChatOpenAI._astream: handle stream_usage before calling super
        stream_usage = kwargs.pop("stream_usage", None)
        stream_usage = self._should_stream_usage(stream_usage, **kwargs)
        if stream_usage:
            kwargs["stream_options"] = {"include_usage": True}

        kwargs["stream"] = True
        payload = self._get_request_payload(messages, stop=stop, **kwargs)
        default_chunk_class: Type[BaseMessageChunk] = AIMessageChunk
        base_generation_info: dict = {}

        response = await self.async_client.create(**payload)

        async with response:
            is_first_chunk = True
            async for chunk in response:
                # Read reasoning_content from the raw object BEFORE model_dump(),
                # because model_dump() strips Kimi-specific extra fields.
                reasoning_chunk: Optional[ChatGenerationChunk] = None
                if not isinstance(chunk, dict):
                    try:
                        choices = getattr(chunk, "choices", None) or []
                        if choices:
                            delta = getattr(choices[0], "delta", None)
                            if delta is not None:
                                rc = getattr(delta, "reasoning_content", None)
                                if rc:
                                    # Yield inline so reasoning streams to frontend
                                    # in real-time AND accumulates in additional_kwargs
                                    # for replay in subsequent turns.
                                    reasoning_chunk = ChatGenerationChunk(
                                        message=AIMessageChunk(
                                            content="",
                                            additional_kwargs={"reasoning_content": rc},
                                        )
                                    )
                    except Exception:
                        pass
                    chunk = chunk.model_dump()

                if reasoning_chunk is not None:
                    if run_manager:
                        await run_manager.on_llm_new_token("", chunk=reasoning_chunk)
                    yield reasoning_chunk

                generation_chunk = _convert_chunk_to_generation_chunk(
                    chunk,
                    default_chunk_class,
                    base_generation_info if is_first_chunk else {},
                )
                if generation_chunk is None:
                    continue

                default_chunk_class = generation_chunk.message.__class__
                logprobs = (generation_chunk.generation_info or {}).get("logprobs")
                if run_manager:
                    await run_manager.on_llm_new_token(
                        generation_chunk.text,
                        chunk=generation_chunk,
                        logprobs=logprobs,
                    )
                is_first_chunk = False
                yield generation_chunk


class KimiProvider(LangChainAdapter):
    """Kimi provider using Moonshot AI API (OpenAI-compatible)."""

    def __init__(
        self,
        api_key: str,
        model: str = "kimi-k2.5",
        base_url: str = "https://api.moonshot.ai/v1",
        max_tokens: int = 4096,
        temperature: float = 0.3,
        max_retries: int = 2,
        streaming: bool = True,
        stream_usage: bool = True,
        **kwargs,
    ):
        llm = KimiChatOpenAI(
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
