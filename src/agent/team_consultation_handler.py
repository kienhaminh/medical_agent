"""TeamConsultationHandler — orchestrates multi-specialist team deliberation.

Chief Agent pattern: Chief selects the team, writes the case brief, runs N rounds
of parallel specialist deliberation (each round specialists read the full thread),
steers discussion between rounds via optional directives, and synthesizes a final
recommendation.

Specialist LLM calls are stateless — no persistent sub-agent memory.
All messages are persisted to CaseThread/CaseMessage tables as they are produced.
"""
import asyncio
import logging
import uuid
from dataclasses import dataclass
from typing import Optional

from langchain_core.messages import SystemMessage
from langchain_core.callbacks.manager import adispatch_custom_event
from sqlalchemy import select, update

from ..models.case_thread import CaseThread, CaseMessage
from ..models.base import AsyncSessionLocal

logger = logging.getLogger(__name__)


SPECIALIST_ROSTER: dict[str, str] = {
    "cardiologist":    "You are a cardiologist. Focus on cardiac risk, arrhythmia, heart failure, ECG findings.",
    "pulmonologist":   "You are a pulmonologist. Focus on respiratory symptoms, oxygenation, ventilation, lung pathology.",
    "nephrologist":    "You are a nephrologist. Focus on renal function, electrolytes, fluid balance, AKI.",
    "endocrinologist": "You are an endocrinologist. Focus on glucose control, thyroid, metabolic disorders.",
    "neurologist":     "You are a neurologist. Focus on neurological symptoms, stroke risk, altered mental status.",
    "internist":       "You are an internist. As the generalist, integrate all findings and catch anything the specialists may miss.",
}


@dataclass
class ChiefDirective:
    """Result of the Chief's round review."""

    converged: bool
    message: Optional[str] = None  # Optional directive to post between rounds


