"""Agent state definition."""

from typing import TypedDict, Annotated, List, Union
import operator

class AgentState(TypedDict):
    """State of the agent."""
    # The conversation history (Append-only)
    messages: Annotated[List[dict], operator.add]
    # Structured data for the patient context
    patient_profile: dict
    # Internal tracking for the reasoning loop
    steps_taken: int
    # Final output for the frontend
    final_report: Union[str, None]
    # Required by create_react_agent for step limiting
    remaining_steps: int
