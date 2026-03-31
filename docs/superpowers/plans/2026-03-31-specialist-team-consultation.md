# Specialist Team Consultation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `request_specialist_team` tool that runs multi-round specialist deliberation on a shared `CaseThread`, returning a Chief-synthesized recommendation to the calling agent.

**Architecture:** `TeamConsultationHandler` is a new class (parallel to `SpecialistHandler`) that orchestrates Chief LLM calls and parallel specialist LLM calls, persisting each round to `CaseThread`/`CaseMessage` DB tables. It is invoked by the `request_specialist_team` global tool — no changes to `LangGraphAgent`, `graph_builder.py`, or `SpecialistHandler`.

**Tech Stack:** Python/SQLAlchemy async models, Alembic migrations, FastAPI router, LangChain `ainvoke`, `adispatch_custom_event` for SSE progress, React/TypeScript `ConsultationCard` component.

---

## File Structure

**Create:**
- `src/models/case_thread.py` — `CaseThread` + `CaseMessage` SQLAlchemy models
- `alembic/versions/260331_create_case_threads.py` — migration
- `src/agent/team_consultation_handler.py` — `TeamConsultationHandler` class
- `src/tools/builtin/request_specialist_team_tool.py` — tool function + registry registration
- `src/api/routers/case_threads.py` — `GET /api/case-threads/{thread_id}`
- `tests/test_case_thread_model.py` — DB model tests
- `tests/test_team_consultation_handler.py` — unit tests for handler logic
- `tests/test_case_threads_api.py` — endpoint tests
- `web/components/doctor/consultation-card.tsx` — ConsultationCard component

**Modify:**
- `src/models/__init__.py` — export `CaseThread`, `CaseMessage`
- `src/tools/builtin/__init__.py` — import `request_specialist_team_tool` module + function
- `src/api/server.py` — import and include `case_threads` router

---

### Task 1: CaseThread and CaseMessage DB Models

**Files:**
- Create: `src/models/case_thread.py`
- Modify: `src/models/__init__.py`
- Test: `tests/test_case_thread_model.py`

- [ ] **Step 1: Write the failing tests**

```python
# tests/test_case_thread_model.py
"""Unit tests for CaseThread and CaseMessage models."""
import uuid
import pytest
from src.models.case_thread import CaseThread, CaseMessage


@pytest.mark.asyncio
async def test_create_case_thread(db_session, sample_patient):
    thread = CaseThread(
        id=str(uuid.uuid4()),
        patient_id=sample_patient.id,
        created_by="doctor:session_1",
        trigger="manual",
        case_summary="Patient with chest pain and dyspnea.",
    )
    db_session.add(thread)
    await db_session.commit()
    await db_session.refresh(thread)

    assert thread.id is not None
    assert thread.patient_id == sample_patient.id
    assert thread.status == "open"
    assert thread.max_rounds == 3
    assert thread.current_round == 0
    assert thread.synthesis is None


@pytest.mark.asyncio
async def test_create_case_message(db_session, sample_patient):
    thread = CaseThread(
        id=str(uuid.uuid4()),
        patient_id=sample_patient.id,
        created_by="doctor:session_1",
        trigger="auto",
        case_summary="Shortness of breath.",
    )
    db_session.add(thread)
    await db_session.commit()

    msg = CaseMessage(
        id=str(uuid.uuid4()),
        thread_id=thread.id,
        round=1,
        sender_type="specialist",
        specialist_role="cardiologist",
        content="I recommend an ECG.",
        agrees_with=None,
        challenges=None,
    )
    db_session.add(msg)
    await db_session.commit()
    await db_session.refresh(msg)

    assert msg.id is not None
    assert msg.thread_id == thread.id
    assert msg.round == 1
    assert msg.specialist_role == "cardiologist"


@pytest.mark.asyncio
async def test_chief_message(db_session, sample_patient):
    thread = CaseThread(
        id=str(uuid.uuid4()),
        patient_id=sample_patient.id,
        created_by="doctor:session_1",
        trigger="manual",
        case_summary="Altered mental status.",
    )
    db_session.add(thread)
    await db_session.commit()

    msg = CaseMessage(
        id=str(uuid.uuid4()),
        thread_id=thread.id,
        round=1,
        sender_type="chief",
        specialist_role=None,
        content="Neurologist, please address the stroke risk directly.",
    )
    db_session.add(msg)
    await db_session.commit()
    await db_session.refresh(msg)

    assert msg.sender_type == "chief"
    assert msg.specialist_role is None


@pytest.mark.asyncio
async def test_messages_cascade_delete(db_session, sample_patient):
    thread_id = str(uuid.uuid4())
    thread = CaseThread(
        id=thread_id,
        patient_id=sample_patient.id,
        created_by="doctor:session_1",
        trigger="manual",
        case_summary="Chest pain.",
    )
    db_session.add(thread)
    await db_session.commit()

    msg = CaseMessage(
        id=str(uuid.uuid4()),
        thread_id=thread.id,
        round=1,
        sender_type="specialist",
        specialist_role="internist",
        content="Initial assessment.",
    )
    db_session.add(msg)
    await db_session.commit()

    await db_session.delete(thread)
    await db_session.commit()

    from sqlalchemy import select
    result = await db_session.execute(
        select(CaseMessage).where(CaseMessage.thread_id == thread_id)
    )
    assert result.scalars().all() == []
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest tests/test_case_thread_model.py -v
```

