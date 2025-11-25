"""Graph Builder for LangGraph Agent.

Handles construction of the state graph with nodes and edges for agent orchestration.
"""

import logging

from langchain_core.messages import BaseMessage, SystemMessage, AIMessage, HumanMessage
from langgraph.graph import StateGraph, END
from langchain_core.prompts import ChatPromptTemplate

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
        """Build unified LangGraph with specialist routing."""
        logger.debug("Building LangGraph workflow")
        
        # 1. Specialist Router Node (Medical Query Detection + Routing)
        def specialist_router_node(state: AgentState):
            """Classify query and route medical queries to appropriate specialist."""
            import time
            start_time = time.time()
            messages = state["messages"]
            last_message = messages[-1]
            logger.info("[SPECIALIST_ROUTER] START - Analyzing query: %s", last_message.content[:100])
            
            # Step 1: Classify if medical or non-medical
            classifier_prompt = ChatPromptTemplate.from_messages([
                ("system", "Classify the query as 'MEDICAL' or 'NON_MEDICAL'.\n\n"
                           "MEDICAL queries include:\n"
                           "- Questions about patients, medical records, diagnoses, treatments\n"
                           "- Symptoms, diseases, test results, procedures\n"
                           "- Clinical data, prescriptions, medical history\n\n"
                           "NON_MEDICAL queries include:\n"
                           "- General conversations, greetings, jokes\n"
                           "- Non-healthcare topics, coding, technical questions\n\n"
                           "Respond ONLY with 'MEDICAL' or 'NON_MEDICAL'."),
                ("user", "{query}")
            ])
            
            classification = self.fast_llm.invoke(
                classifier_prompt.format_messages(query=last_message.content)
            )
            is_medical = classification.content.strip().upper() == "MEDICAL"
            logger.info("[SPECIALIST_ROUTER] Classification: %s", "MEDICAL" if is_medical else "NON_MEDICAL")
            
            if not is_medical:
                # Non-medical query - mark for direct answer
                duration = time.time() - start_time
                logger.info("[SPECIALIST_ROUTER] DONE - Non-medical query, routing to direct answer in %.2fs", duration)
                return {"target_specialist": "non_medical", "is_medical": False}
            
            # Step 2: For medical queries, select appropriate specialist
            available_agents = list(self.agent_loader.sub_agents.keys())
            logger.info("[SPECIALIST_ROUTER] Routing to specialist (available=%s)", ", ".join(available_agents))
            
            router_prompt = ChatPromptTemplate.from_messages([
                ("system", f"You are a medical router. Available specialists: {', '.join(available_agents)}. "
                           "Select the ONE best specialist to handle the user's medical request. "
                           "Respond ONLY with the exact name of the specialist."),
                ("user", "{query}")
            ])
            
            response = self.fast_llm.invoke(
                router_prompt.format_messages(query=last_message.content)
            )
            target_specialist = response.content.strip()
            
            # Validation
            if target_specialist not in available_agents:
                logger.warning(
                    "[SPECIALIST_ROUTER] Invalid specialist '%s' selected. Defaulting to first available.",
                    target_specialist,
                )
                target_specialist = available_agents[0] if available_agents else None
            
            duration = time.time() - start_time
            logger.info("[SPECIALIST_ROUTER] DONE - Selected: %s in %.2fs", target_specialist, duration)
            return {"target_specialist": target_specialist, "is_medical": True}

        # 2. Direct Answer Node (for non-medical queries)
        async def direct_answer_node(state: AgentState):
            """Handle non-medical queries directly."""
            import time
            start_time = time.time()
            messages = state["messages"]
            logger.info("[DIRECT_ANSWER] START - Handling non-medical query")
            
            # Simple direct response using the LLM with async invoke for streaming support
            response = await self.llm.ainvoke(
                [SystemMessage(content=self.system_prompt)] + messages
            )
            
            duration = time.time() - start_time
            logger.info("[DIRECT_ANSWER] DONE - Generated response in %.2fs", duration)
            return {"messages": [response], "final_report": response.content}

        # 3. Sub-Agent Node
        async def sub_agent_node(state: AgentState):
            """Execute the selected specialist."""
            import time
            start_time = time.time()
            target_specialist = state.get("target_specialist")
            messages = state["messages"]
            user_query = messages[-1] # Assuming last message is user query
            logger.info("[SUB_AGENT] START - Invoking specialist: %s", target_specialist)
            
            if not target_specialist:
                logger.warning("[SUB_AGENT] No specialist available")
                return {"messages": [AIMessage(content="No specialist available.")]}
            
            # Use existing specialist handler
            # It expects a list of specialists
            responses = await self.specialist_handler.consult_specialists(
                specialists_needed=[target_specialist],
                user_query=user_query,
                synthesize_response=False
            )
            
            # Extract patient info from tool outputs if available
            patient_profile = {}
            
            for response in responses:
                # Check for patient profile in additional_kwargs (populated by SpecialistHandler)
                if hasattr(response, "additional_kwargs") and "patient_profile" in response.additional_kwargs:
                    patient_profile = response.additional_kwargs["patient_profile"]
                    logger.info("[SUB_AGENT] Found patient profile in message kwargs: %s", patient_profile)
                    break
            
            duration = time.time() - start_time
            logger.info("[SUB_AGENT] DONE - Received %d responses in %.2fs", len(responses), duration)
            
            # Return updates to state
            return {
                "messages": responses, 
                "patient_profile": patient_profile
            }

        # 4. Synthesis Node
        async def synthesis_node(state: AgentState):
            """Synthesize the final answer from specialist response."""
            import time
            start_time = time.time()
            messages = state["messages"]
            # The last message should be the specialist's response (SystemMessage or AIMessage)
            specialist_response = messages[-1]
            logger.info("[SYNTHESIS] START - Aggregating specialist response (length=%d chars)", len(specialist_response.content))
            
            synthesis_prompt = ChatPromptTemplate.from_messages([
                ("system", "You are a medical assistant helping healthcare providers access patient information. "
                           "Synthesize the following specialist report into a clear, professional summary. "
                           "Your audience is a DOCTOR or HEALTHCARE PROVIDER, not the patient. "
                           "Use third-person perspective when referring to the patient (e.g., 'Patient X is...', 'The patient has...', 'Patient records show...'). "
                           "Maintain medical accuracy and use appropriate clinical terminology. "
                           "Respond in your own words, do not copy the specialist's phrasing. "
                           "DO NOT address the patient directly or use greetings like 'Dear [Patient Name]'."),
                ("user", "Specialist Report: {report}")
            ])
            
            # Use main LLM (not fast_llm) for better quality synthesis and streaming support
            chain = synthesis_prompt | self.llm
            response = await chain.ainvoke({"report": specialist_response.content})
            
            duration = time.time() - start_time
            logger.info("[SYNTHESIS] DONE - Generated response (%d chars) in %.2fs", len(response.content), duration)
            return {"messages": [response], "final_report": response.content}

        # Build Workflow
        workflow = StateGraph(AgentState)
        
        # Add nodes
        workflow.add_node("specialist_router", specialist_router_node)
        workflow.add_node("direct_answer", direct_answer_node)
        workflow.add_node("sub_agent", sub_agent_node)
        workflow.add_node("synthesis", synthesis_node)
        
        # Set entry point to specialist router (handles classification + routing)
        workflow.set_entry_point("specialist_router")
        
        # Conditional routing after specialist_router
        def route_after_classification(state: AgentState):
            """Route based on whether query is medical or not."""
            target_specialist = state.get("target_specialist")
            if target_specialist == "non_medical":
                return "direct_answer"
            return "sub_agent"
        
        workflow.add_conditional_edges(
            "specialist_router",
            route_after_classification,
            {
                "direct_answer": "direct_answer",
                "sub_agent": "sub_agent"
            }
        )
        
        # Medical Flow: specialist_router -> sub_agent -> synthesis -> END
        workflow.add_edge("sub_agent", "synthesis")
        workflow.add_edge("synthesis", END)
        
        # Non-medical Flow: specialist_router -> direct_answer -> END
        workflow.add_edge("direct_answer", END)
        
        logger.debug("LangGraph workflow built")
        return workflow.compile(checkpointer=self.checkpointer)
