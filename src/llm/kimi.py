"""Kimi (Moonshot AI) provider."""

import os
from typing import Optional, Iterator, Union
from .provider import Message

from .langchain_adapter import LangChainAdapter
from langchain_openai import ChatOpenAI


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
        **kwargs,
    ):
        """Initialize Kimi provider.

        Args:
            api_key: Moonshot API key
            model: Model name (default: kimi-k2-thinking)
            base_url: API base URL (default: https://api.moonshot.ai/v1)
            max_tokens: Maximum tokens to generate
            temperature: Sampling temperature
            max_retries: Maximum number of retries
            streaming: Enable streaming responses
            **kwargs: Additional parameters
        """
        llm = ChatOpenAI(
            model=model,
            api_key=api_key,
            base_url=base_url,
            temperature=temperature,
            max_tokens=max_tokens,
            max_retries=max_retries,
            streaming=streaming,
            **kwargs,
        )
        
        super().__init__(llm)
        
        self.api_key = api_key
        self.base_url = base_url
        self.model = model
        self.temperature = temperature
        self.max_tokens = max_tokens
        self.max_retries = max_retries


    def generate(self, messages: list[Message], **kwargs):
        """Generate a response from Kimi with reasoning content support.
        
        Args:
            messages: List of chat messages
            **kwargs: Additional parameters
            
        Returns:
            LLMResponse with content and metadata
        """
        from openai import OpenAI
        from .provider import LLMResponse
        import json
        
        client = OpenAI(
            api_key=self.api_key,
            base_url=self.base_url,
        )
        
        # Convert messages
        lc_messages = self._convert_messages(messages)
        formatted_messages = []
        for msg in lc_messages:
            role = "user"
            if msg.type == "system":
                role = "system"
            elif msg.type == "ai":
                role = "assistant"
            elif msg.type == "tool":
                role = "tool"
                
            formatted_msg = {"role": role, "content": msg.content}
            if role == "tool":
                formatted_msg["tool_call_id"] = msg.tool_call_id
            elif role == "assistant" and hasattr(msg, "tool_calls") and msg.tool_calls:
                formatted_msg["tool_calls"] = [
                    {
                        "id": tc["id"],
                        "type": "function",
                        "function": {
                            "name": tc["name"],
                            "arguments": json.dumps(tc["args"]) if isinstance(tc["args"], dict) else str(tc["args"])
                        }
                    }
                    for tc in msg.tool_calls
                ]
            formatted_messages.append(formatted_msg)

        # Create completion
        response = client.chat.completions.create(
            model=self.model,
            messages=formatted_messages,
            temperature=self.temperature,
            max_tokens=self.max_tokens,
            **kwargs
        )
        
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

        # Extract usage
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
        """Bind tools to LLM for function calling.

        Args:
            tools: List of LangChain tool objects
        """
        self.llm = self.llm.bind_tools(tools)

    def stream(self, messages: list[Message], **kwargs) -> Iterator[Union[str, dict]]:
        """Stream response from Kimi with reasoning content support.
        
        Args:
            messages: List of chat messages
            **kwargs: Additional parameters
            
        Yields:
            Structured events:
            - {"type": "reasoning", "content": "..."}
            - {"type": "content", "content": "..."}
            - {"type": "tool_call", ...} (from parent)
        """
        # Use raw OpenAI client for Kimi to access reasoning_content
        from openai import OpenAI
        
        client = OpenAI(
            api_key=self.api_key,
            base_url=self.base_url,
        )
        
        # Convert messages
        lc_messages = self._convert_messages(messages)
        formatted_messages = []
        for msg in lc_messages:
            role = "user"
            if msg.type == "system":
                role = "system"
            elif msg.type == "ai":
                role = "assistant"
            elif msg.type == "tool":
                role = "tool"
                
            formatted_msg = {"role": role, "content": msg.content}
            if role == "tool":
                formatted_msg["tool_call_id"] = msg.tool_call_id
            elif role == "assistant" and hasattr(msg, "tool_calls") and msg.tool_calls:
                import json
                formatted_msg["tool_calls"] = [
                    {
                        "id": tc["id"],
                        "type": "function",
                        "function": {
                            "name": tc["name"],
                            "arguments": json.dumps(tc["args"]) if isinstance(tc["args"], dict) else str(tc["args"])
                        }
                    }
                    for tc in msg.tool_calls
                ]
            formatted_messages.append(formatted_msg)

        # Create stream
        stream = client.chat.completions.create(
            model=self.model,
            messages=formatted_messages,
            stream=True,
            temperature=self.temperature,
            max_tokens=self.max_tokens,
            **kwargs
        )
        
        for chunk in stream:
            delta = chunk.choices[0].delta
            
            # Handle reasoning content
            if hasattr(delta, "reasoning_content") and delta.reasoning_content:
                yield {
                    "type": "reasoning", 
                    "content": delta.reasoning_content
                }
                
            # Handle standard content
            if delta.content:
                yield {
                    "type": "content",
                    "content": delta.content
                }
