"""Response Generator for LangGraph Agent.

Handles both streaming and non-streaming response generation with memory management.
"""

from typing import AsyncGenerator, Optional
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage

from ..utils.enums import MessageRole


class ResponseGenerator:
    """Generates responses from the agent graph."""
    
    def __init__(
        self,
        graph,
        memory_manager=None,
        user_id: str = "default",
    ):
        """Initialize response generator.
        
        Args:
            graph: The compiled LangGraph
            memory_manager: Optional memory manager for conversation storage
            user_id: User identifier for memory
        """
        self.graph = graph
        self.memory_manager = memory_manager
        self.user_id = user_id
    
    def update_graph(self, graph):
        """Update the graph reference.
        
        Args:
            graph: The new compiled graph
        """
        self.graph = graph
    
    async def generate_response(
        self,
        initial_state: dict,
        config: dict,
        user_message: str
    ) -> str:
        """Generate non-streaming response.
        
        Args:
            initial_state: Initial graph state
            config: Configuration for graph execution
            user_message: The user's message
            
        Returns:
            The generated response content
        """
        # Invoke the graph
        final_state = await self.graph.ainvoke(initial_state, config=config)
        
        # Extract response from final state
        response_content = final_state["messages"][-1].content
        
        # Store in memory if available
        if self.memory_manager:
            try:
                self.memory_manager.add_conversation(
                    user_id=self.user_id,
                    messages=[
                        {"role": MessageRole.USER, "content": user_message},
                        {"role": MessageRole.ASSISTANT, "content": response_content},
                    ],
                )
            except Exception as e:
                print(f"Memory storage failed: {e}")
        
        return response_content
    
    async def stream_response(
        self,
        initial_state: dict,
        config: dict,
        user_message: str
    ) -> AsyncGenerator[dict, None]:
        """Generate streaming response.
        
        Args:
            initial_state: Initial graph state
            config: Configuration for graph execution
            user_message: The user's message
            
        Yields:
            Chunks of the response content and log events
        """
        final_content = []
        
        # Stream through the graph events
        async for event in self.graph.astream_events(initial_state, config=config, version="v2"):
            event_type = event.get("event")
            
            # Handle custom log events
            if event_type == "on_custom_event" and event.get("name") == "agent_log":
                yield {
                    "type": "log",
                    "content": event["data"]
                }
            
            # Handle streaming content from the main agent
            elif event_type == "on_chat_model_stream":
                # Only yield content from the main agent node to avoid showing sub-agent internal thoughts as final response
                # The main agent node is named "agent" in graph_builder.py
                if event.get("metadata", {}).get("langgraph_node") == "agent":
                    data = event["data"]
                    if "chunk" in data:
                        chunk = data["chunk"]
                        if hasattr(chunk, "content") and chunk.content:
                            content = chunk.content
                            final_content.append(content)
                            yield {
                                "type": "content",
                                "content": content
                            }
            
            # Handle tool calls (if we want to show them as they happen)
            elif event_type == "on_tool_start":
                # We can yield tool calls if needed, but chat.py handles tool_call events from the stream
                # For now, let's stick to what chat.py expects or just logs
                pass

        # Store in memory after streaming completes
        if self.memory_manager and final_content:
            try:
                response_text = "".join(final_content)
                self.memory_manager.add_conversation(
                    user_id=self.user_id,
                    messages=[
                        {"role": MessageRole.USER, "content": user_message},
                        {"role": MessageRole.ASSISTANT, "content": response_text},
                    ],
                )
            except Exception as e:
                print(f"Memory storage failed: {e}")
