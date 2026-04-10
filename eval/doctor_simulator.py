# eval/doctor_simulator.py
from dataclasses import dataclass

from eval.api_client import EvalApiClient

DDX_PROMPT = (
    "Please generate a differential diagnosis for this patient based on their "
    "presentation. Include ICD-10 codes and rank by likelihood (High/Medium/Low)."
)
HISTORY_PROMPT = (
    "Please analyze this patient's full medical history. Summarize chronic conditions, "
    "medications, allergies, and flag any clinical red flags or concerns."
)
SOAP_PROMPT = (
    "Please write a SOAP note for this patient's current visit, covering Subjective, "
    "Objective, Assessment, and Plan sections."
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

    async def run(self, patient_id: int, visit_id: int | None = None) -> DoctorResult:
        """Fire DDx, history analysis, and SOAP note requests. Returns all outputs."""
        session_id: int | None = None

        ddx_event = await self._client.chat(
            message=DDX_PROMPT,
            patient_id=patient_id,
            visit_id=visit_id,
            session_id=session_id,
            user_id="eval-doctor",
        )
        if ddx_event.session_id is not None:
            session_id = ddx_event.session_id

        history_event = await self._client.chat(
            message=HISTORY_PROMPT,
            patient_id=patient_id,
            visit_id=visit_id,
            session_id=session_id,
            user_id="eval-doctor",
        )
        if history_event.session_id is not None:
            session_id = history_event.session_id

        soap_event = await self._client.chat(
            message=SOAP_PROMPT,
            patient_id=patient_id,
            visit_id=visit_id,
            session_id=session_id,
            user_id="eval-doctor",
        )

        return DoctorResult(
            ddx_output=ddx_event.content,
            history_output=history_event.content,
            soap_output=soap_event.content,
            session_id=session_id,
        )
