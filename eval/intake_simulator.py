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

    async def run(self, case: EvalCase, patient_id: int, verbose: bool = False) -> TriageResult:
        """Drive all intake turns. Returns TriageResult with routing info if triage completed."""
        session_id: int | None = None
        all_responses: list[str] = []
        all_tool_calls: list[dict] = []

        for i, turn in enumerate(case.intake.turns):
            if verbose:
                print(f"  [intake turn {i+1}] patient: {turn}")
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

            if verbose:
                print(f"  [intake turn {i+1}] agent: {event.content[:200]}")
                if event.tool_calls:
                    print(f"  [intake turn {i+1}] tool_calls: {event.tool_calls}")

            triage_call = self._find_tool_call(event.tool_calls, "complete_triage")
            if triage_call:
                args = triage_call.get("args", {})
                # routing_suggestion is a list — take first entry as the routed department
                routing = args.get("routing_suggestion") or []
                department = routing[0] if routing else args.get("department")
                # visit id comes back as "id" in the complete_triage tool args
                visit_id = args.get("id") or args.get("visit_id")
                return TriageResult(
                    department=department,
                    confidence=args.get("confidence"),
                    visit_id=visit_id,
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
        # SSE events use "tool" as the key; support "name" as fallback
        return next(
            (tc for tc in tool_calls if tc.get("tool") == name or tc.get("name") == name),
            None,
        )
