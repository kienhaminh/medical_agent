# eval/doctor_simulator.py
from dataclasses import dataclass

from eval.api_client import EvalApiClient

DDX_PROMPT = (
    "Look up this patient's current visit brief and medical history, then generate a "
    "differential diagnosis based on the chief complaint and presentation. "
    "Include ICD-10 codes and rank each diagnosis by likelihood (High/Medium/Low)."
)
HISTORY_PROMPT = (
    "Retrieve and analyze this patient's full medical history from the EHR. "
    "Summarize all chronic conditions, current medications with dosages, allergies, "
    "and flag any clinical red flags or drug interactions of concern."
)
SOAP_PROMPT = (
    "Look up this patient's current visit details including the chief complaint and "
    "intake notes, then write a complete SOAP note with clearly labeled "
    "Subjective, Objective, Assessment, and Plan sections."
)


@dataclass
class DoctorResult:
    ddx_output: str
    history_output: str
    soap_output: str
    session_id: int | None


class DoctorSimulator:
    def __init__(self, client: EvalApiClient) -> None:
        self._client = client

    async def run(self, patient_id: int, visit_id: int | None = None, verbose: bool = False) -> DoctorResult:
        """Fire DDx, history analysis, and SOAP note requests in parallel. Returns all outputs."""
        import asyncio

        # Include visit_id explicitly so the agent doesn't have to infer it
        visit_context = f" Use visit_id={visit_id} for the pre_visit_brief lookup." if visit_id else ""

        # All three are independent — run concurrently with separate sessions
        ddx_event, history_event, soap_event = await asyncio.gather(
            self._client.chat(
                message=DDX_PROMPT + visit_context,
                patient_id=patient_id,
                visit_id=visit_id,
                user_id="eval-doctor-ddx",
            ),
            self._client.chat(
                message=HISTORY_PROMPT,
                patient_id=patient_id,
                visit_id=visit_id,
                user_id="eval-doctor-history",
            ),
            self._client.chat(
                message=SOAP_PROMPT + visit_context,
                patient_id=patient_id,
                visit_id=visit_id,
                user_id="eval-doctor-soap",
            ),
        )

        return DoctorResult(
            ddx_output=ddx_event.content,
            history_output=history_event.content,
            soap_output=soap_event.content,
            session_id=ddx_event.session_id,
        )
