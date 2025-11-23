"""Graph Builder for LangGraph Agent.

Handles construction of the state graph with nodes and edges for agent orchestration.
"""

from typing import Literal
from langchain_core.messages import BaseMessage, SystemMessage, AIMessage
from langgraph.graph import StateGraph, END
from langgraph.prebuilt import ToolNode

from .state import AgentState
from .enums import GraphNode
from .agent_loader import AgentLoader
from .specialist_handler import SpecialistHandler
from ..tools.registry import ToolRegistry


class GraphBuilder:
    """Builds the LangGraph state graph for unified agent orchestration."""
    
    def __init__(
        self,
        llm,
        tool_registry: ToolRegistry,
        agent_loader: AgentLoader,
        specialist_handler: SpecialistHandler,
        system_prompt: str,
        max_iterations: int = 10,
        checkpointer = None,
    ):
        """Initialize graph builder.
        
        Args:
            llm: The base language model
            tool_registry: Registry of available tools
            agent_loader: Loader for sub-agents
            specialist_handler: Handler for specialist consultations
            system_prompt: System prompt for the agent
            max_iterations: Maximum iterations for ReAct loop
            checkpointer: Optional checkpointer for persistence
        """
        self.llm = llm
        self.tool_registry = tool_registry
        self.agent_loader = agent_loader
        self.specialist_handler = specialist_handler
        self.system_prompt = system_prompt
        self.max_iterations = max_iterations
        self.checkpointer = checkpointer
    
    def build(self):
        """Build unified LangGraph with both delegation and tool execution.
        
        Returns:
            Compiled graph ready for execution
        """
        # Get tools for main agent (only scope="global" or scope="both")
        # This ensures main agent CANNOT directly call assignable tools
        main_agent_tools = self.tool_registry.get_langchain_tools(scope_filter="global")
        
        # Rebind LLM with scope-filtered tools
        # This prevents the main agent from accessing assignable tools like query_patient_info
        if main_agent_tools:
            main_agent_llm = self.llm.bind_tools(main_agent_tools)
        else:
            main_agent_llm = self.llm
        
        # 1. Main Agent Node - Decides next action
        def agent_node(state: AgentState):
            """Main agent decides: use tools, delegate to specialists, or finish."""
            messages = state["messages"]
            
            # Build decision prompt with system prompt
            decision_context = self.agent_loader.build_decision_context(self.system_prompt)
            
            # Call LLM with ONLY global-scoped tools
            response = main_agent_llm.invoke(
                [SystemMessage(content=decision_context)] + messages
            )
            
            return {"messages": [response], "steps_taken": 1}
        
        # 2. Tool Execution Node
        # Create tool node from the same filtered tools
        tool_node = ToolNode(main_agent_tools) if main_agent_tools else None
        
        # 3. Sub-Agent Consultation Node (Async with Parallel Execution)
        async def sub_agent_consultation(state: AgentState):
            """Execute consultation with sub-agents IN PARALLEL when delegated.
            
            Uses fan-out/fan-in pattern with asyncio.gather for concurrent execution.
            """
            messages = state["messages"]
            last_message = messages[-1]
            
            # Check if last message requests specialist consultation
            specialists_needed = self.specialist_handler.extract_specialist_request(last_message)
            
            if not specialists_needed:
                return {"messages": [], "steps_taken": 0}
            
            # Get user's original query (shared across all specialists)
            user_messages = [m for m in messages if hasattr(m, '__class__') and m.__class__.__name__ == 'HumanMessage']
            if not user_messages:
                return {"messages": [], "steps_taken": 0}
            
            user_query = user_messages[-1]
            
            # Execute consultations in parallel
            final_responses = await self.specialist_handler.consult_specialists(
                specialists_needed,
                user_query
            )
            
            # Return messages using operator.add compatible format
            return {"messages": final_responses, "steps_taken": 1}
        
        # 4. Build the workflow
        workflow = StateGraph(AgentState)
        
        # Add nodes
        workflow.add_node(GraphNode.AGENT.value, agent_node)
        if tool_node:
            workflow.add_node(GraphNode.TOOLS.value, tool_node)
        workflow.add_node("sub_agents", sub_agent_consultation)
        
        # Set entry point
        workflow.set_entry_point(GraphNode.AGENT.value)
        
        # 5. Conditional routing logic
        def should_continue(state: AgentState) -> Literal["tools", "sub_agents", END]:
            """Decide next step: use tools, consult specialists, or finish."""
            messages = state["messages"]
            last_message = messages[-1]
            
            # Check iteration limit
            if state.get("steps_taken", 0) >= self.max_iterations:
                return END
            
            # Check for tool calls (ReAct pattern)
            if tool_node and hasattr(last_message, "tool_calls") and last_message.tool_calls:
                return GraphNode.TOOLS.value
            
            # Check for specialist consultation requests
            if self.specialist_handler.has_specialist_request(last_message):
                return "sub_agents"
            
            # Otherwise, we're done
            return END
        
        # Add conditional edges from main agent
        edges_map = {END: END}
        if tool_node:
            # Use string values for keys to avoid Enum hashing issues
            edges_map[GraphNode.TOOLS.value] = GraphNode.TOOLS.value
        edges_map["sub_agents"] = "sub_agents"
        
        workflow.add_conditional_edges(
            GraphNode.AGENT.value,
            should_continue,
            edges_map
        )
        
        # After tools, go back to agent
        if tool_node:
            workflow.add_edge(GraphNode.TOOLS.value, GraphNode.AGENT.value)
        
        # After sub-agent consultation, go back to agent
        workflow.add_edge("sub_agents", GraphNode.AGENT.value)
        
        # Compile the graph
        return workflow.compile(checkpointer=self.checkpointer)
