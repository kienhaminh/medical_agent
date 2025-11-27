"""Response Generator for LangGraph Agent.

Handles both streaming and non-streaming response generation with memory management.
"""

import logging
from typing import AsyncGenerator, Optional
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage

from ..utils.enums import MessageRole
from .patient_detector import PatientDetector

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

        # Track patient profile and detector
        patient_profile = None
        patient_detector = PatientDetector()
        all_detected_refs = []

        # Check for patient profile in initial state
        if "patient_profile" in initial_state and initial_state["patient_profile"]:
            patient_profile = initial_state["patient_profile"]
            logger.info("✅ Patient profile found in initial state: %s", patient_profile)

            # Cache the context patient for faster detection
            if "id" in patient_profile and "name" in patient_profile:
                from ..config.database import Patient
                patient_obj = Patient(
                    id=patient_profile["id"],
                    name=patient_profile["name"]
                )
                patient_detector._patient_cache[patient_obj.id] = patient_obj

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
                # In new graph, "agent" node generates content OR tool calls
                node = event.get("metadata", {}).get("langgraph_node")
                if node == "agent":
                    data = event["data"]
                    if "chunk" in data:
                        chunk = data["chunk"]

                        # Check for usage in chunk (for OpenAI-compatible APIs with stream_usage=True)
                        if hasattr(chunk, "usage_metadata") and chunk.usage_metadata:
                            usage_meta = chunk.usage_metadata
                            logger.info("✅✅✅ Usage metadata found in stream chunk: %s", usage_meta)
                            # Convert to standard format
                            usage = {
                                "prompt_tokens": getattr(usage_meta, "input_tokens", 0),
                                "completion_tokens": getattr(usage_meta, "output_tokens", 0),
                                "total_tokens": getattr(usage_meta, "total_tokens", 0)
                            }
                            if usage["total_tokens"] > 0:
                                yield {
                                    "type": "usage",
                                    "usage": usage
                                }

                        if hasattr(chunk, "content") and chunk.content:
                            content = chunk.content
                            final_content.append(content)
                            yield {
                                "type": "content",
                                "content": content
                            }

                            # Detect patient references in accumulated text
                            # Only check periodically to avoid performance issues
                            if len(final_content) % 50 == 0 or len(content) > 100:
                                current_full_text = "".join(final_content)
                                logger.info(f"🔍 Running patient detection (chunks={len(final_content)}, text_len={len(current_full_text)}, has_patient={patient_profile is not None})")

                                # Use enhanced patient detector
                                context_patient_id = patient_profile.get("id") if patient_profile else None
                                detected_refs = patient_detector.detect_in_text_sync(
                                    text=current_full_text,
                                    patient_id=context_patient_id,
                                    patient_name=patient_profile.get("name") if patient_profile else None
                                )
                                logger.info(f"🔍 Detection result: {len(detected_refs)} references found")

                                # Only emit new references (not already emitted)
                                new_refs = []
                                for ref in detected_refs:
                                    # Check if this reference is new
                                    is_new = True
                                    for existing in all_detected_refs:
                                        if (existing.patient_id == ref.patient_id and
                                            existing.start_index == ref.start_index):
                                            is_new = False
                                            break

                                    if is_new:
                                        new_refs.append(ref)
                                        all_detected_refs.append(ref)

                                # Emit new references
                                if new_refs:
                                    logger.info(f"✅ Emitting {len(new_refs)} new patient reference(s)")
                                    yield {
                                        "type": "patient_references",
                                        "patient_references": [ref.to_dict() for ref in new_refs]
                                    }
            
            # Handle tool calls
            elif event_type == "on_tool_start":
                data = event.get("data", {})
                name = event.get("name")
                run_id = event.get("run_id")
                
                # Filter out internal tools if necessary, but generally we want to show all tools
                yield {
                    "type": "tool_call",
                    "id": run_id,
                    "tool": name,
                    "args": data.get("input")
                }

            elif event_type == "on_tool_end":
                data = event.get("data", {})
                run_id = event.get("run_id")
                output = data.get("output")
                
                yield {
                    "type": "tool_result",
                    "id": run_id,
                    "result": str(output)
                }

            # Handle token usage from model end events
            elif event_type == "on_chat_model_end":
                # logger.info("✅ on_chat_model_end event detected!")
                output = event.get("data", {}).get("output")
                # logger.info(f"Output type: {type(output)}")
                # logger.info(f"Output hasattr response_metadata: {hasattr(output, 'response_metadata') if output else False}")

                if output:
                    # Try to get usage from response_metadata (standard in LangChain)
                    usage = None
                    if hasattr(output, "response_metadata"):
                        # logger.info(f"response_metadata: {output.response_metadata}")
                        usage = output.response_metadata.get("token_usage") or output.response_metadata.get("usage")

                    # If not found, check if it's a dict (sometimes happens in raw outputs)
                    if not usage and isinstance(output, dict):
                         usage = output.get("token_usage") or output.get("usage")

                    if usage:
                        logger.info("✅✅✅ Token usage detected: %s", usage)
                        yield {
                            "type": "usage",
                            "usage": usage
                        }
                    else:
                        logger.warning("⚠️ No usage found in on_chat_model_end event")

        # Final comprehensive patient detection after streaming completes
        if final_content and patient_profile:
            full_text = "".join(final_content)
            context_patient_id = patient_profile.get("id") if patient_profile else None
            logger.info(f"🎯 Final patient detection (text_len={len(full_text)}, patient_id={context_patient_id})")

            # Do final comprehensive detection
            final_refs = patient_detector.detect_in_text_sync(
                text=full_text,
                patient_id=context_patient_id,
                patient_name=patient_profile.get("name") if patient_profile else None
            )
            logger.info(f"🎯 Final detection found {len(final_refs)} total references")

            # Find any new references that weren't caught during streaming
            new_final_refs = []
            for ref in final_refs:
                is_new = True
                for existing in all_detected_refs:
                    if (existing.patient_id == ref.patient_id and
                        existing.start_index == ref.start_index):
                        is_new = False
                        break

                if is_new:
                    new_final_refs.append(ref)
                    all_detected_refs.append(ref)

            # Emit any remaining new references
            if new_final_refs:
                logger.info(f"✅ Emitting {len(new_final_refs)} final patient reference(s)")
                yield {
                    "type": "patient_references",
                    "patient_references": [ref.to_dict() for ref in new_final_refs]
                }

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
