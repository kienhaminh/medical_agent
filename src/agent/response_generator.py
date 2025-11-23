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
    ) -> AsyncGenerator[str, None]:
        """Generate streaming response.
        
        Args:
            initial_state: Initial graph state
            config: Configuration for graph execution
            user_message: The user's message
            
        Yields:
            Chunks of the response content
        """
        final_content = []
        
        # Stream through the graph (use async iteration)
        async for chunk in self.graph.astream(initial_state, config=config, stream_mode="values"):
            if "messages" in chunk and chunk["messages"]:
                last_message = chunk["messages"][-1]
                
                # Only yield AI message content
                if isinstance(last_message, AIMessage) and last_message.content:
                    # Check if we've already yielded this content
                    if last_message.content not in final_content:
                        final_content.append(last_message.content)
                        yield last_message.content
        
        # Store in memory after streaming completes
        if self.memory_manager and final_content:
            try:
                response_text = final_content[-1] if final_content else ""
                self.memory_manager.add_conversation(
                    user_id=self.user_id,
                    messages=[
                        {"role": MessageRole.USER, "content": user_message},
                        {"role": MessageRole.ASSISTANT, "content": response_text},
                    ],
                )
            except Exception as e:
                print(f"Memory storage failed: {e}")