class TeamConsultationHandler:
    """Orchestrates multi-specialist team deliberation on a patient case.

    Usage:
        handler = TeamConsultationHandler(llm=llm)
        synthesis = await handler.run(case_summary=..., patient_id=...)
    """

    def __init__(self, llm, max_concurrent: int = 5, timeout: float = 120.0):
        self.llm = llm
        self.max_concurrent = max_concurrent
        self.timeout = timeout

    # ──────────────────────────────────────────────────────────
    # Public entry point
    # ──────────────────────────────────────────────────────────

    async def run(
        self,
        case_summary: str,
        patient_id: int,
        visit_id: Optional[int] = None,
        created_by: str = "system",
        trigger: str = "manual",
    ) -> str:
        """Run a full specialist consultation and return the synthesis string."""
        await adispatch_custom_event("agent_log", {"message": "Selecting specialist team...", "level": "info"})
        team = await self._select_team(case_summary)

        await adispatch_custom_event("agent_log", {"message": "Writing case brief...", "level": "info"})
        brief = await self._write_brief(case_summary)

        thread_id, max_rounds = await self._open_thread(patient_id, visit_id, created_by, trigger, brief)

        final_status = "closed"
        for round_num in range(1, max_rounds + 1):
            await adispatch_custom_event(
                "agent_log",
                {"message": f"Round {round_num} — {', '.join(team)} posting...", "level": "info"},
            )
            prior = await self._fetch_messages(thread_id)
            await self._run_round(thread_id, team, brief, prior, round_num)
            await self._set_current_round(thread_id, round_num)

            await adispatch_custom_event(
                "agent_log",
                {"message": f"Chief reviewing round {round_num}...", "level": "info"},
            )
            all_msgs = await self._fetch_messages(thread_id)
            directive = await self._chief_review(brief, all_msgs, round_num)

            if directive.converged:
                final_status = "converged"
                break

            if directive.message and round_num < max_rounds:
                await self._post_chief_message(thread_id, directive.message, round_num)

        await self._update_thread_status(thread_id, final_status)

        await adispatch_custom_event("agent_log", {"message": "Synthesizing...", "level": "info"})
        all_msgs = await self._fetch_messages(thread_id)
        synthesis = await self._synthesize(brief, all_msgs)
        await self._save_synthesis(thread_id, synthesis)

        return synthesis

    # ──────────────────────────────────────────────────────────
    # Chief LLM calls
    # ──────────────────────────────────────────────────────────

    async def _select_team(self, case_summary: str) -> list[str]:
        """Chief selects 2-4 specialists from the roster."""
        prompt = SystemMessage(content=(
            "You are the Chief Medical Officer. Select 1-3 specialist roles from this list for the case below. "
            "Always include 'internist'. Return ONLY a comma-separated list of role names, nothing else.\n\n"
            f"Available roles: {', '.join(SPECIALIST_ROSTER.keys())}\n\n"
            f"Case: {case_summary}"
        ))
        response = await self.llm.ainvoke([prompt])
        roles = [r.strip().lower() for r in response.content.split(",")]
        valid = [r for r in roles if r in SPECIALIST_ROSTER]
        if "internist" not in valid:
            valid.append("internist")
        return valid

    async def _write_brief(self, case_summary: str) -> str:
        """Chief writes a structured case brief for the specialist team."""
        prompt = SystemMessage(content=(
            "You are the Chief Medical Officer. Write a structured case brief for a specialist team.\n"
            "Format exactly:\n"
            "Patient: [age], [sex]\n"
            "Chief complaint: [...]\n"
            "Relevant history: [...]\n"
            "Current medications: [...]\n"
            "Recent vitals/labs: [...]\n"
            "Key question for this consultation: [...]\n\n"
            f"Source information: {case_summary}"
        ))
        response = await self.llm.ainvoke([prompt])
        return response.content

    async def _chief_review(self, brief: str, messages: list, round_num: int) -> ChiefDirective:
        """Chief reviews the completed round and decides whether the discussion has converged."""
        thread_context = self._format_thread(messages)
        prompt = SystemMessage(content=(
            "You are the Chief Medical Officer reviewing a specialist team discussion.\n\n"
            f"=== CASE BRIEF ===\n{brief}\n\n"
            f"=== DISCUSSION ===\n{thread_context}\n\n"
            "=== YOUR TASK ===\n"
            "Decide:\n"
            "1. Is the team converged? (all key issues addressed, no major unresolved conflicts)\n"
            "2. If not converged, write ONE brief directive for the next round (leave blank if no steering needed).\n\n"
            "Respond in EXACTLY this format:\n"
            "CONVERGED: yes|no\n"
            "DIRECTIVE: <your directive text, or leave blank>"
        ))
        response = await self.llm.ainvoke([prompt])
        content = response.content

        converged = "converged: yes" in content.lower()
        directive_text = ""
        for line in content.splitlines():
            if line.lower().startswith("directive:"):
                directive_text = line[len("directive:"):].strip()
                break

        return ChiefDirective(converged=converged, message=directive_text or None)

    async def _synthesize(self, brief: str, messages: list) -> str:
        """Chief synthesizes the full discussion into a final recommendation."""
        thread_context = self._format_thread(messages)
        prompt = SystemMessage(content=(
            "You are the Chief Medical Officer writing the final synthesis of a specialist team consultation.\n\n"
            f"=== CASE BRIEF ===\n{brief}\n\n"
            f"=== FULL DISCUSSION ===\n{thread_context}\n\n"
            "Write the synthesis in EXACTLY this format:\n"
            "PRIMARY RECOMMENDATION: [...]\n"
            "CONFIDENCE: high|moderate|low\n"
            "SUPPORTING: [list each supporting role and one-line rationale]\n"
            "DISSENT: [list each dissenting role and their specific concern, or 'None']\n"
            "CHIEF NOTES: [unresolved points, caveats, follow-up suggestions, or 'None']"
        ))
        response = await self.llm.ainvoke([prompt])
        return response.content

    # ──────────────────────────────────────────────────────────
    # Specialist round execution
    # ──────────────────────────────────────────────────────────

    async def _run_round(
        self,
        thread_id: str,
        team: list[str],
        brief: str,
        prior_messages: list,
        round_num: int,
    ) -> None:
        """Execute one round: parallel specialist LLM calls, each posting to the thread."""
        semaphore = asyncio.Semaphore(self.max_concurrent)

        async def call_specialist(role: str) -> None:
            async with semaphore:
                instructions = SPECIALIST_ROSTER[role]
                thread_context = self._format_thread(prior_messages)
                round_instruction = (
                    "Post your initial findings based on the case brief above."
                    if round_num == 1
                    else "Review the discussion above. Respond to, challenge, or affirm your colleagues' points directly."
                )
                prompt = SystemMessage(content=(
                    f"{instructions}\n\n"
                    f"=== CASE BRIEF ===\n{brief}\n\n"
                    + (f"=== DISCUSSION SO FAR ===\n{thread_context}\n\n" if thread_context else "")
                    + f"=== YOUR TASK ===\n{round_instruction}"
                ))
                response = await self.llm.ainvoke([prompt])

                peers = [r for r in team if r != role]
                agrees_with, challenges = self._parse_stance(response.content, peers)

                msg = CaseMessage(
                    id=str(uuid.uuid4()),
                    thread_id=thread_id,
                    round=round_num,
                    sender_type="specialist",
                    specialist_role=role,
                    content=response.content,
                    agrees_with=agrees_with,
                    challenges=challenges,
                )
                async with AsyncSessionLocal() as db:
                    db.add(msg)
                    await db.commit()

        await asyncio.gather(*[call_specialist(role) for role in team])

    # ──────────────────────────────────────────────────────────
    # Helper methods
    # ──────────────────────────────────────────────────────────

    def _format_thread(self, messages: list) -> str:
        """Format a list of CaseMessage objects into a readable thread string."""
        if not messages:
            return ""
        lines = []
        for msg in messages:
            if msg.sender_type == "chief":
                lines.append(f"[Chief Director] {msg.content}")
            else:
                lines.append(f"[{msg.specialist_role.title()}] {msg.content}")
        return "\n\n".join(lines)

    def _parse_stance(self, content: str, peers: list[str]) -> tuple[Optional[list], Optional[list]]:
        """Keyword scan to infer which peers this message agrees with or challenges."""
        lower = content.lower()
        agrees = [r for r in peers if f"agree with {r}" in lower or f"support {r}" in lower]
        challenges = [
            r for r in peers
            if f"challenge {r}" in lower or f"disagree with {r}" in lower or f"concern with {r}" in lower
        ]
        return (agrees if agrees else None), (challenges if challenges else None)

    # ──────────────────────────────────────────────────────────
    # DB operations — each uses its own short-lived session
    # ──────────────────────────────────────────────────────────

    async def _open_thread(
        self,
        patient_id: int,
        visit_id: Optional[int],
        created_by: str,
        trigger: str,
        brief: str,
    ) -> tuple[str, int]:
        """Create CaseThread row; returns (thread_id, max_rounds)."""
        thread_id = str(uuid.uuid4())
        async with AsyncSessionLocal() as db:
            thread = CaseThread(
                id=thread_id,
                patient_id=patient_id,
                visit_id=visit_id,
                created_by=created_by,
                trigger=trigger,
                status="open",
                max_rounds=3,
                current_round=0,
                case_summary=brief,
            )
            db.add(thread)
            await db.commit()
        return thread_id, 3

    async def _fetch_messages(self, thread_id: str) -> list:
        """Fetch all CaseMessage rows for a thread, ordered by created_at."""
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(CaseMessage)
                .where(CaseMessage.thread_id == thread_id)
                .order_by(CaseMessage.created_at)
            )
            return list(result.scalars().all())

    async def _set_current_round(self, thread_id: str, round_num: int) -> None:
        async with AsyncSessionLocal() as db:
            await db.execute(
                update(CaseThread)
                .where(CaseThread.id == thread_id)
                .values(current_round=round_num)
            )
            await db.commit()

    async def _post_chief_message(self, thread_id: str, message: str, round_num: int) -> None:
        async with AsyncSessionLocal() as db:
            msg = CaseMessage(
                id=str(uuid.uuid4()),
                thread_id=thread_id,
                round=round_num,
                sender_type="chief",
                specialist_role=None,
                content=message,
            )
            db.add(msg)
            await db.commit()

    async def _update_thread_status(self, thread_id: str, status: str) -> None:
        async with AsyncSessionLocal() as db:
            await db.execute(
                update(CaseThread)
                .where(CaseThread.id == thread_id)
                .values(status=status)
            )
            await db.commit()

    async def _save_synthesis(self, thread_id: str, synthesis: str) -> None:
        async with AsyncSessionLocal() as db:
            await db.execute(
                update(CaseThread)
                .where(CaseThread.id == thread_id)
                .values(synthesis=synthesis)
            )
            await db.commit()