Expected: FAIL with `ModuleNotFoundError: No module named 'src.models.case_thread'`

- [ ] **Step 3: Create `src/models/case_thread.py`**

```python
"""CaseThread and CaseMessage models — specialist team consultation threads."""
import uuid
from datetime import datetime
from typing import List, Optional

from sqlalchemy import DateTime, ForeignKey, Integer, JSON, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class CaseThread(Base):
    """A specialist team consultation thread for one patient case."""

    __tablename__ = "case_threads"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"), index=True)
    visit_id: Mapped[Optional[int]] = mapped_column(ForeignKey("visits.id"), nullable=True, index=True)
    created_by: Mapped[str] = mapped_column(String(100))  # e.g. "doctor:session_42"
    trigger: Mapped[str] = mapped_column(String(20))  # "manual" | "auto"
    status: Mapped[str] = mapped_column(String(20), default="open")  # "open" | "converged" | "closed"
    max_rounds: Mapped[int] = mapped_column(Integer, default=3)
    current_round: Mapped[int] = mapped_column(Integer, default=0)
    case_summary: Mapped[str] = mapped_column(Text)  # Chief's structured brief
    synthesis: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # Chief's final output
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=func.now(), onupdate=func.now())

    messages: Mapped[List["CaseMessage"]] = relationship(
        back_populates="thread",
        cascade="all, delete-orphan",
        order_by="CaseMessage.created_at",
    )


class CaseMessage(Base):
    """A single message in a CaseThread — from a specialist or the Chief."""

    __tablename__ = "case_messages"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    thread_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("case_threads.id", ondelete="CASCADE"), index=True
    )
    round: Mapped[int] = mapped_column(Integer)
    sender_type: Mapped[str] = mapped_column(String(20))  # "specialist" | "chief"
    specialist_role: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    content: Mapped[str] = mapped_column(Text)
    agrees_with: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    challenges: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())

    thread: Mapped["CaseThread"] = relationship(back_populates="messages")
```

- [ ] **Step 4: Add exports to `src/models/__init__.py`**

This import is required so that `CaseThread` and `CaseMessage` are registered in
`Base.metadata` when the test engine runs `create_all`. The conftest imports
`from src.models import ...` which triggers `__init__.py`.

Add to the imports section (after `from .visit import Visit, VisitStatus`):

```python
from .case_thread import CaseThread, CaseMessage
```

Add to `__all__` list:

```python
"CaseThread",
"CaseMessage",
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
pytest tests/test_case_thread_model.py -v
```

