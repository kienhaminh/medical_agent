"""Unified LangGraph Agent with Multi-Agent Orchestration and Tool Execution.

This agent combines:
1. Supervisor pattern: Delegates to specialized sub-agents from database
2. ReAct pattern: Directly executes common tools
3. Hybrid decision-making: Routes to specialists OR uses tools based on query
4. Skill-based orchestration: Uses SkillOrchestrator for query routing
"""

import logging
from typing import Union, AsyncGenerator, Optional
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage

from .state import AgentState
from .agent_config import AgentConfig
from ..prompt.system import get_default_system_prompt, build_specialist_list_message
from ..utils.token_budget import trim_to_token_budget, count_message_tokens, count_text_tokens
from .agent_loader import AgentLoader
from .specialist_handler import SpecialistHandler
from .graph_builder import GraphBuilder
from .response_generator import ResponseGenerator
from .skill_orchestrator import SkillOrchestrator
from .skill_selector import SkillSelector
from ..tools.registry import ToolRegistry
from ..tools.pool import ToolPool

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
        use_skill_orchestrator: bool = True,  # Enable skill-based orchestration
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
            use_skill_orchestrator: Whether to use new skill-based orchestration
        """
        self.llm = llm_with_tools
        self.system_prompt = system_prompt or get_default_system_prompt()
        self.memory_manager = memory_manager
        self.use_skill_orchestrator = use_skill_orchestrator
        
        # Initialize configuration
        self.config = AgentConfig(
            user_id=user_id,
            max_iterations=max_iterations,
            max_concurrent_subagents=max_concurrent_subagents,
            subagent_timeout=subagent_timeout,
            use_persistence=use_persistence,
        )
        
        # Initialize tool registry (legacy support)
        self.tool_registry = ToolRegistry()
        
        # Initialize skill-based components (new)
        if use_skill_orchestrator:
            self.skill_selector = SkillSelector()
            self.skill_orchestrator = SkillOrchestrator(
                skill_selector=self.skill_selector
            )
            self.tool_pool = ToolPool()
            # Load tools from skills into pool
            self._load_skill_tools()
            logger.info("Skill-based orchestration enabled")
        else:
            self.skill_selector = None
            self.skill_orchestrator = None
            self.tool_pool = None
        
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
            "LangGraphAgent initialized for user=%s (max_iterations=%s, subagent_timeout=%s, skills=%s)",
            user_id,
            max_iterations,
            subagent_timeout,
            use_skill_orchestrator,
        )
    
    def _load_skill_tools(self) -> None:
        """Load tools from skills into the tool pool."""
        from ..skills.registry import SkillRegistry
        
        registry = SkillRegistry()
        # Discover skills if not already loaded
        if not registry.get_all_skills():
            import os
            skills_dir = os.path.join(
                os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                "skills"
            )
            registry.discover_skills(skills_dir)
        
        # Register tools from skills
        for skill in registry.get_all_skills():
            self.tool_pool.register_from_skill(skill)
        
        logger.debug(f"Loaded {len(self.tool_pool.list_tools())} tools from skills")
    
    def get_tools_for_query(self, query: str) -> list:
        """Get relevant tools for a query using skill orchestration.
        
        Args:
            query: User query string
            
        Returns:
            List of relevant tool functions
        """
        if self.use_skill_orchestrator and self.skill_orchestrator:
            return self.skill_orchestrator.get_tools_for_query(query)
        else:
            # Fallback to legacy tool registry
            return self.tool_registry.get_langchain_tools()
    
    def explain_skill_selection(self, query: str) -> dict:
        """Explain which skills were selected for a query.
        
        Args:
            query: User query string
            
        Returns:
            Explanation of skill selection
        """
        if self.use_skill_orchestrator and self.skill_orchestrator:
            return self.skill_orchestrator.explain_selection(query)
        return {"error": "Skill orchestrator not enabled"}
    
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
        # Order: static system prompt → specialist list → memory → history → user message
        # Static prefix is byte-identical across requests → provider caches it.
        messages = []

        # 1. Static system prompt (never changes — provider caches this prefix)
        if self.system_prompt:
            messages.append(SystemMessage(content=self.system_prompt))

        # 2. Specialist list (separate message so static prefix stays cacheable)
        if sub_agents:
            specialist_list_content = build_specialist_list_message(sub_agents)
            messages.append(SystemMessage(content=specialist_list_content))

        # 3. Memory context — deduplicated and capped at 500 tokens
        if memories:
            # Deduplicate: keep first occurrence of each unique memory (relevance-ordered)
            seen: set = set()
            unique_memories = []
            for m in memories:
                key = m.strip().lower()
                if key not in seen:
                    seen.add(key)
                    unique_memories.append(m)

            # Cap at 500 tokens — drop lowest-relevance (end of list) first
            capped_memories = []
            token_total = 0
            for m in unique_memories:
                t = count_text_tokens(m)
                if token_total + t <= 500:
                    capped_memories.append(m)
                    token_total += t
                else:
                    break

            if capped_memories:
                memory_context = "\n".join([f"- {m}" for m in capped_memories])
                messages.append(
                    SystemMessage(content=f"Relevant information from past:\n{memory_context}")
                )

        # 4. Chat history — trimmed to 2,000-token budget
        if chat_history:
            history_messages = []
            for msg in chat_history:
                if msg["role"] == "user":
                    history_messages.append(HumanMessage(content=msg["content"]))
                elif msg["role"] == "assistant":
                    history_messages.append(AIMessage(content=msg["content"]))
            history_messages = trim_to_token_budget(history_messages, budget=2000)
            messages.extend(history_messages)

        # 5. Current user message
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
