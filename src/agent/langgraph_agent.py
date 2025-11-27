"""Unified LangGraph Agent with Multi-Agent Orchestration and Tool Execution.

This agent combines:
1. Supervisor pattern: Delegates to specialized sub-agents from database
2. ReAct pattern: Directly executes common tools
3. Hybrid decision-making: Routes to specialists OR uses tools based on query
"""

import logging
from typing import Union, AsyncGenerator
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage

from .state import AgentState
from .agent_config import AgentConfig
from ..prompt.system import get_default_system_prompt
from .agent_loader import AgentLoader
from .specialist_handler import SpecialistHandler
from .graph_builder import GraphBuilder
from .response_generator import ResponseGenerator
from ..tools.registry import ToolRegistry

logger = logging.getLogger(__name__)


class LangGraphAgent:
    """Unified agent with multi-agent orchestration and tool execution.
    
    This agent can:
    - Delegate complex queries to specialized sub-agents (from database)
    - Execute common tools directly (ReAct pattern)
    - Combine multiple approaches for comprehensive answers
    """

    def __init__(
        self,
        llm_with_tools,
        system_prompt: str = None,
        memory_manager=None,
        user_id: str = "default",
        max_iterations: int = 10,
        use_persistence: bool = False,
        max_concurrent_subagents: int = 5,
        subagent_timeout: float = 30.0,
        fast_llm = None,  # Optional fast LLM for routing/classification
    ):
        """Initialize unified LangGraph agent.

        Args:
            llm_with_tools: LangChain LLM with tools bound
            system_prompt: Optional system prompt
            memory_manager: Optional Mem0 memory manager
            user_id: User identifier for memory
            max_iterations: Maximum iterations for ReAct loop
            use_persistence: Whether to use Postgres persistence
            max_concurrent_subagents: Maximum concurrent sub-agent consultations
            subagent_timeout: Timeout in seconds for sub-agent consultations
        """
        self.llm = llm_with_tools
        self.system_prompt = system_prompt or get_default_system_prompt()
        self.memory_manager = memory_manager
        
        # Initialize configuration
        self.config = AgentConfig(
            user_id=user_id,
            max_iterations=max_iterations,
            max_concurrent_subagents=max_concurrent_subagents,
            subagent_timeout=subagent_timeout,
            use_persistence=use_persistence,
        )
        
        # Initialize tool registry
        self.tool_registry = ToolRegistry()
        
        # Initialize agent loader
        self.agent_loader = AgentLoader()
        
        # Initialize specialist handler
        self.specialist_handler = SpecialistHandler(
            llm=self.llm,
            tool_registry=self.tool_registry,
            max_concurrent_subagents=max_concurrent_subagents,
            subagent_timeout=subagent_timeout,
        )
        
        # Initialize graph builder
        self.graph_builder = GraphBuilder(
            llm=self.llm,
            tool_registry=self.tool_registry,
            agent_loader=self.agent_loader,
            specialist_handler=self.specialist_handler,
            system_prompt=self.system_prompt,
            max_iterations=max_iterations,
            checkpointer=self.config.checkpointer,
            fast_llm=fast_llm,
        )
        
        # Build the initial graph
        self.graph = self.graph_builder.build()
        
        # Initialize response generator
        self.response_generator = ResponseGenerator(
            graph=self.graph,
            memory_manager=memory_manager,
            user_id=user_id,
        )
        
        logger.debug(
            "LangGraphAgent initialized for user=%s (max_iterations=%s, subagent_timeout=%s)",
            user_id,
            max_iterations,
            subagent_timeout,
        )
    
    async def _reload_graph(self, sub_agents: dict = None):
        """Reload the graph after loading sub-agents.

        Args:
            sub_agents: Optional dict of sub-agents to use. If provided,
                       updates the agent_loader's sub_agents.
        """
        # Update agent_loader's sub_agents if provided
        if sub_agents is not None:
            logger.debug("Reloading graph with %d sub-agents", len(sub_agents))
            self.agent_loader.sub_agents = sub_agents

        # Rebuild graph with updated sub-agents
        self.graph = self.graph_builder.build()
        logger.debug("Graph rebuilt successfully")
        # Update response generator with new graph
        self.response_generator.update_graph(self.graph)
    
    async def process_message(
        self,
        user_message: str,
        stream: bool = False,
        chat_history: list = None,
        patient_id: int = None,
        patient_name: str = None
    ) -> Union[str, AsyncGenerator[dict, None]]:
        """Process user message through unified agent.

        Args:
            user_message: User's input message
            stream: Whether to stream the response
            chat_history: Optional list of previous messages with 'role' and 'content' keys
            patient_id: Optional patient ID for context
            patient_name: Optional patient name for context

        Returns:
            Response string (non-streaming) or generator (streaming)
        """
        logger.info("Processing user message: %s (patient_id=%s)", user_message, patient_id)

        # Load sub-agents from database
        sub_agents = await self.agent_loader.load_enabled_agents()
        logger.debug("Loaded %d sub-agents", len(sub_agents))

        # Update specialist handler with loaded agents
        self.specialist_handler.set_sub_agents(sub_agents)
        logger.debug("Specialist handler updated with latest agents")

        # Rebuild graph with updated sub-agents (pass sub_agents explicitly)
        await self._reload_graph(sub_agents)
        
        # Retrieve memories if available
        memories = []
        if self.memory_manager:
            try:
                memories = self.memory_manager.search_memories(
                    query=user_message, user_id=self.config.user_id, limit=5
                )
            except Exception as e:
                logger.exception("Memory retrieval failed: %s", e)
            else:
                logger.debug("Retrieved %d relevant memories", len(memories))

        # Build initial state with messages
        messages = []

        # Add system prompt
        if self.system_prompt:
            messages.append(SystemMessage(content=self.system_prompt))

        # Add memory context if available
        if memories:
            memory_context = "\n".join([f"- {m}" for m in memories])
            messages.append(
                SystemMessage(
                    content=f"Relevant information from past:\n{memory_context}"
                )
            )
        
        # Add chat history if provided
        if chat_history:
            for msg in chat_history:
                if msg["role"] == "user":
                    messages.append(HumanMessage(content=msg["content"]))
                elif msg["role"] == "assistant":
                    messages.append(AIMessage(content=msg["content"]))

        # Add user message
        messages.append(HumanMessage(content=user_message))

        # Build patient profile if provided
        patient_profile = {}
        if patient_id and patient_name:
            patient_profile = {
                "id": patient_id,
                "name": patient_name
            }
            logger.info("Patient profile added: %s", patient_profile)

        initial_state = {
            "messages": messages,
            "patient_profile": patient_profile,
            "steps_taken": 0,
            "final_report": None,
            "next_agents": []
        }
        logger.debug(
            "Initial state prepared (history=%d, memories=%d, patient=%s)",
            len(messages),
            len(memories),
            patient_id or "None",
        )
        
        config = self.config.get_config()
        logger.debug("Agent config resolved: %s", config)

        if stream:
            logger.info("Streaming response enabled for message")
            return self.response_generator.stream_response(initial_state, config, user_message)
        else:
            logger.info("Generating standard response for message")
            return await self.response_generator.generate_response(initial_state, config, user_message)
    
    def __repr__(self) -> str:
        """String representation."""
        return f"LangGraphAgent(user_id={self.config.user_id}, sub_agents={len(self.agent_loader.sub_agents)}, tools={len(self.tool_registry.get_langchain_tools())})"
