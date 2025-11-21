"""Core agent implementation."""

from typing import Iterator, Optional, Any
import logging

from ..context.manager import ContextManager
from ..llm.provider import LLMProvider, Message
from ..tools.registry import ToolRegistry
from ..tools.executor import ToolExecutor
from ..utils.errors import AIAgentError
from ..utils.logging import setup_logger

logger = setup_logger(__name__)


class Agent:
    """Main AI agent class."""

    def __init__(
        self,
        llm_provider: LLMProvider,
        context_manager: ContextManager | None = None,
        system_prompt: str | None = None,
        max_tool_iterations: int = 5,
        memory_manager: Optional[Any] = None,
        user_id: str = "default",
    ):
        """Initialize agent.

        Args:
            llm_provider: LLM provider instance
            context_manager: Context manager instance (optional)
            system_prompt: System prompt to use (optional)
            max_tool_iterations: Maximum number of tool execution iterations (default: 5)
            memory_manager: Long-term memory manager instance (optional)
            user_id: User identifier for memory isolation (default: "default")
        """
        self.llm_provider = llm_provider
        self.context = context_manager or ContextManager()
        self.system_prompt = system_prompt
        self.max_tool_iterations = max_tool_iterations
        self.memory_manager = memory_manager
        self.user_id = user_id

        # Initialize tool system
        self.tool_registry = ToolRegistry()
        self.tool_executor = ToolExecutor(self.tool_registry)

        # Bind tools to LLM if provider supports it
        if hasattr(self.llm_provider, 'bind_tools'):
            tools = self.tool_registry.get_all_tools()
            if tools:
                self.llm_provider.bind_tools(tools)
                logger.info(f"Bound {len(tools)} tools to LLM: {self.tool_registry.list_tools()}")

        # Set token counter for context manager
        self.context.set_token_counter(self.llm_provider.count_tokens)

        # Add system prompt if provided
        if system_prompt:
            self.context.add_message("system", system_prompt)

        logger.info("Agent initialized")

    def refresh_tools(self) -> None:
        """Refresh tools from registry and re-bind to LLM."""
        if hasattr(self.llm_provider, 'bind_tools'):
            tools = self.tool_registry.get_all_tools()
            if tools:
                self.llm_provider.bind_tools(tools)
                logger.debug(f"Refreshed tools: {len(tools)} available")

    def process_message(self, user_message: str, stream: bool = False) -> str | Iterator[dict]:
        """Process a user message and return response.

        Args:
            user_message: User's message
            stream: Whether to stream the response

        Returns:
            Assistant's response (string or iterator of dicts if streaming)

        Raises:
            AIAgentError: If processing fails
        """
        try:
            # Refresh tools to pick up any dynamically added ones
            self.refresh_tools()

            # Retrieve relevant long-term memories if memory manager is available
            if self.memory_manager:
                try:
                    memories = self.memory_manager.search_memories(
                        query=user_message,
                        user_id=self.user_id,
                        limit=5
                    )

                    if memories:
                        memory_context = "\n".join([f"- {m}" for m in memories])
                        memory_msg = (
                            f"Relevant information from past interactions:\n{memory_context}"
                        )
                        self.context.add_message("system", memory_msg)
                        logger.debug(f"Added {len(memories)} relevant memories to context")
                except Exception as e:
                    logger.warning(f"Failed to retrieve memories: {e}")

            # Add user message to context
            self.context.add_message("user", user_message)
            logger.info(f"Processing user message (length: {len(user_message)} chars)")

            if stream:
                return self._process_message_stream()
            else:
                return self._process_message_sync(user_message)

        except Exception as e:
            logger.error(f"Error processing message: {str(e)}")
            raise AIAgentError(f"Failed to process message: {str(e)}") from e

    def _process_message_sync(self, user_message: str) -> str:
        """Process message synchronously (original logic)."""
        # Tool execution loop (ReAct pattern)
        iteration = 0
        while iteration < self.max_tool_iterations:
            iteration += 1
            logger.debug(f"Tool execution loop iteration {iteration}/{self.max_tool_iterations}")

            # Get messages for API call
            messages = self.context.get_messages()

            # Generate response
            response = self.llm_provider.generate(messages)

            # Check if LLM wants to call tools
            if response.tool_calls and len(response.tool_calls) > 0:
                logger.info(f"LLM requested {len(response.tool_calls)} tool calls")

                # Add assistant message with tool calls to context
                # Add assistant message with tool calls to context
                self.context.add_message(
                    "assistant", 
                    response.content or "",
                    tool_calls=response.tool_calls
                )

                # Execute each tool call
                for tool_call in response.tool_calls:
                    tool_name = tool_call.get("name")
                    tool_args = tool_call.get("args", {})
                    tool_call_id = tool_call.get("id", "")

                    logger.debug(f"Executing tool: {tool_name} with args: {tool_args}")

                    # Execute tool
                    result = self.tool_executor.execute(tool_name, tool_args)

                    # Add tool result to context
                    self.context.add_message(
                        role="tool",
                        content=result.to_string(),
                        tool_call_id=tool_call_id
                    )

                    logger.debug(f"Tool {tool_name} result: {result.to_string()}")

                # Continue loop to let LLM process tool results
                continue

            # No tool calls - we have the final response
            self.context.add_message("assistant", response.content)

            # Store conversation in long-term memory
            if self.memory_manager:
                try:
                    messages = [
                        {"role": "user", "content": user_message},
                        {"role": "assistant", "content": response.content}
                    ]
                    self.memory_manager.add_conversation(
                        user_id=self.user_id,
                        messages=messages
                    )
                    logger.debug("Stored conversation in long-term memory")
                except Exception as e:
                    logger.warning(f"Failed to store conversation in memory: {e}")

            # Log usage
            logger.info(
                f"Response generated after {iteration} iterations. Tokens: "
                f"input={response.usage['input_tokens']}, "
                f"output={response.usage['output_tokens']}"
            )

            return response.content

        # Max iterations reached
        logger.warning(f"Max tool iterations ({self.max_tool_iterations}) reached")
        return "Sorry, I exceeded the maximum number of tool executions. Please try rephrasing your question."

    def _process_message_stream(self) -> Iterator[dict]:
        """Process message with streaming, including tool events.

        Yields:
            Dicts with type 'tool_call', 'tool_result', or 'content'
        """
        iteration = 0
        while iteration < self.max_tool_iterations:
            iteration += 1
            logger.debug(f"Stream loop iteration {iteration}/{self.max_tool_iterations}")

            messages = self.context.get_messages()
            
            # For now, we don't stream the tool decision part itself from the LLM 
            # because most providers don't stream tool calls nicely mixed with content yet.
            # We'll generate the response to check for tools.
            response = self.llm_provider.generate(messages)

            if response.tool_calls and len(response.tool_calls) > 0:
                logger.info(f"LLM requested {len(response.tool_calls)} tool calls (streaming)")
                
                # Add assistant message (even if empty content)
                # Add assistant message (even if empty content)
                self.context.add_message(
                    "assistant", 
                    response.content or "",
                    tool_calls=response.tool_calls
                )
                
                # Yield tool calls
                for tool_call in response.tool_calls:
                    yield {
                        "type": "tool_call",
                        "tool": tool_call.get("name"),
                        "args": tool_call.get("args"),
                        "id": tool_call.get("id")
                    }

                # Execute tools
                for tool_call in response.tool_calls:
                    tool_name = tool_call.get("name")
                    tool_args = tool_call.get("args", {})
                    tool_call_id = tool_call.get("id", "")

                    result = self.tool_executor.execute(tool_name, tool_args)
                    
                    # Yield result
                    yield {
                        "type": "tool_result",
                        "tool": tool_name,
                        "result": result.to_string(),
                        "id": tool_call_id
                    }

                    self.context.add_message(
                        role="tool",
                        content=result.to_string(),
                        tool_call_id=tool_call_id
                    )
                
                # Continue to next iteration
                continue
            
            # Final response - stream it
            # We can't easily stream the *exact* response object we just got if we want token-by-token.
            # But we know it's the final answer.
            # If we want true streaming of the final answer, we should call stream() here.
            # But we already called generate() above. 
            # Optimization: If we want true streaming, we should probably try to stream() first, 
            # and if it turns out to be a tool call, handle it. 
            # But Gemini's stream() doesn't always make tool parsing easy.
            # For now, let's just yield the content chunk-by-chunk from the generated response 
            # to simulate streaming, OR call stream() again (wasteful).
            # Better: Just yield the content as one big chunk or split it.
            # OR: Use stream() initially and accumulate.
            
            # Let's try to use stream() for the final response to give that "typing" feel
            # We know there are no tools now (or we hope so, based on the generate() check).
            # Actually, calling generate() then stream() is double cost.
            # Let's just yield the content we have.
            # Final response - stream it
            # Use stream() to get reasoning and token-by-token output
            # We already checked for tools with generate(), so we assume this is the final answer.
            # This allows us to capture "reasoning" events from providers that support it.
            full_content = ""
            for chunk in self.llm_provider.stream(messages):
                if isinstance(chunk, dict):
                    yield chunk
                    # Accumulate content
                    if chunk.get("type") == "content":
                        full_content += chunk["content"]
                else:
                    # Legacy string chunk
                    yield {"type": "content", "content": chunk}
                    full_content += chunk
            
            if full_content:
                self.context.add_message("assistant", full_content)
            
            return

        yield {"type": "content", "content": "Sorry, I exceeded the maximum number of tool executions."}

    def clear_context(self, keep_system: bool = True) -> None:
        """Clear conversation context.

        Args:
            keep_system: Whether to keep system messages
        """
        if keep_system and self.system_prompt:
            self.context.clear()
            self.context.add_message("system", self.system_prompt)
            logger.info("Context cleared (system prompt retained)")
        else:
            self.context.clear()
            logger.info("Context cleared completely")

    def get_context_info(self) -> dict:
        """Get information about current context.

        Returns:
            Dict with context information
        """
        return {
            "message_count": len(self.context),
            "token_count": self.context.count_tokens(),
            "last_message": self.context.get_last_message(),
        }

    def __repr__(self) -> str:
        """String representation.

        Returns:
            String representation of agent
        """
        return f"Agent(messages={len(self.context)}, tokens≈{self.context.count_tokens()})"
