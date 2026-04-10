# eval/intake_simulator.py
from dataclasses import dataclass, field

from eval.api_client import EvalApiClient
from eval.case_loader import EvalCase


@dataclass
class TriageResult:
    department: str | None
    confidence: float | None
    visit_id: int | None
    session_id: int | None
    agent_responses: list[str] = field(default_factory=list)
    tool_calls: list[dict] = field(default_factory=list)


class IntakeSimulator:
    def __init__(self, client: EvalApiClient) -> None:
        self._client = client

    async def run(self, case: EvalCase, patient_id: int) -> TriageResult:
        """Drive all intake turns. Returns TriageResult with routing info if triage completed."""
        session_id: int | None = None
        all_responses: list[str] = []
        all_tool_calls: list[dict] = []

        for turn in case.intake.turns:
            event = await self._client.chat(
                message=turn,
                patient_id=patient_id,
                session_id=session_id,
                mode="intake",
            )
            if event.session_id is not None:
                session_id = event.session_id
            all_responses.append(event.content)
            all_tool_calls.extend(event.tool_calls)

            triage_call = self._find_tool_call(event.tool_calls, "complete_triage")
            if triage_call:
                args = triage_call.get("args", {})
                return TriageResult(
                    department=args.get("department"),
                    confidence=args.get("confidence"),
                    visit_id=args.get("visit_id"),
                    session_id=session_id,
                    agent_responses=all_responses,
                    tool_calls=all_tool_calls,
                )

        return TriageResult(
            department=None,
            confidence=None,
            visit_id=None,
            session_id=session_id,
            agent_responses=all_responses,
            tool_calls=all_tool_calls,
        )

    def _find_tool_call(self, tool_calls: list[dict], name: str) -> dict | None:
        return next((tc for tc in tool_calls if tc.get("name") == name), None)
