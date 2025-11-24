"""Specialist Request Handler.

Handles parsing specialist consultation requests and executing them in parallel.
"""

import asyncio
import time
from typing import List
from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage, AIMessage, ToolMessage
from langchain_core.callbacks.manager import adispatch_custom_event

from ..tools.registry import ToolRegistry
from ..tools.executor import ToolExecutor


class SpecialistHandler:
    """Handles specialist consultation requests and parallel execution."""
    
    def __init__(
        self,
        llm,
        tool_registry: ToolRegistry,
        max_concurrent_subagents: int = 5,
        subagent_timeout: float = 30.0,
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
    
    async def consult_specialists(
        self,
        specialists_needed: List[str],
        user_query: HumanMessage
    ) -> List[BaseMessage]:
        """Execute consultation with specialists IN PARALLEL.
        
        Uses fan-out/fan-in pattern with asyncio.gather for concurrent execution.
        
        Args:
            specialists_needed: List of specialist roles to consult
            user_query: The user's query message
            
        Returns:
            List of BaseMessage responses from specialists
        """
        if not specialists_needed:
            return []
        
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
                
                # Dynamically fetch agent's tools from database
                t0 = time.time()
                agent_id = agent_info["id"]
                agent_tools = await self.tool_registry.get_langchain_tools_for_agent(agent_id)
                
                # Add global tools to sub-agent
                global_tools = self.tool_registry.get_langchain_tools(scope_filter="global")
                
                # Combine tools (avoid duplicates if any)
                all_tools = agent_tools + [t for t in global_tools if t.name not in [at.name for at in agent_tools]]
                
                duration = time.time() - t0
                await adispatch_custom_event(
                    "agent_log", 
                    {"message": "Inspecting tools", "duration": f"{duration:.1f}s", "level": "info"}
                )
                
                # Bind tools to LLM
                agent_llm = self.llm
                if all_tools:
                    agent_llm = self.llm.bind_tools(all_tools)
                
                # 1. First LLM Call (async)
                response = await agent_llm.ainvoke(
                    [specialist_prompt, user_query]
                )
                
                # 2. Handle Tool Calls (Single turn ReAct for Sub-Agent)
                if response.tool_calls:
                    # Execute tools
                    tool_executor = ToolExecutor(self.tool_registry)
                    tool_outputs = []
                    
                    for tool_call in response.tool_calls:
                        t_start = time.time()
                        await adispatch_custom_event(
                            "agent_log", 
                            {"message": f"Running {tool_call['name']}", "level": "info"}
                        )
                        
                        tool_result = tool_executor.execute(
                            tool_call["name"], 
                            tool_call["args"]
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
                    
                    # 3. Second LLM Call with Tool Outputs (async)
                    response = await agent_llm.ainvoke(
                        [specialist_prompt, user_query, response] + tool_outputs
                    )
                
                total_duration = time.time() - start_time
                await adispatch_custom_event(
                    "agent_log", 
                    {"message": f"Finished {specialist_role}", "duration": f"{total_duration:.1f}s", "level": "info"}
                )
                
                # Tag response with specialist name
                tagged_response = SystemMessage(
                    content=f"REPORT FROM SPECIALIST **[{agent_info['name']}]**:\n{response.content}"
                )
                return tagged_response
                
            except Exception as e:
                await adispatch_custom_event(
                    "agent_log", 
                    {"message": f"Error in {specialist_role}: {str(e)}", "level": "error"}
                )
                # Return error as SystemMessage to include in final response
                return SystemMessage(
                    content=f"REPORT FROM SPECIALIST **[{agent_info.get('name', specialist_role)}]**: Error during consultation - {str(e)}"
                )
        
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
                SystemMessage(content=f"REPORT FROM SPECIALIST **[Timeout]**: Sub-agent consultation exceeded {self.subagent_timeout}s timeout")
            ]
        
        # Process results - convert exceptions to error messages
        final_responses = []
        for i, result in enumerate(sub_responses):
            if isinstance(result, Exception):
                error_msg = SystemMessage(
                    content=f"REPORT FROM SPECIALIST **[{specialists_needed[i]}]**: Exception - {str(result)}"
                )
                final_responses.append(error_msg)
            else:
                final_responses.append(result)
        
        return final_responses
