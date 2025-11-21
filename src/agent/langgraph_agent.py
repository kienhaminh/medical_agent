"""LangGraph-based agent with ReAct pattern."""

from typing import Annotated, Sequence
from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage, AIMessage
from langgraph.graph import StateGraph, END, MessagesState
from langgraph.prebuilt import ToolNode


class LangGraphAgent:
    """Agent using LangGraph for orchestration with ReAct pattern.

    Uses LangGraph's StateGraph to implement a ReAct (Reasoning and Acting)
    pattern with automatic tool execution and state management.

    Architecture:
        User → Agent Node (LLM) → Conditional Edge
                                    ↓
                        Tools? → ToolNode → Back to Agent
                                    ↓
                        No tools? → END
    """

    def __init__(
        self,
        llm_with_tools,
        system_prompt: str = None,
        memory_manager=None,
        user_id: str = "default",
        max_iterations: int = 5,
    ):
        """Initialize LangGraph agent.

        Args:
            llm_with_tools: LangChain LLM with tools already bound
            system_prompt: Optional system prompt
            memory_manager: Optional Mem0 memory manager
            user_id: User identifier for memory
            max_iterations: Maximum tool execution iterations
        """
        self.llm = llm_with_tools
        self.system_prompt = system_prompt
        self.memory_manager = memory_manager
        self.user_id = user_id
        self.max_iterations = max_iterations

        # Build the LangGraph workflow
        self.graph = self._build_graph()

    def _build_graph(self):
        """Build LangGraph StateGraph with ReAct pattern."""

        # Define the agent node
        def call_model(state: MessagesState):
            """Agent node: invoke LLM with current state."""
            messages = state["messages"]
            response = self.llm.invoke(messages)
            return {"messages": [response]}

        # Create tool node (handles all tool execution automatically)
        tools = self.llm.tools if hasattr(self.llm, "tools") else []
        tool_node = ToolNode(tools) if tools else None

        # Define conditional edge logic
        def should_continue(state: MessagesState):
            """Decide whether to continue to tools or end.

            Checks if the last message has tool calls.
            """
            messages = state["messages"]
            last_message = messages[-1]

            # If there are tool calls, go to tools node
            if hasattr(last_message, "tool_calls") and last_message.tool_calls:
                return "tools"

            # Otherwise, end
            return END

        # Build the graph
        workflow = StateGraph(MessagesState)

        # Add nodes
        workflow.add_node("agent", call_model)
        if tool_node:
            workflow.add_node("tools", tool_node)

        # Set entry point
        workflow.set_entry_point("agent")

        # Add conditional edges
        if tool_node:
            workflow.add_conditional_edges(
                "agent",
                should_continue,
                {
                    "tools": "tools",
                    END: END,
                },
            )
            # After tools, always go back to agent
            workflow.add_edge("tools", "agent")
        else:
            # No tools, just end after agent
            workflow.add_edge("agent", END)

        # Compile the graph
        return workflow.compile()

    def process_message(self, user_message: str, stream: bool = False):
        """Process user message through LangGraph.

        Args:
            user_message: User's input message
            stream: Whether to stream the response

        Returns:
            Response string (non-streaming) or generator (streaming)
        """
        # Retrieve memories if available
        memories = []
        if self.memory_manager:
            try:
                memories = self.memory_manager.search_memories(
                    query=user_message, user_id=self.user_id, limit=5
                )
            except Exception as e:
                print(f"Memory retrieval failed: {e}")

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

        # Add user message
        messages.append(HumanMessage(content=user_message))

        initial_state = {"messages": messages}

        if stream:
            return self._stream_response(initial_state, user_message)
        else:
            return self._generate_response(initial_state, user_message)

    def _generate_response(self, initial_state, user_message):
        """Generate non-streaming response.

        Args:
            initial_state: Initial LangGraph state
            user_message: Original user message

        Returns:
            Response content string
        """
        # Invoke the graph
        final_state = self.graph.invoke(initial_state)

        # Extract response from final state
        response_content = final_state["messages"][-1].content

        # Store in memory if available
        if self.memory_manager:
            try:
                self.memory_manager.add_conversation(
                    user_id=self.user_id,
                    messages=[
                        {"role": "user", "content": user_message},
                        {"role": "assistant", "content": response_content},
                    ],
                )
            except Exception as e:
                print(f"Memory storage failed: {e}")

        return response_content

    def _stream_response(self, initial_state, user_message):
        """Generate streaming response.

        Args:
            initial_state: Initial LangGraph state
            user_message: Original user message

        Yields:
            Content chunks as they arrive
        """
        final_content = []

        # Stream through the graph
        for chunk in self.graph.stream(initial_state, stream_mode="values"):
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
                        {"role": "user", "content": user_message},
                        {"role": "assistant", "content": response_text},
                    ],
                )
            except Exception as e:
                print(f"Memory storage failed: {e}")

    def __repr__(self) -> str:
        """String representation."""
        return f"LangGraphAgent(user_id={self.user_id})"
