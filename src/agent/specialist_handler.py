"""Specialist Request Handler.

Handles parsing specialist consultation requests and executing them in parallel.
"""

import asyncio
import json
import logging
import re
import time
from typing import List
from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage, AIMessage, ToolMessage
from langchain_core.callbacks.manager import adispatch_custom_event

from ..tools.registry import ToolRegistry
from ..tools.executor import ToolExecutor
from ..tools.base import ToolResult
from ..prompt.templates import (
    format_specialist_report,
    format_specialist_error,
    format_specialist_timeout,
    format_specialist_exception
)
from .output_schemas import (
    get_output_schema_for_agent,
    format_internist_output
)

logger = logging.getLogger(__name__)


class SpecialistHandler:
    """Handles specialist consultation requests and parallel execution."""
    
    def __init__(
        self,
        llm,
        tool_registry: ToolRegistry,
        max_concurrent_subagents: int = 5,
        subagent_timeout: float = 120.0,
    ):
        """Initialize specialist handler.
        
        Args:
            llm: The language model to use for consultations
            tool_registry: Registry of available tools
            max_concurrent_subagents: Maximum concurrent consultations
            subagent_timeout: Timeout for consultations in seconds
        """
        self.llm = llm
        self.tool_registry = tool_registry
        self.max_concurrent_subagents = max_concurrent_subagents
        self.subagent_timeout = subagent_timeout
        self.sub_agents = {}
    
    def set_sub_agents(self, sub_agents: dict) -> None:
        """Update the sub-agents dictionary.
        
        Args:
            sub_agents: Dictionary of sub-agent configurations
        """
        self.sub_agents = sub_agents
    
    def has_specialist_request(self, message: BaseMessage) -> bool:
        """Check if message contains specialist consultation request.
        
        Args:
            message: The message to check
            
        Returns:
            True if message contains a CONSULT request
        """
        if not isinstance(message, AIMessage):
            return False
        
        content = message.content.lower()
        return "consult:" in content
    
    def extract_specialist_request(self, message: BaseMessage) -> List[str]:
        """Extract specialist roles from consultation request.
        
        Args:
            message: The message containing CONSULT request
            
        Returns:
            List of specialist roles to consult
        """
        if not isinstance(message, AIMessage):
            return []
        
        content = message.content.lower()
        
        # Look for "CONSULT: specialist_name"
        if "consult:" not in content:
            return []
        
        # Extract specialists using dynamic roles from loaded sub-agents
        specialists = []
        valid_roles = list(self.sub_agents.keys())
        
        for role in valid_roles:
            if role in content:
                specialists.append(role)
        
        return specialists

    def _parse_and_format_structured_output(
        self,
        response_content: str,
        agent_role: str,
        agent_name: str = None,
    ) -> str:
        """Parse structured JSON output and format it nicely.

        Args:
            response_content: The raw response content from the specialist
            agent_role: The role identifier of the agent
            agent_name: Display name of the agent

        Returns:
            Formatted report string
        """
        # Check if agent has a custom output schema
        schema_class = get_output_schema_for_agent(agent_role)

        if not schema_class:
            # No custom schema, return as-is
            return response_content

        try:
            # Try to extract JSON from response
            # Look for JSON code blocks first
            json_match = re.search(r'```json\s*(\{.*?\})\s*```', response_content, re.DOTALL)
            if json_match:
                json_str = json_match.group(1)
            else:
                # Try to find raw JSON object with more flexible regex
                # Look for any JSON object (starts with { and ends with })
                json_match = re.search(r'\{(?:[^{}]|(?:\{[^{}]*\}))*\}', response_content, re.DOTALL)
                if json_match:
                    json_str = json_match.group(0)
                else:
                    # No structured output found, return as-is
                    logger.warning(f"No structured output found for {agent_role}, using raw content")
                    return response_content

            # Parse JSON
            data = json.loads(json_str)

            # Format based on agent type
            if agent_role == "clinical_text":
                formatted = format_internist_output(data)
                logger.info(f"Successfully formatted structured output for {agent_role}")
                return formatted
            else:
                # Generic formatting for other agents with schemas
                return response_content

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse JSON from {agent_role}: {e}")
            logger.debug(f"Failed JSON content: {response_content[:200]}...")
            # Return original content without technical error for end user
            return response_content
        except ValueError as e:
            logger.error(f"Invalid output structure from {agent_role}: {e}")
            logger.debug(f"Validation failed for data: {json_str[:200] if 'json_str' in locals() else 'N/A'}...")
            # Return original content without technical error for end user
            return response_content
        except Exception as e:
            logger.error(f"Unexpected error formatting output from {agent_role}: {e}")
            logger.exception("Full traceback:")
            return response_content

    async def consult_specialists(
        self,
        specialists_needed: List[str],
        messages: List[BaseMessage],
        delegation_queries: dict = None,
        synthesize_response: bool = True
    ) -> List[BaseMessage]:
        """Execute consultation with specialists IN PARALLEL.
        
        Uses fan-out/fan-in pattern with asyncio.gather for concurrent execution.
        
        Args:
            specialists_needed: List of specialist roles to consult
            messages: The full conversation history
            delegation_queries: Optional dict mapping specialist role to specific query
            
        Returns:
            List of BaseMessage responses from specialists
        """
        if not specialists_needed:
            return []
        
        if delegation_queries is None:
            delegation_queries = {}
        
        # Define async consultation function for a single specialist
        async def consult_single_specialist(specialist_role: str) -> BaseMessage:
            """Consult a single specialist asynchronously."""
            start_time = time.time()
            await adispatch_custom_event(
                "agent_log", 
                {"message": f"Investigating {specialist_role}...", "level": "info"}
            )
            
            agent_info = self.sub_agents.get(specialist_role)
            if not agent_info:
                await adispatch_custom_event(
                    "agent_log", 
                    {"message": f"Agent {specialist_role} not found", "level": "error"}
                )
                return AIMessage(
                    content=f"**[{specialist_role}]**: Specialist not available"
                )
            
            await adispatch_custom_event(
                "agent_log", 
                {"message": "Listed agent", "level": "info"}
            )
            
            try:
                # Create specialist prompt
                specialist_prompt = SystemMessage(content=agent_info["system_prompt"])
                
                # Dynamically fetch agent's tools
                t0 = time.time()
                agent_tools = []
                
                # Check if agent has hardcoded tools (Core Agent)
                if "tools" in agent_info and agent_info["tools"]:
                    logger.debug(
                        "Using hardcoded tools for %s: %s", specialist_role, agent_info["tools"]
                    )
                    agent_tools = self.tool_registry.get_tools_by_symbols(agent_info["tools"])
                else:
                    # Fetch from DB for custom agents
                    agent_id = agent_info["id"]
                    agent_tools = await self.tool_registry.get_langchain_tools_for_agent(agent_id)
                
                logger.debug(
                    "Fetched %d agent-specific tools for %s",
                    len(agent_tools),
                    specialist_role,
                )

                # Add assignable tools to sub-agent
                # Sub-agents should get:
                # - Tools with scope="assignable" (sub-agent only tools)
                # They should NOT get:
                # - Tools with scope="global" (main agent only, includes delegation tools)
                assignable_tools = self.tool_registry.get_langchain_tools(scope_filter="assignable")

                # Combine tools (avoid duplicates)
                all_tools = agent_tools.copy()
                existing_names = {t.name for t in all_tools}

                for tool in assignable_tools:
                    if tool.name not in existing_names:
                        all_tools.append(tool)
                        existing_names.add(tool.name)
                
                logger.debug(
                    "Total tools for %s: %d (%s)",
                    specialist_role,
                    len(all_tools),
                    [t.name for t in all_tools],
                )
                
                duration = time.time() - t0
                await adispatch_custom_event(
                    "agent_log", 
                    {"message": "Inspecting tools", "duration": f"{duration:.1f}s", "level": "info"}
                )
                
                # Bind tools to LLM
                agent_llm = self.llm
                if all_tools:
                    agent_llm = self.llm.bind_tools(all_tools)
                    logger.debug("Bound %d tools to LLM for %s", len(all_tools), specialist_role)
                else:
                    logger.debug("No tools to bind for %s", specialist_role)
                
                # Determine which query to use for this specialist
                # Use delegation query if provided, otherwise use original messages
                input_messages = messages
                
                if specialist_role in delegation_queries:
                    # Create a new HumanMessage with the delegation-specific query
                    from langchain_core.messages import HumanMessage
                    specialist_query = HumanMessage(content=delegation_queries[specialist_role])
                    # Create a new list with the delegation query appended
                    input_messages = messages + [specialist_query]
                
                # 1. First LLM Call (async)
                logger.debug("Starting first LLM call for %s", specialist_role)
                response = await agent_llm.ainvoke(
                    [specialist_prompt] + input_messages
                )
                logger.debug(
                    "First LLM response received for %s (tool_calls=%s)",
                    specialist_role,
                    bool(getattr(response, "tool_calls", None)),
                )
                if hasattr(response, 'tool_calls') and response.tool_calls:
                    logger.debug(
                        "Tool calls: %s",
                        [tc["name"] for tc in response.tool_calls],
                    )
                
                # 2. Handle Tool Calls (Single turn ReAct for Sub-Agent)
                if response.tool_calls:
                    logger.debug(
                        "LLM made %d tool calls for %s",
                        len(response.tool_calls),
                        specialist_role,
                    )
                    for tc in response.tool_calls:
                        logger.debug("Tool call detail: %s args=%s", tc["name"], tc.get("args", {}))
                    
                    # Execute tools
                    tool_executor = ToolExecutor(self.tool_registry)
                    tool_outputs = []
                    found_patient_profile = None
                    
                    for tool_call in response.tool_calls:
                        t_start = time.time()
                        await adispatch_custom_event(
                            "agent_log", 
                            {"message": f"Running {tool_call['name']}", "level": "info"}
                        )
                        
                        # Check tool type to decide execution strategy
                        tool_type = self.tool_registry.get_tool_type(tool_call["name"])
                        
                        if tool_type == "api":
                            # Run API calls in thread to avoid blocking event loop
                            tool_result = await asyncio.to_thread(
                                tool_executor.execute,
                                tool_call["name"], 
                                tool_call["args"]
                            )
                        else:
                            # Run local functions directly
                            tool_result = tool_executor.execute(
                                tool_call["name"], 
                                tool_call["args"]
                            )
                        
                        # Check for patient info in tool result
                        if tool_call["name"] == "query_patient_basic_info" and tool_result.success:
                            # Parse: "Patient Found: {name} (ID: {id})"
                            import re
                            match = re.search(r"Patient Found: (.+?) \(ID: (\d+)\)", str(tool_result.data))
                            if match:
                                found_patient_profile = {
                                    "name": match.group(1),
                                    "id": int(match.group(2))
                                }
                                logger.info("Found patient profile in tool output: %s", found_patient_profile)
                        
                        logger.debug(
                            "Executed tool %s (success=%s)",
                            tool_call["name"],
                            tool_result.success,
                        )
                        if not tool_result.success:
                            logger.error(
                                "Tool %s failed: %s",
                                tool_call["name"],
                                tool_result.error,
                            )
                        
                        t_end = time.time()
                        await adispatch_custom_event(
                            "agent_log", 
                            {"message": f"Read {tool_call['name']}", "duration": f"{t_end - t_start:.1f}s", "level": "info"}
                        )
                        
                        tool_outputs.append(
                            ToolMessage(
                                content=str(tool_result.data) if tool_result.success else str(tool_result.error),
                                tool_call_id=tool_call["id"]
                            )
                        )
                    
                    if synthesize_response:
                        # 3. Second LLM Call with Tool Outputs (async)
                        logger.debug("Starting second LLM call with tool outputs for %s", specialist_role)
                        response = await agent_llm.ainvoke(
                            [specialist_prompt] + input_messages + [response] + tool_outputs
                        )
                        logger.debug("Second LLM response received for %s", specialist_role)
                    else:
                        # Skip second LLM call, return tool outputs directly
                        logger.debug("Skipping second LLM call for %s", specialist_role)
                        # Create a summary message with tool outputs
                        tool_results_str = "\n".join([str(t.content) for t in tool_outputs])
                        response = AIMessage(content=f"Tool execution completed. Results:\n{tool_results_str}")
                else:
                    logger.debug("No tool calls made by %s - responding directly", specialist_role)
                    found_patient_profile = None
                
                total_duration = time.time() - start_time
                await adispatch_custom_event(
                    "agent_log",
                    {"message": f"Finished {specialist_role}", "duration": f"{total_duration:.1f}s", "level": "info"}
                )

                # Parse and format structured output if applicable
                formatted_content = self._parse_and_format_structured_output(
                    response.content,
                    specialist_role,
                    agent_info['name']
                )

                # Tag response with specialist name
                tagged_response = SystemMessage(
                    content=format_specialist_report(agent_info['name'], formatted_content)
                )
                
                # Print response for debugging
                print(f"\n\n=== SUB-AGENT RESPONSE ({specialist_role}) ===\n{tagged_response.content}\n============================================\n")

                # Attach patient profile if found
                if found_patient_profile:
                    tagged_response.additional_kwargs["patient_profile"] = found_patient_profile
                    
                return tagged_response
                
            except Exception as e:
                await adispatch_custom_event(
                    "agent_log", 
                    {"message": f"Error in {specialist_role}: {str(e)}", "level": "error"}
                )
                # Return error as SystemMessage to include in final response
                error_response = SystemMessage(
                    content=format_specialist_error(agent_info.get('name', specialist_role), str(e))
                )
                print(f"\n\n=== SUB-AGENT ERROR ({specialist_role}) ===\n{error_response.content}\n=========================================\n")
                return error_response
        
        # FAN-OUT: Launch all specialist consultations concurrently
        # Use semaphore to limit concurrent executions
        semaphore = asyncio.Semaphore(self.max_concurrent_subagents)
        
        async def consult_with_limit(specialist_role: str):
            """Wrapper to apply concurrency limit."""
            async with semaphore:
                return await consult_single_specialist(specialist_role)
        
        tasks = [consult_with_limit(role) for role in specialists_needed]
        
        # FAN-IN: Gather all results with timeout protection
        try:
            sub_responses = await asyncio.wait_for(
                asyncio.gather(*tasks, return_exceptions=True),
                timeout=self.subagent_timeout
            )
        except asyncio.TimeoutError:
            # Handle timeout - return partial results
            sub_responses = [
                SystemMessage(content=format_specialist_timeout(self.subagent_timeout))
            ]
        
        # Process results - convert exceptions to error messages
        final_responses = []
        for i, result in enumerate(sub_responses):
            if isinstance(result, Exception):
                error_msg = SystemMessage(
                    content=format_specialist_exception(specialists_needed[i], str(result))
                )
                final_responses.append(error_msg)
            else:
                final_responses.append(result)
        
        return final_responses
