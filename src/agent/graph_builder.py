"""Graph Builder for LangGraph Agent.

Handles construction of the state graph with nodes and edges for agent orchestration.
"""

import logging

from langchain_core.messages import BaseMessage, SystemMessage, AIMessage, HumanMessage
from langgraph.graph import StateGraph, END
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder

from .state import AgentState
from .agent_loader import AgentLoader
from .specialist_handler import SpecialistHandler
from ..tools.registry import ToolRegistry

logger = logging.getLogger(__name__)


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
        fast_llm = None,  # Optional fast LLM for routing/classification
    ):
        """Initialize graph builder."""
        self.llm = llm
        self.fast_llm = fast_llm or llm  # Use fast LLM if provided, otherwise use main LLM
        if fast_llm:
            logger.info("GraphBuilder initialized with fast_llm (model: %s)", 
                       getattr(fast_llm, 'model_name', 'unknown'))
        else:
            logger.warning("GraphBuilder: No fast_llm provided, will use main LLM for routing (SLOW!)")
        self.tool_registry = tool_registry
        self.agent_loader = agent_loader
        self.specialist_handler = specialist_handler
        self.system_prompt = system_prompt
        self.max_iterations = max_iterations
        self.checkpointer = checkpointer
    
    def build(self):
        """Build unified LangGraph with Main Agent + Tools architecture."""
        logger.debug("Building LangGraph workflow")
        
        from langchain_core.tools import tool
        from langgraph.prebuilt import ToolNode
        
        # 1. Define Delegation Tool
        @tool
        async def delegate_to_specialist(specialist_name: str, query: str) -> str:
            """Delegate a specific medical query to a specialist.

            Use this tool when you need to consult a medical specialist for a patient-related query.
            The specialist will execute independently and return a final report.

            Args:
                specialist_name: The name or role of the specialist.
                               Available specialists: {available_agents}
                query: The specific query or task for the specialist.

            Returns:
                The specialist's final report.
            """
            logger.info(f"[DELEGATION] Delegating to {specialist_name} with query: {query}")

            # Map human-readable names to role IDs
            # This allows LLM to use natural names like "internist" instead of "clinical_text"
            name_to_role = {}
            role_to_name = {}
            for role, info in self.agent_loader.sub_agents.items():
                agent_name = info.get("name", "").lower()
                name_to_role[agent_name] = role
                role_to_name[role] = info.get("name", role)

            # Normalize specialist_name to lowercase for matching
            specialist_name_lower = specialist_name.lower()

            # Try to resolve to role ID
            # 1. Check if it's already a role ID
            if specialist_name in self.agent_loader.sub_agents:
                resolved_role = specialist_name
            # 2. Check if it matches a name
            elif specialist_name_lower in name_to_role:
                resolved_role = name_to_role[specialist_name_lower]
                logger.info(f"[DELEGATION] Resolved '{specialist_name}' to role '{resolved_role}'")
            else:
                # Not found - provide helpful error
                available = ", ".join([f"{role_to_name.get(r, r)} ({r})" for r in self.agent_loader.sub_agents.keys()])
                return f"Specialist '{specialist_name}' not found. Available specialists: {available}"

            # Create a dummy message to pass to consult_specialists
            # The handler expects a list of messages, and we want to pass the specific query
            # We can construct a HumanMessage with the query
            from langchain_core.messages import HumanMessage

            try:
                responses = await self.specialist_handler.consult_specialists(
                    specialists_needed=[resolved_role],
                    messages=[HumanMessage(content=query)],
                    delegation_queries={resolved_role: query},
                    synthesize_response=True
                )

                # The response is a list of messages. We want the content of the last one (the report).
                if responses:
                    final_response = responses[-1]
                    return final_response.content
                return "Specialist did not return a response."

            except Exception as e:
                logger.error(f"Error in delegation: {e}")
                return f"Error consulting specialist: {str(e)}"

        # Update docstring with available agents - show both role and name
        available_agents_list = []
        for role, info in self.agent_loader.sub_agents.items():
            agent_name = info.get("name", role)
            available_agents_list.append(f"{agent_name} ({role})")

        delegate_to_specialist.description = delegate_to_specialist.description.format(
            available_agents=", ".join(available_agents_list)
        )

        # 2. Prepare Tools
        # Main agent gets global tools + delegation tool
        global_tools = self.tool_registry.get_langchain_tools(scope_filter="global")
        all_tools = global_tools + [delegate_to_specialist]
        
        # 3. Main Agent Node
        async def main_agent_node(state: AgentState):
            """Main Agent that handles conversation and tool delegation."""
            messages = state["messages"]
            
            # Bind tools to LLM
            agent_llm = self.llm.bind_tools(all_tools)
            
            # Invoke LLM
            response = await agent_llm.ainvoke(
                [SystemMessage(content=self.system_prompt)] + messages
            )
            
            return {"messages": [response]}

        # 4. Tools Node
        tools_node = ToolNode(all_tools)

        # 5. Build Workflow
        workflow = StateGraph(AgentState)
        
        workflow.add_node("agent", main_agent_node)
        workflow.add_node("tools", tools_node)
        
        workflow.set_entry_point("agent")
        
        # Conditional edge from agent to tools or END
        def should_continue(state: AgentState):
            messages = state["messages"]
            last_message = messages[-1]
            if last_message.tool_calls:
                return "tools"
            return END
            
        workflow.add_conditional_edges(
            "agent",
            should_continue,
            {
                "tools": "tools",
                END: END
            }
        )
        
        workflow.add_edge("tools", "agent")
        
        logger.debug("LangGraph workflow built (Main Agent + Tools)")
        return workflow.compile(checkpointer=self.checkpointer)
