"""Response Generator for LangGraph Agent.

Handles both streaming and non-streaming response generation with memory management.
"""

import logging
from typing import AsyncGenerator, Optional
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage

from ..utils.enums import MessageRole

logger = logging.getLogger(__name__)


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
        logger.debug("ResponseGenerator graph reference updated")
    
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
        logger.info("Generating response via LangGraph")
        # Invoke the graph
        final_state = await self.graph.ainvoke(initial_state, config=config)
        logger.debug("Graph execution complete for non-streaming response")
        
        # Extract response from final state
        response_content = final_state["messages"][-1].content
        logger.info("Response ready with %d chars", len(response_content or ""))
        
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
                logger.debug("Conversation stored in memory for user_id=%s", self.user_id)
            except Exception as e:
                logger.exception("Memory storage failed: %s", e)
        
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
        logger.info("Streaming response via LangGraph")
        final_content = []

        # State for filtering CONSULT commands
        buffer = ""
        checking_consult = True
        is_consult = False

        # Track patient profile and references at function scope
        patient_profile = None
        patient_refs_emitted = set()

        # Check for patient profile in initial state
        if "patient_profile" in initial_state and initial_state["patient_profile"]:
            patient_profile = initial_state["patient_profile"]
            logger.info("✅ Patient profile found in initial state: %s", patient_profile)

        # Stream through the graph events
        async for event in self.graph.astream_events(initial_state, config=config, version="v2"):
            # Check if the event updates the state with patient profile
            if event.get("event") == "on_chain_end":
                output = event.get("data", {}).get("output", {})
                if output and isinstance(output, dict) and "patient_profile" in output:
                    patient_profile = output["patient_profile"]
                    logger.info("✅ ResponseGenerator detected patient_profile update: %s", patient_profile)
                
            event_type = event.get("event")
            
            # Handle custom log events
            if event_type == "on_custom_event" and event.get("name") == "agent_log":
                yield {
                    "type": "log",
                    "content": event["data"]
                }
            
            # Handle streaming content from the main agent
            elif event_type == "on_chat_model_stream":
                # Only yield content from nodes that generate final responses
                # These nodes are: "direct_answer" and "synthesis"
                node = event.get("metadata", {}).get("langgraph_node")
                if node in ["direct_answer", "synthesis"]:
                    data = event["data"]
                    if "chunk" in data:
                        chunk = data["chunk"]
                        if hasattr(chunk, "content") and chunk.content:
                            content = chunk.content
                            
                            # Filter out CONSULT commands
                            if is_consult:
                                continue
                                
                            if checking_consult:
                                buffer += content
                                # Check if buffer matches "CONSULT:" pattern
                                # We allow leading whitespace
                                stripped_buffer = buffer.lstrip()
                                target = "CONSULT:"
                                
                                if len(stripped_buffer) >= len(target):
                                    if stripped_buffer.upper().startswith(target):
                                        is_consult = True
                                        checking_consult = False
                                        buffer = "" # Discard buffer
                                    else:
                                        # Not a command
                                        checking_consult = False
                                        # Flush buffer
                                        final_content.append(buffer)
                                        yield {
                                            "type": "content",
                                            "content": buffer
                                        }
                                        buffer = ""
                                else:
                                    # Buffer too short, check if it COULD be a command
                                    current_upper = stripped_buffer.upper()
                                    if not target.startswith(current_upper):
                                        # Diverged
                                        checking_consult = False
                                        final_content.append(buffer)
                                        yield {
                                            "type": "content",
                                            "content": buffer
                                        }
                                        buffer = ""
                                    # Else: matches so far, keep buffering
                            else:
                                final_content.append(content)
                                yield {
                                    "type": "content",
                                    "content": content
                                }

                                # Check for patient name in content to generate references
                                if patient_profile and "name" in patient_profile:
                                    p_name = patient_profile["name"]
                                    logger.debug("🔍 Checking for patient name '%s' in content", p_name)

                                    # Simple check: if name is in the total accumulated text
                                    current_full_text = "".join(final_content)
                                    if p_name in current_full_text and p_name not in patient_refs_emitted:
                                        # Calculate indices
                                        start_idx = current_full_text.find(p_name)
                                        end_idx = start_idx + len(p_name)

                                        # Emit reference event
                                        logger.info("✅ Emitting patient reference for '%s' at indices %d-%d", p_name, start_idx, end_idx)
                                        yield {
                                            "type": "patient_references",
                                            "patient_references": [{
                                                "patient_id": patient_profile["id"],
                                                "patient_name": p_name,
                                                "start_index": start_idx,
                                                "end_index": end_idx
                                            }]
                                        }
                                        patient_refs_emitted.add(p_name)
                                    else:
                                        logger.debug("❌ Patient name '%s' not found in text or already emitted (in_text=%s, already_emitted=%s)",
                                                   p_name, p_name in current_full_text, p_name in patient_refs_emitted)
            
            elif event_type == "on_chat_model_end":
                node = event.get("metadata", {}).get("langgraph_node")
                if node in ["direct_answer", "synthesis"]:
                    # End of a turn
                    if checking_consult and buffer:
                        # Flush remaining buffer if we were still checking
                        final_content.append(buffer)
                        yield {
                            "type": "content",
                            "content": buffer
                        }
                    
                    # Reset for next potential turn
                    buffer = ""
                    checking_consult = True
                    is_consult = False
            
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
                logger.debug("Stored streamed conversation for user_id=%s", self.user_id)
            except Exception as e:
                logger.exception("Memory storage failed: %s", e)
