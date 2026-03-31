"""request_specialist_team — convenes a multi-specialist team consultation.

Registered at import time with scope="global" so both the doctor agent
and the reception agent can call it.
"""
import logging

from src.tools.registry import ToolRegistry

logger = logging.getLogger(__name__)


async def request_specialist_team(case_summary: str, patient_id: int) -> str:
    """Convene a specialist team to deliberate on a patient case.

    Runs multi-round deliberation where specialists see each other's findings.
    A Chief Agent selects the team, steers the discussion, and synthesizes the output.

    Use this when:
    - A case requires input from multiple specialties
    - The doctor requests a team consultation
    - Reception flags a complex presentation during intake

    Args:
        case_summary: Description of the patient's presentation, symptoms, history,
                      and the key clinical question to resolve.
        patient_id: The patient's integer database ID.

    Returns:
        Formatted synthesis string:
            PRIMARY RECOMMENDATION: [...]
            CONFIDENCE: high|moderate|low
            SUPPORTING: [...]
            DISSENT: [...] or None
            CHIEF NOTES: [...] or None
    """
    from src.agent.team_consultation_handler import TeamConsultationHandler
    from src.api.dependencies import llm_provider

    # bind_tools() replaces self.llm with a RunnableBinding. Unwrap to get the
    # base ChatLLM so specialist calls produce plain-text responses, not tool calls.
    llm = llm_provider.llm
    while hasattr(llm, "bound"):
        llm = llm.bound

    handler = TeamConsultationHandler(llm=llm)
    return await handler.run(
        case_summary=case_summary,
        patient_id=patient_id,
        trigger="manual",
    )


ToolRegistry().register(
    request_specialist_team,
    scope="global",
    symbol="request_specialist_team",
    allow_overwrite=True,
)