Expected: 4 tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/models/case_thread.py src/models/__init__.py tests/test_case_thread_model.py
git commit -m "feat: add CaseThread and CaseMessage DB models"
```

---

### Task 2: Alembic Migration

**Files:**
- Create: `alembic/versions/260331_create_case_threads.py`

- [ ] **Step 1: Create the migration file**

```python
# alembic/versions/260331_create_case_threads.py
"""create_case_threads

Revision ID: 260331_create_case_threads
Revises: c4151ade0694
Create Date: 2026-03-31

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '260331_create_case_threads'
down_revision: Union[str, Sequence[str], None] = 'c4151ade0694'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create case_threads and case_messages tables."""
    op.create_table(
        'case_threads',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('patient_id', sa.Integer(), sa.ForeignKey('patients.id'), nullable=False),
        sa.Column('visit_id', sa.Integer(), sa.ForeignKey('visits.id'), nullable=True),
        sa.Column('created_by', sa.String(length=100), nullable=False),
        sa.Column('trigger', sa.String(length=20), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='open'),
        sa.Column('max_rounds', sa.Integer(), nullable=False, server_default='3'),
        sa.Column('current_round', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('case_summary', sa.Text(), nullable=False),
        sa.Column('synthesis', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_case_threads_patient_id', 'case_threads', ['patient_id'], unique=False)
    op.create_index('ix_case_threads_visit_id', 'case_threads', ['visit_id'], unique=False)

    op.create_table(
        'case_messages',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('thread_id', sa.String(length=36),
                  sa.ForeignKey('case_threads.id', ondelete='CASCADE'), nullable=False),
        sa.Column('round', sa.Integer(), nullable=False),
        sa.Column('sender_type', sa.String(length=20), nullable=False),
        sa.Column('specialist_role', sa.String(length=50), nullable=True),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('agrees_with', sa.JSON(), nullable=True),
        sa.Column('challenges', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_case_messages_thread_id', 'case_messages', ['thread_id'], unique=False)


def downgrade() -> None:
    """Drop case_messages then case_threads."""
    op.drop_index('ix_case_messages_thread_id', table_name='case_messages')
    op.drop_table('case_messages')
    op.drop_index('ix_case_threads_visit_id', table_name='case_threads')
    op.drop_index('ix_case_threads_patient_id', table_name='case_threads')
    op.drop_table('case_threads')
```

- [ ] **Step 2: Run the migration**

```bash
alembic upgrade head
```

Expected: output ending with `Running upgrade c4151ade0694 -> 260331_create_case_threads, create_case_threads`

- [ ] **Step 3: Verify tables exist**

```bash
python -c "
from src.models.base import sync_engine
from sqlalchemy import inspect
inspector = inspect(sync_engine)
print(inspector.get_table_names())
"
```

Expected: `[..., 'case_messages', 'case_threads', ...]`

- [ ] **Step 4: Commit**

```bash
git add alembic/versions/260331_create_case_threads.py
git commit -m "feat: migration — create case_threads and case_messages tables"
```

---

### Task 3: TeamConsultationHandler

**Files:**
- Create: `src/agent/team_consultation_handler.py`
- Test: `tests/test_team_consultation_handler.py`

- [ ] **Step 1: Write the failing unit tests**

```python
# tests/test_team_consultation_handler.py
"""Unit tests for TeamConsultationHandler — mocks all LLM calls."""
import uuid
import pytest
from dataclasses import dataclass
from typing import Optional
from unittest.mock import AsyncMock, MagicMock, patch

from src.agent.team_consultation_handler import TeamConsultationHandler, SPECIALIST_ROSTER


# ──────────────────────────────────────────────
# _format_thread
# ──────────────────────────────────────────────

def _make_msg(sender_type, role, content, round_num=1):
    msg = MagicMock()
    msg.sender_type = sender_type
    msg.specialist_role = role
    msg.content = content
    msg.round = round_num
    return msg


def test_format_thread_empty():
    handler = TeamConsultationHandler(llm=MagicMock())
    assert handler._format_thread([]) == ""


def test_format_thread_specialist_messages():
    handler = TeamConsultationHandler(llm=MagicMock())
    msgs = [
        _make_msg("specialist", "cardiologist", "ECG normal."),
        _make_msg("specialist", "internist", "Vitals stable."),
    ]
    result = handler._format_thread(msgs)
    assert "[Cardiologist] ECG normal." in result
    assert "[Internist] Vitals stable." in result


def test_format_thread_chief_message():
    handler = TeamConsultationHandler(llm=MagicMock())
    msgs = [_make_msg("chief", None, "Please address anticoagulation risk.")]
    result = handler._format_thread(msgs)
    assert "[Chief Director] Please address anticoagulation risk." in result


# ──────────────────────────────────────────────
# _parse_stance
# ──────────────────────────────────────────────

def test_parse_stance_detects_agreement():
    handler = TeamConsultationHandler(llm=MagicMock())
    content = "I agree with cardiologist that the ECG is normal."
    agrees, challenges = handler._parse_stance(content, ["cardiologist", "internist"])
    assert "cardiologist" in agrees


def test_parse_stance_detects_challenge():
    handler = TeamConsultationHandler(llm=MagicMock())
    content = "I disagree with nephrologist on the fluid management approach."
    agrees, challenges = handler._parse_stance(content, ["nephrologist", "internist"])
    assert "nephrologist" in challenges


def test_parse_stance_empty_when_no_keywords():
    handler = TeamConsultationHandler(llm=MagicMock())
    agrees, challenges = handler._parse_stance("Patient needs monitoring.", ["internist"])
    assert agrees is None
    assert challenges is None


# ──────────────────────────────────────────────
# _select_team (mocked LLM)
# ──────────────────────────────────────────────

@pytest.mark.asyncio
async def test_select_team_returns_valid_roles():
    llm = AsyncMock()
    llm.ainvoke = AsyncMock(return_value=MagicMock(content="cardiologist, pulmonologist, internist"))
    handler = TeamConsultationHandler(llm=llm)
    team = await handler._select_team("Patient with chest pain and SOB.")
    assert "cardiologist" in team
    assert "internist" in team  # always included
    for role in team:
        assert role in SPECIALIST_ROSTER


@pytest.mark.asyncio
async def test_select_team_always_includes_internist():
    llm = AsyncMock()
    # LLM returns only one specialist without internist
    llm.ainvoke = AsyncMock(return_value=MagicMock(content="cardiologist"))
    handler = TeamConsultationHandler(llm=llm)
    team = await handler._select_team("Any case.")
    assert "internist" in team


@pytest.mark.asyncio
async def test_select_team_filters_invalid_roles():
    llm = AsyncMock()
    llm.ainvoke = AsyncMock(return_value=MagicMock(content="cardiologist, wizard, internist"))
    handler = TeamConsultationHandler(llm=llm)
    team = await handler._select_team("Any case.")
    assert "wizard" not in team


# ──────────────────────────────────────────────
# _write_brief (mocked LLM)
# ──────────────────────────────────────────────

@pytest.mark.asyncio
async def test_write_brief_returns_llm_content():
    llm = AsyncMock()
    llm.ainvoke = AsyncMock(return_value=MagicMock(content="Patient: 60yo M\nChief complaint: chest pain"))
    handler = TeamConsultationHandler(llm=llm)
    brief = await handler._write_brief("60yo male with chest pain.")
    assert "chest pain" in brief


# ──────────────────────────────────────────────
# _chief_review (mocked LLM)
# ──────────────────────────────────────────────

@pytest.mark.asyncio
async def test_chief_review_converged():
    llm = AsyncMock()
    llm.ainvoke = AsyncMock(return_value=MagicMock(content="CONVERGED: yes\nDIRECTIVE:"))
    handler = TeamConsultationHandler(llm=llm)
    msgs = [_make_msg("specialist", "cardiologist", "All good.")]
    directive = await handler._chief_review("brief", msgs, 1)
    assert directive.converged is True
    assert directive.message is None


@pytest.mark.asyncio
async def test_chief_review_not_converged_with_directive():
    llm = AsyncMock()
    llm.ainvoke = AsyncMock(return_value=MagicMock(
        content="CONVERGED: no\nDIRECTIVE: Cardiologist please address anticoagulation."
    ))
    handler = TeamConsultationHandler(llm=llm)
    msgs = [_make_msg("specialist", "cardiologist", "Uncertain about anticoagulation.")]
    directive = await handler._chief_review("brief", msgs, 1)
    assert directive.converged is False
    assert "anticoagulation" in directive.message


@pytest.mark.asyncio
async def test_chief_review_not_converged_no_directive():
    llm = AsyncMock()
    llm.ainvoke = AsyncMock(return_value=MagicMock(content="CONVERGED: no\nDIRECTIVE:"))
    handler = TeamConsultationHandler(llm=llm)
    directive = await handler._chief_review("brief", [], 1)
    assert directive.converged is False
    assert directive.message is None
```

- [ ] **Step 2: Run to verify they fail**

```bash
pytest tests/test_team_consultation_handler.py -v
```

Expected: FAIL with `ModuleNotFoundError: No module named 'src.agent.team_consultation_handler'`

- [ ] **Step 3: Create `src/agent/team_consultation_handler.py`**

```python
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pytest tests/test_team_consultation_handler.py -v
```

Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/agent/team_consultation_handler.py tests/test_team_consultation_handler.py
git commit -m "feat: add TeamConsultationHandler with Chief-directed multi-round deliberation"
```

---

### Task 4: `request_specialist_team` Global Tool

**Files:**
- Create: `src/tools/builtin/request_specialist_team_tool.py`
- Modify: `src/tools/builtin/__init__.py`
- Test: `tests/test_request_specialist_team_tool.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_request_specialist_team_tool.py
"""Tests for request_specialist_team tool registration."""
import importlib
from src.tools.registry import ToolRegistry


def test_tool_is_registered():
    # Import the module to trigger registration
    importlib.import_module("src.tools.builtin.request_specialist_team_tool")
    registry = ToolRegistry()
    tools = registry.get_langchain_tools(scope_filter="global")
    names = [t.name for t in tools]
    assert "request_specialist_team" in names


def test_tool_has_correct_scope():
    registry = ToolRegistry()
    scope = registry._tool_scopes.get("request_specialist_team")
    assert scope == "global"
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pytest tests/test_request_specialist_team_tool.py -v
```

Expected: FAIL with `ModuleNotFoundError`

- [ ] **Step 3: Create `src/tools/builtin/request_specialist_team_tool.py`**

```python
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

    handler = TeamConsultationHandler(llm=llm_provider.llm)
    return await handler.run(
        case_summary=case_summary,
        patient_id=patient_id,
        trigger="manual",
    )


_registry = ToolRegistry()
_registry.register(
    request_specialist_team,
    scope="global",
    symbol="request_specialist_team",
    allow_overwrite=True,
)
```

- [ ] **Step 4: Update `src/tools/builtin/__init__.py`**

Add after the `from . import ask_user_tool` line:

```python
from . import request_specialist_team_tool
```

Add after the `from .ask_user_tool import ask_user` line:

```python
from .request_specialist_team_tool import request_specialist_team
```

Add `"request_specialist_team"` to the `__all__` list.

- [ ] **Step 5: Run test to verify it passes**

```bash
pytest tests/test_request_specialist_team_tool.py -v
```

Expected: 2 tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/tools/builtin/request_specialist_team_tool.py src/tools/builtin/__init__.py tests/test_request_specialist_team_tool.py
git commit -m "feat: add request_specialist_team global tool"
```

---

### Task 5: Case Threads API Endpoint

**Files:**
- Create: `src/api/routers/case_threads.py`
- Modify: `src/api/server.py`
- Test: `tests/test_case_threads_api.py`

- [ ] **Step 1: Write the failing test**

The API test needs real DB rows visible to the app's own sessions (`AsyncSessionLocal`), so it uses
`AsyncSessionLocal` directly — not the savepoint-isolated `db_session` fixture from conftest.
The fixture creates a patient + thread, then deletes them in teardown.

```python
# tests/test_case_threads_api.py
"""Integration tests for GET /api/case-threads/{thread_id}."""
import uuid
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport

from src.api.server import app
from src.models.case_thread import CaseThread, CaseMessage
from src.models.patient import Patient
from src.models.base import AsyncSessionLocal


@pytest_asyncio.fixture
async def thread_in_db():
    """Create a patient + CaseThread with two messages directly in the DB; clean up after."""
    patient_id = None
    thread_id = str(uuid.uuid4())

    async with AsyncSessionLocal() as db:
        patient = Patient(name="Test Patient", dob="1980-01-01", gender="male")
        db.add(patient)
        await db.commit()
        await db.refresh(patient)
        patient_id = patient.id

        thread = CaseThread(
            id=thread_id,
            patient_id=patient_id,
            created_by="doctor:test",
            trigger="manual",
            status="converged",
            case_summary="Patient with chest pain.",
            synthesis="PRIMARY RECOMMENDATION: Start aspirin.",
        )
        db.add(thread)
        await db.commit()

        db.add(CaseMessage(
            id=str(uuid.uuid4()),
            thread_id=thread_id,
            round=1,
            sender_type="specialist",
            specialist_role="cardiologist",
            content="ECG shows ST elevation.",
        ))
        db.add(CaseMessage(
            id=str(uuid.uuid4()),
            thread_id=thread_id,
            round=1,
            sender_type="specialist",
            specialist_role="internist",
            content="Agree with cardiologist.",
        ))
        await db.commit()

    yield thread_id

    # Teardown — delete thread (cascades to messages) then patient
    from sqlalchemy import delete
    async with AsyncSessionLocal() as db:
        await db.execute(delete(CaseThread).where(CaseThread.id == thread_id))
        if patient_id:
            await db.execute(delete(Patient).where(Patient.id == patient_id))
        await db.commit()


@pytest.mark.asyncio
async def test_get_case_thread_returns_thread_and_messages(thread_in_db):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get(f"/api/case-threads/{thread_in_db}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == thread_in_db
    assert data["status"] == "converged"
    assert data["synthesis"] == "PRIMARY RECOMMENDATION: Start aspirin."
    assert len(data["messages"]) == 2
    roles = {m["specialist_role"] for m in data["messages"]}
    assert "cardiologist" in roles
    assert "internist" in roles


@pytest.mark.asyncio
async def test_get_case_thread_404_for_missing():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get(f"/api/case-threads/{uuid.uuid4()}")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_messages_ordered_by_round(thread_in_db):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get(f"/api/case-threads/{thread_in_db}")
    data = resp.json()
    rounds = [m["round"] for m in data["messages"]]
    assert rounds == sorted(rounds)
```

- [ ] **Step 2: Run to verify it fails**

```bash
pytest tests/test_case_threads_api.py -v
```

Expected: FAIL with `404` (route not registered) or import error

- [ ] **Step 3: Create `src/api/routers/case_threads.py`**

```python
"""Case threads API — retrieve specialist consultation threads."""
import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models import get_db
from src.models.case_thread import CaseThread, CaseMessage

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Case Threads"])


@router.get("/api/case-threads/{thread_id}")
async def get_case_thread(thread_id: str, db: AsyncSession = Depends(get_db)):
    """Return a CaseThread with all its messages ordered by round / created_at.

    Used by the frontend to render the expandable specialist discussion view.

    Returns 404 if the thread_id does not exist.
    """
    result = await db.execute(select(CaseThread).where(CaseThread.id == thread_id))
    thread = result.scalar_one_or_none()
    if thread is None:
        raise HTTPException(status_code=404, detail="Thread not found")

    msgs_result = await db.execute(
        select(CaseMessage)
        .where(CaseMessage.thread_id == thread_id)
        .order_by(CaseMessage.round, CaseMessage.created_at)
    )
    messages = msgs_result.scalars().all()

    return {
        "id": thread.id,
        "patient_id": thread.patient_id,
        "visit_id": thread.visit_id,
        "created_by": thread.created_by,
        "trigger": thread.trigger,
        "status": thread.status,
        "max_rounds": thread.max_rounds,
        "current_round": thread.current_round,
        "case_summary": thread.case_summary,
        "synthesis": thread.synthesis,
        "created_at": thread.created_at.isoformat(),
        "updated_at": thread.updated_at.isoformat(),
        "messages": [
            {
                "id": m.id,
                "round": m.round,
                "sender_type": m.sender_type,
                "specialist_role": m.specialist_role,
                "content": m.content,
                "agrees_with": m.agrees_with,
                "challenges": m.challenges,
                "created_at": m.created_at.isoformat(),
            }
            for m in messages
        ],
    }
```

- [ ] **Step 4: Register the router in `src/api/server.py`**

In the imports at the top of `server.py`, add `case_threads` to the router import line:

```python
from .routers import patients, agents, tools, chat, usage, skills, visits, departments, hospital, auth, orders, ws, case_threads
```

After `app.include_router(ws.router)`, add:

```python
app.include_router(case_threads.router)
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
pytest tests/test_case_threads_api.py -v
```

Expected: 3 tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/api/routers/case_threads.py src/api/server.py tests/test_case_threads_api.py
git commit -m "feat: add GET /api/case-threads/{thread_id} endpoint"
```

---

### Task 6: ConsultationCard Frontend Component

**Files:**
- Create: `web/components/doctor/consultation-card.tsx`
- Modify: `web/components/agent/answer-content.tsx`

The synthesis returned by the tool follows a structured format starting with `PRIMARY RECOMMENDATION:`. `AnswerContent` detects this prefix and renders a `ConsultationCard` instead of plain markdown.

- [ ] **Step 1: Create `web/components/doctor/consultation-card.tsx`**

```typescript
"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Users } from "lucide-react";

interface ConsultationMessage {
  id: string;
  round: number;
  sender_type: "specialist" | "chief";
  specialist_role: string | null;
  content: string;
  agrees_with: string[] | null;
  challenges: string[] | null;
}

interface ConsultationThread {
  id: string;
  status: string;
  current_round: number;
  synthesis: string;
  messages: ConsultationMessage[];
}

interface ParsedSynthesis {
  primaryRecommendation: string;
  confidence: string;
  supporting: string;
  dissent: string;
  chiefNotes: string;
}

function parseSynthesis(content: string): ParsedSynthesis {
  const get = (label: string): string => {
    const regex = new RegExp(`${label}:\\s*([\\s\\S]*?)(?=\\n[A-Z ]+:|$)`, "i");
    const match = content.match(regex);
    return match ? match[1].trim() : "";
  };
  return {
    primaryRecommendation: get("PRIMARY RECOMMENDATION"),
    confidence: get("CONFIDENCE"),
    supporting: get("SUPPORTING"),
    dissent: get("DISSENT"),
    chiefNotes: get("CHIEF NOTES"),
  };
}

function confidenceColor(confidence: string): string {
  const c = confidence.toLowerCase();
  if (c === "high") return "text-emerald-400";
  if (c === "moderate") return "text-amber-400";
  return "text-red-400";
}

interface ConsultationCardProps {
  content: string;
  threadId?: string;
}

export function ConsultationCard({ content, threadId }: ConsultationCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [thread, setThread] = useState<ConsultationThread | null>(null);
  const [loading, setLoading] = useState(false);

  const parsed = parseSynthesis(content);

  const loadThread = async () => {
    if (!threadId || thread) {
      setExpanded((e) => !e);
      return;
    }
    setLoading(true);
    try {
      const resp = await fetch(`/api/case-threads/${threadId}`);
      if (resp.ok) setThread(await resp.json());
    } finally {
      setLoading(false);
      setExpanded(true);
    }
  };

  const roundGroups = thread
    ? thread.messages.reduce<Record<number, ConsultationMessage[]>>((acc, msg) => {
        (acc[msg.round] = acc[msg.round] ?? []).push(msg);
        return acc;
      }, {})
    : {};

  return (
    <div className="rounded-lg border border-cyan-500/20 bg-card/60 overflow-hidden my-2">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-cyan-500/10 border-b border-cyan-500/20">
        <Users className="w-4 h-4 text-cyan-400" />
        <span className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">
          Team Consultation
        </span>
        {parsed.confidence && (
          <span className={`ml-auto text-xs font-medium ${confidenceColor(parsed.confidence)}`}>
            {parsed.confidence.toUpperCase()} confidence
          </span>
        )}
      </div>

      {/* Primary Recommendation */}
      <div className="px-4 py-3">
        {parsed.primaryRecommendation && (
          <p className="text-sm text-foreground leading-relaxed mb-2">
            {parsed.primaryRecommendation}
          </p>
        )}

        {/* Supporting / Dissent */}
        <div className="flex flex-col gap-1 mt-2">
          {parsed.supporting && parsed.supporting !== "None" && (
            <p className="text-xs text-muted-foreground">
              <span className="text-emerald-400 font-medium">Supporting: </span>
              {parsed.supporting}
            </p>
          )}
          {parsed.dissent && parsed.dissent !== "None" && (
            <p className="text-xs text-muted-foreground">
              <span className="text-amber-400 font-medium">Dissent: </span>
              {parsed.dissent}
            </p>
          )}
          {parsed.chiefNotes && parsed.chiefNotes !== "None" && (
            <p className="text-xs text-muted-foreground">
              <span className="text-cyan-400 font-medium">Notes: </span>
              {parsed.chiefNotes}
            </p>
          )}
        </div>
      </div>

      {/* Thread expand toggle */}
      {threadId && (
        <button
          onClick={loadThread}
          className="w-full flex items-center justify-center gap-1.5 px-4 py-2 text-xs text-muted-foreground hover:text-foreground border-t border-border/40 hover:bg-accent/30 transition-colors"
        >
          {loading ? (
            "Loading discussion..."
          ) : (
            <>
              {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              {expanded ? "Hide" : "View"} full discussion thread
            </>
          )}
        </button>
      )}

      {/* Thread view */}
      {expanded && thread && (
        <div className="border-t border-border/40 px-4 py-3 space-y-3 bg-background/30">
          {Object.entries(roundGroups).map(([round, msgs]) => (
            <div key={round}>
              <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider mb-1.5 font-medium">
                Round {round}
              </p>
              <div className="space-y-2">
                {msgs.map((msg) => (
                  <div
                    key={msg.id}
                    className={`rounded px-3 py-2 text-xs ${
                      msg.sender_type === "chief"
                        ? "bg-cyan-500/10 border border-cyan-500/20 text-cyan-300"
                        : "bg-muted/30 text-foreground/80"
                    }`}
                  >
                    <p className="font-semibold mb-0.5">
                      {msg.sender_type === "chief"
                        ? "Chief Director"
                        : msg.specialist_role
                            ?.split("_")
                            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                            .join(" ")}
                    </p>
                    <p className="leading-relaxed">{msg.content}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Returns true if the content string is a team consultation synthesis. */
export function isConsultationSynthesis(content: string): boolean {
  return content.trimStart().startsWith("PRIMARY RECOMMENDATION:");
}
```

- [ ] **Step 2: Integrate `ConsultationCard` into `web/components/agent/answer-content.tsx`**

Add the import at the top of `answer-content.tsx` (after existing imports):

```typescript
import { ConsultationCard, isConsultationSynthesis } from "@/components/doctor/consultation-card";
```

Inside the `AnswerContent` function, add a check before the return statement. The current function starts with `const processedContent = React.useMemo(...)`. Add this before the return:

```typescript
  // Render team consultation synthesis as a structured card
  if (isConsultationSynthesis(content)) {
    return <ConsultationCard content={content} />;
  }
```

- [ ] **Step 3: Verify the frontend builds without errors**

```bash
cd web && npm run build 2>&1 | tail -20
```

Expected: build completes without TypeScript errors

- [ ] **Step 4: Commit**

```bash
git add web/components/doctor/consultation-card.tsx web/components/agent/answer-content.tsx
git commit -m "feat: add ConsultationCard component for team consultation synthesis"
```

---

## Running the Full Test Suite

After all tasks are complete, verify nothing is broken:

```bash
pytest tests/ -v --ignore=tests/integration -x 2>&1 | tail -30
```

Expected: all tests pass, no regressions.
