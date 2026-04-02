# Intake Redesign: Fully Dynamic Two-Step Flow — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace template-driven patient intake with a fully agent-driven two-step `ask_user_input` flow that collects identity then clinical data, removes unused fields, and strips dead frontend code.

**Architecture:** A dedicated intake system prompt drives the agent to call `ask_user_input` twice in sequence. The backend classifies form fields, persists PII to the vault, creates a VitalSign from height/weight, and threads `patient_id` across the two steps via the session accumulator. A new `mode: "intake"` flag on the chat request selects a separate agent instance initialized with the intake prompt.

**Tech Stack:** FastAPI, SQLAlchemy 2 async ORM, LangGraph `create_react_agent`, Next.js / TypeScript, pytest-asyncio.

**Spec:** `docs/superpowers/specs/2026-04-02-intake-redesign-design.md`

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src/prompt/intake.py` | Intake system prompt constant |
| Modify | `src/api/dependencies.py` | Add `_intake_agent` + `get_intake_agent()` |
| Modify | `src/api/models.py` | Add `mode` field to `ChatRequest` |
| Modify | `src/api/routers/chat/messages.py` | Wire intake agent; VitalSign creation; session patient_id |
| Modify | `src/forms/field_classification.py` | Add phone to PATIENT_IDENTITY_FIELDS; height/weight to SAFE_FIELDS |
| Modify | `src/models/intake_submission.py` | Make 7 columns Optional/nullable |
| Modify | `src/forms/vault.py` | Use `or None` for newly nullable columns |
| Modify | `alembic/versions/001_init.py` | Set nullable=True for those 7 columns |
| Modify | `web/components/reception/form-input-bar.tsx` | Remove SECTION_LABELS + legacy flat-fields fallback |
| Create | `tests/test_intake_redesign.py` | Unit tests for each changed component |

---

## Task 1: Intake System Prompt

**Files:**
- Create: `src/prompt/intake.py`
- Test: `tests/test_intake_redesign.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_intake_redesign.py
"""Tests for the intake redesign — prompt, classification, model, vault."""


def test_intake_system_prompt_is_nonempty_string():
    from src.prompt.intake import INTAKE_SYSTEM_PROMPT
    assert isinstance(INTAKE_SYSTEM_PROMPT, str)
    assert len(INTAKE_SYSTEM_PROMPT) > 100
    assert "ask_user_input" in INTAKE_SYSTEM_PROMPT
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pytest tests/test_intake_redesign.py::test_intake_system_prompt_is_nonempty_string -v
```

Expected: `ModuleNotFoundError` or `ImportError` — `src/prompt/intake.py` doesn't exist yet.

- [ ] **Step 3: Create the prompt file**

```python
# src/prompt/intake.py
"""System prompt for the patient-facing intake agent."""

INTAKE_SYSTEM_PROMPT = """You are a friendly patient intake assistant at a medical clinic. \
Your job is to collect basic patient information and the reason for today's visit.

**How to conduct intake — follow these steps exactly:**

1. Greet the patient warmly in one short sentence. Do not ask any questions yet.

2. Call ask_user_input with the following schema:
   - title: "Patient Information"
   - One section with label "Personal Details" and these fields:
     - first_name: text, required, label "First Name"
     - last_name: text, required, label "Last Name"
     - dob: date, required, label "Date of Birth"
     - phone: text, required, label "Phone Number"
     - gender: select, required, label "Gender", \
options ["Male", "Female", "Other", "Prefer not to say"]

3. After the patient submits their details, call ask_user_input again with:
   - title: "Visit Information"
   - One section with label "About Your Visit" and these fields:
     - height_cm: text, optional, label "Height (cm)", placeholder "e.g. 170"
     - weight_kg: text, optional, label "Weight (kg)", placeholder "e.g. 70"
     - chief_complaint: textarea, required, label "What brings you in today?"
     - symptoms: textarea, optional, label "Any other symptoms?"

4. After both forms are submitted, thank the patient in one short sentence and tell them \
staff will be with them shortly. Do not say anything else.

**Rules — never break these:**
- Do not ask for email, home address, insurance details, or emergency contact information.
- Do not provide medical advice, diagnoses, or clinical assessments of any kind.
- Do not reveal tool call results, patient IDs, intake IDs, or internal system values.
- Keep all messages brief — patients are at a clinic check-in desk.
- Do not deviate from the two-step sequence above."""
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pytest tests/test_intake_redesign.py::test_intake_system_prompt_is_nonempty_string -v
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/prompt/intake.py tests/test_intake_redesign.py
git commit -m "feat(intake): add patient-facing intake system prompt"
```

---

## Task 2: Intake Agent in Dependencies

**Files:**
- Modify: `src/api/dependencies.py`

Context: The current file creates one global `_agent` (LangGraphAgent with the GP system prompt) and returns it from `get_or_create_agent()`. We need a second agent initialized with the intake prompt. Both agents share the same LLM provider and tool registry — only the system prompt differs.

`LangGraphAgent.__init__` signature:
```python
def __init__(self, llm_with_tools, system_prompt: str = None, max_iterations: int = 10, **kwargs)
```

`SYSTEM_PROMPT` is imported from `src.prompt.system`. We'll import `INTAKE_SYSTEM_PROMPT` from `src.prompt.intake`.

- [ ] **Step 1: Add the intake agent**

Open `src/api/dependencies.py`. After the line:
```python
_agent: LangGraphAgent = LangGraphAgent(llm_with_tools=llm_provider.llm)
logger.info("Global agent initialized (%s)", provider_name)
```

Add:
```python
from ..prompt.intake import INTAKE_SYSTEM_PROMPT

_intake_agent: LangGraphAgent = LangGraphAgent(
    llm_with_tools=llm_provider.llm,
    system_prompt=INTAKE_SYSTEM_PROMPT,
)
logger.info("Intake agent initialized (%s)", provider_name)
```

And add this function after `get_or_create_agent`:
```python
def get_intake_agent() -> LangGraphAgent:
    """Return the intake-mode agent (patient-facing system prompt)."""
    return _intake_agent
```

- [ ] **Step 2: Verify the import works**

```bash
python -c "from src.api.dependencies import get_intake_agent; a = get_intake_agent(); print('ok', a)"
```

Expected output: `ok LangGraphAgent(tools=N)` — no errors.

- [ ] **Step 3: Commit**

```bash
git add src/api/dependencies.py
git commit -m "feat(intake): add intake agent with patient-facing system prompt"
```

---

## Task 3: ChatRequest `mode` Field + Agent Selection

**Files:**
- Modify: `src/api/models.py` (lines 69–77)
- Modify: `src/api/routers/chat/messages.py`
- Test: `tests/test_intake_redesign.py`

Context: `ChatRequest` is a Pydantic model. The `chat()` handler in `messages.py` calls `get_or_create_agent(request.user_id)` regardless of mode. We need to swap to `get_intake_agent()` when `request.mode == "intake"`.

- [ ] **Step 1: Add failing test**

Add to `tests/test_intake_redesign.py`:
```python
def test_chat_request_accepts_mode_field():
    from src.api.models import ChatRequest
    req = ChatRequest(message="hello", mode="intake")
    assert req.mode == "intake"


def test_chat_request_mode_defaults_to_none():
    from src.api.models import ChatRequest
    req = ChatRequest(message="hello")
    assert req.mode is None
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest tests/test_intake_redesign.py::test_chat_request_accepts_mode_field \
       tests/test_intake_redesign.py::test_chat_request_mode_defaults_to_none -v
```

Expected: FAIL — `ChatRequest` has no `mode` field.

- [ ] **Step 3: Add `mode` to `ChatRequest`**

In `src/api/models.py`, find the `ChatRequest` class (around line 69):
```python
class ChatRequest(BaseModel):
    """Chat request model."""
    message: str
    user_id: Optional[str] = "default"
    stream: Optional[bool] = False
    patient_id: Optional[int] = None
    record_id: Optional[int] = None
    session_id: Optional[int] = None
```

Add `mode` as the last field:
```python
class ChatRequest(BaseModel):
    """Chat request model."""
    message: str
    user_id: Optional[str] = "default"
    stream: Optional[bool] = False
    patient_id: Optional[int] = None
    record_id: Optional[int] = None
    session_id: Optional[int] = None
    mode: Optional[str] = None
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pytest tests/test_intake_redesign.py::test_chat_request_accepts_mode_field \
       tests/test_intake_redesign.py::test_chat_request_mode_defaults_to_none -v
```

Expected: PASS.

- [ ] **Step 5: Wire intake agent in the chat handler**

In `src/api/routers/chat/messages.py`, find the `chat()` handler. There are two lines that call `get_or_create_agent`:

1. In the streaming path (around line 200):
```python
        # Get user-specific agent
        user_agent = get_or_create_agent(request.user_id)
```

Replace with:
```python
        # Select agent based on mode
        if request.mode == "intake":
            from ...dependencies import get_intake_agent
            user_agent = get_intake_agent()
        else:
            user_agent = get_or_create_agent(request.user_id)
```

- [ ] **Step 6: Verify server starts without errors**

```bash
python -c "from src.api.routers.chat.messages import router; print('ok')"
```

Expected: `ok` — no import errors.

- [ ] **Step 7: Commit**

```bash
git add src/api/models.py src/api/routers/chat/messages.py
git commit -m "feat(intake): add mode field to ChatRequest; route intake sessions to intake agent"
```

---

## Task 4: Field Classification Changes

**Files:**
- Modify: `src/forms/field_classification.py`
- Test: `tests/test_intake_redesign.py`

Context: `PATIENT_IDENTITY_FIELDS` currently = `{first_name, last_name, dob, gender}`. Adding `phone` means `_process_dynamic_input` will only trigger patient lookup when all 5 fields are present — matching the Step 1 identity form exactly. `height_cm` and `weight_kg` added to `SAFE_FIELDS` means their values are returned to the agent after Step 2.

- [ ] **Step 1: Add failing tests**

Add to `tests/test_intake_redesign.py`:
```python
def test_phone_is_in_patient_identity_fields():
    from src.forms.field_classification import PATIENT_IDENTITY_FIELDS
    assert "phone" in PATIENT_IDENTITY_FIELDS


def test_height_cm_is_safe_field():
    from src.forms.field_classification import SAFE_FIELDS
    assert "height_cm" in SAFE_FIELDS


def test_weight_kg_is_safe_field():
    from src.forms.field_classification import SAFE_FIELDS
    assert "weight_kg" in SAFE_FIELDS
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest tests/test_intake_redesign.py::test_phone_is_in_patient_identity_fields \
       tests/test_intake_redesign.py::test_height_cm_is_safe_field \
       tests/test_intake_redesign.py::test_weight_kg_is_safe_field -v
```

Expected: all FAIL.

- [ ] **Step 3: Update field_classification.py**

Replace the entire content of `src/forms/field_classification.py` with:
```python
"""PII field classification for dynamic form processing.

When the agent generates a form dynamically via show_form / ask_user_input,
the response handler uses this registry to decide which field values are safe
to return to the agent and which must be locked in the privacy vault.

Unknown fields default to PII treatment (values NOT returned to agent).
"""

# Fields that contain personally identifiable information.
# Their values are stored in the vault and NEVER returned to the agent.
PII_FIELDS: set[str] = {
    # Identity
    "first_name",
    "last_name",
    "dob",
    "gender",
    "ssn",
    # Contact
    "phone",
    "email",
    "address",
    # Insurance
    "insurance_provider",
    "policy_id",
    # Emergency contact
    "emergency_contact_name",
    "emergency_contact_relationship",
    "emergency_contact_phone",
}

# Fields whose values CAN be returned to the agent (non-PII / clinical).
SAFE_FIELDS: set[str] = {
    "chief_complaint",
    "symptoms",
    "preferred_language",
    "has_allergies",
    "allergy_details",
    "confirmed",
    # Vitals — numeric measurements, not PII
    "height_cm",
    "weight_kg",
}

# Subset of PII_FIELDS that triggers patient lookup/creation when ALL are present.
# Must match exactly what the identity step of the intake form collects.
PATIENT_IDENTITY_FIELDS: set[str] = {"first_name", "last_name", "dob", "gender", "phone"}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pytest tests/test_intake_redesign.py::test_phone_is_in_patient_identity_fields \
       tests/test_intake_redesign.py::test_height_cm_is_safe_field \
       tests/test_intake_redesign.py::test_weight_kg_is_safe_field -v
```

Expected: all PASS.

- [ ] **Step 5: Run the full test suite to check for regressions**

```bash
pytest tests/ -v --ignore=tests/test_intake_redesign.py -x -q 2>&1 | tail -20
```

Expected: same pass/fail ratio as before (149 passing, 7 pre-existing failures unrelated to our changes).

- [ ] **Step 6: Commit**

```bash
git add src/forms/field_classification.py tests/test_intake_redesign.py
git commit -m "feat(intake): add phone to PATIENT_IDENTITY_FIELDS; height_cm/weight_kg to SAFE_FIELDS"
```

---

## Task 5: VitalSign Creation + Session Patient ID in `_process_dynamic_input`

**Files:**
- Modify: `src/api/routers/chat/messages.py`
- Test: `tests/test_intake_redesign.py`

Context: The two-step intake flow means `patient_id` is resolved in Step 1 (identity form) but needed again in Step 2 (clinical form). We use `form_registry.accumulate_answers(session_id, {"__patient_id": str(patient_id)})` after Step 1 to store it, then recover it via `form_registry.get_accumulated_answers(session_id)` in Step 2.

`VitalSign` model fields: `patient_id` (int, required), `recorded_at` (DateTime, required), `height_cm` (Float, nullable), `weight_kg` (Float, nullable). Both height and weight come in as strings from form answers and need `float()` conversion.

`save_intake` should be called in Step 2 when `patient_id` is known and clinical fields are present, so that `chief_complaint`/`symptoms` are persisted to `IntakeSubmission`.

The complete new `_process_dynamic_input` function (replace the existing one in full):

- [ ] **Step 1: Add test for unknown-fields classification**

Add to `tests/test_intake_redesign.py`:
```python
def test_height_cm_not_in_unknown_fields():
    """height_cm must not fall into the 'unknown' bucket after classification."""
    from src.forms.field_classification import PII_FIELDS, SAFE_FIELDS
    field = "height_cm"
    assert field in SAFE_FIELDS
    assert field not in PII_FIELDS
```

- [ ] **Step 2: Run test**

```bash
pytest tests/test_intake_redesign.py::test_height_cm_not_in_unknown_fields -v
```

Expected: PASS (we already updated SAFE_FIELDS in Task 4).

- [ ] **Step 3: Update imports in messages.py**

In `src/api/routers/chat/messages.py`, find the existing import:
```python
from src.models import get_db, Patient, MedicalRecord, ChatSession, ChatMessage, AsyncSessionLocal
```

Replace with:
```python
from src.models import get_db, Patient, MedicalRecord, ChatSession, ChatMessage, AsyncSessionLocal, VitalSign
```

Also add at the top of the file alongside the other stdlib imports:
```python
from datetime import datetime, timezone
```

- [ ] **Step 4: Replace `_process_dynamic_input` with the new implementation**

Find the existing `_process_dynamic_input` function (lines 117–159) and replace it entirely:

```python
async def _process_dynamic_input(session_id: int, answers: dict[str, str]) -> str:
    """Process a dynamically generated form submission.

    Classifies fields as PII or safe, stores PII in the vault,
    threads patient_id across multi-step forms via the session accumulator,
    creates a VitalSign when height/weight are present, and returns
    opaque IDs + safe field values to the agent.
    """
    result_parts: list[str] = []

    # --- Step 1: resolve patient identity ---
    has_identity = PATIENT_IDENTITY_FIELDS.issubset(answers.keys())
    patient_id: int | None = None

    if has_identity:
        try:
            patient_id, is_new = await identify_patient(answers)
            result_parts.append(f"patient_id={patient_id}")
            result_parts.append(f"is_new={'true' if is_new else 'false'}")
            # Persist patient_id for subsequent steps in this session.
            form_registry.accumulate_answers(session_id, {"__patient_id": str(patient_id)})
        except Exception as e:
            logger.error("identify_patient failed: %s", e, exc_info=True)
            raise HTTPException(status_code=500, detail="Failed to identify patient")
    else:
        # Recover patient_id established in a previous step of this session.
        accumulated = form_registry.get_accumulated_answers(session_id)
        pid_str = accumulated.get("__patient_id")
        if pid_str:
            patient_id = int(pid_str)

    # --- Step 2: create VitalSign when height/weight are provided ---
    height_cm_str = answers.get("height_cm", "").strip()
    weight_kg_str = answers.get("weight_kg", "").strip()
    if patient_id and (height_cm_str or weight_kg_str):
        try:
            async with AsyncSessionLocal() as db:
                vital = VitalSign(
                    patient_id=patient_id,
                    recorded_at=datetime.now(timezone.utc),
                    height_cm=float(height_cm_str) if height_cm_str else None,
                    weight_kg=float(weight_kg_str) if weight_kg_str else None,
                )
                db.add(vital)
                await db.commit()
            result_parts.append("vitals_recorded=true")
        except Exception as e:
            logger.error("VitalSign creation failed: %s", e, exc_info=True)

    # --- Step 3: persist intake data ---
    pii_answers = {k: v for k, v in answers.items() if k in PII_FIELDS}
    has_clinical = bool(answers.get("chief_complaint") or answers.get("symptoms"))

    # Call save_intake when:
    # - Step 1 (identity present + PII fields), OR
    # - Step 2 (patient already known from session + clinical fields present)
    if (pii_answers and has_identity) or (patient_id and not has_identity and has_clinical):
        try:
            _pid, intake_id = await save_intake(answers, patient_id=patient_id)
            result_parts.append(f"intake_id={intake_id}")
        except Exception as e:
            logger.error("save_intake failed: %s", e, exc_info=True)
            raise HTTPException(status_code=500, detail="Failed to save intake data")

    # --- Step 4: return safe field values to agent ---
    safe_answers = {k: v for k, v in answers.items() if k in SAFE_FIELDS}
    for k, v in safe_answers.items():
        result_parts.append(f"{k}={v}")

    # Note any unknown fields collected (values NOT returned).
    unknown = {
        k for k in answers
        if k not in PII_FIELDS and k not in SAFE_FIELDS and not k.startswith("__")
    }
    if unknown:
        result_parts.append(f"additional_fields_collected={','.join(sorted(unknown))}")

    prefix = "form_completed"
    return f"{prefix}. {', '.join(result_parts)}" if result_parts else "form_completed."
```

- [ ] **Step 5: Verify the import chain works**

```bash
python -c "from src.api.routers.chat.messages import _process_dynamic_input; print('ok')"
```

Expected: `ok` — no import errors.

- [ ] **Step 6: Run full test suite**

```bash
pytest tests/ -q 2>&1 | tail -10
```

Expected: same passing count as before — no new failures.

- [ ] **Step 7: Commit**

```bash
git add src/api/routers/chat/messages.py tests/test_intake_redesign.py
git commit -m "feat(intake): create VitalSign from height/weight; thread patient_id across dynamic form steps"
```

---

## Task 6: IntakeSubmission Nullable Columns + Vault + Migration

**Files:**
- Modify: `src/models/intake_submission.py`
- Modify: `src/forms/vault.py`
- Modify: `alembic/versions/001_init.py`
- Test: `tests/test_intake_redesign.py`

Context: Seven fields are no longer collected (`email`, `address`, `insurance_provider`, `policy_id`, `emergency_contact_name`, `emergency_contact_relationship`, `emergency_contact_phone`). Making them nullable in the model + migration lets existing code insert rows without those fields. The vault's `_get()` helper returns `""` for missing fields — we change it to `or None` for nullable columns so the DB stores `NULL` rather than empty string.

`chief_complaint` stays non-nullable (it's required in Step 2). `phone` stays non-nullable (required in Step 1). `symptoms` is already nullable.

- [ ] **Step 1: Add failing tests**

Add to `tests/test_intake_redesign.py`:
```python
def test_intake_submission_nullable_columns():
    """email and dropped fields must be Optional on the model."""
    import inspect
    from src.models.intake_submission import IntakeSubmission
    hints = IntakeSubmission.__annotations__
    from typing import get_args, get_origin, Union
    import types

    nullable_fields = [
        "email", "address", "insurance_provider", "policy_id",
        "emergency_contact_name", "emergency_contact_relationship",
        "emergency_contact_phone",
    ]
    for field in nullable_fields:
        assert field in hints, f"Missing annotation for {field}"
        hint = hints[field]
        # SQLAlchemy Mapped[Optional[str]] → check Optional
        args = get_args(hint)
        inner = args[0] if args else hint
        inner_args = get_args(inner)
        assert type(None) in inner_args, (
            f"{field} should be Optional but got {hint}"
        )
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pytest tests/test_intake_redesign.py::test_intake_submission_nullable_columns -v
```

Expected: FAIL — currently those fields are `Mapped[str]` (non-Optional).

- [ ] **Step 3: Update IntakeSubmission model**

Replace `src/models/intake_submission.py` entirely:
```python
"""Privacy vault for patient intake PII."""
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class IntakeSubmission(Base):
    """Stores raw patient intake PII, keyed by opaque UUID.

    The agent never receives these values — it only receives the
    (patient_id, intake_id) pair returned by vault.save_intake().
    """
    __tablename__ = "intake_submissions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"), nullable=False, index=True)

    # Personal info (always collected)
    first_name: Mapped[str] = mapped_column(String(100))
    last_name: Mapped[str] = mapped_column(String(100))
    dob: Mapped[str] = mapped_column(String(20))
    gender: Mapped[str] = mapped_column(String(20))

    # Contact
    phone: Mapped[str] = mapped_column(String(30))
    email: Mapped[Optional[str]] = mapped_column(String(254), nullable=True)
    address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Visit
    chief_complaint: Mapped[str] = mapped_column(Text)
    symptoms: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Insurance — no longer collected; kept for future use
    insurance_provider: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    policy_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # Emergency contact — no longer collected; kept for future use
    emergency_contact_name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    emergency_contact_relationship: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    emergency_contact_phone: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)

    # JSON blob for dynamic fields that don't map to fixed columns above.
    extra_data: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    # No back_populates on Patient — intake submissions are write-only from
    # the agent's perspective. The agent only ever receives opaque IDs.
    patient: Mapped["Patient"] = relationship("Patient")
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pytest tests/test_intake_redesign.py::test_intake_submission_nullable_columns -v
```

Expected: PASS.

- [ ] **Step 5: Update vault.py to use `or None` for nullable columns**

In `src/forms/vault.py`, find the `submission = IntakeSubmission(...)` block (around lines 120–138). Change the lines for the newly-nullable fields:

```python
        submission = IntakeSubmission(
            id=str(uuid.uuid4()),
            patient_id=patient.id,
            first_name=first_name,
            last_name=last_name,
            dob=dob_val,
            gender=gender_val,
            phone=_get("phone"),
            email=_get("email") or None,
            address=_get("address") or None,
            chief_complaint=_get("chief_complaint"),
            symptoms=_get("symptoms") or None,
            insurance_provider=_get("insurance_provider") or None,
            policy_id=_get("policy_id") or None,
            emergency_contact_name=_get("emergency_contact_name") or None,
            emergency_contact_relationship=_get("emergency_contact_relationship") or None,
            emergency_contact_phone=_get("emergency_contact_phone") or None,
            extra_data=json.dumps(extra) if extra else None,
        )
```

- [ ] **Step 6: Update migration — change nullable=False to nullable=True for 7 columns**

In `alembic/versions/001_init.py`, in the `intake_submissions` table block (around lines 36–55), update these 7 column definitions:

```python
        sa.Column("email", sa.String(254), nullable=True),
        sa.Column("address", sa.Text(), nullable=True),
        sa.Column("insurance_provider", sa.String(200), nullable=True),
        sa.Column("policy_id", sa.String(100), nullable=True),
        sa.Column("emergency_contact_name", sa.String(200), nullable=True),
        sa.Column("emergency_contact_relationship", sa.String(50), nullable=True),
        sa.Column("emergency_contact_phone", sa.String(30), nullable=True),
```

Leave all other columns unchanged.

- [ ] **Step 7: Run the full test suite**

```bash
pytest tests/ -q 2>&1 | tail -10
```

Expected: same passing count — no new failures.

- [ ] **Step 8: Commit**

```bash
git add src/models/intake_submission.py src/forms/vault.py alembic/versions/001_init.py tests/test_intake_redesign.py
git commit -m "feat(intake): make email/insurance/emergency-contact columns nullable; update vault and migration"
```

---

## Task 7: Frontend — Remove Legacy Flat-Fields Fallback

**Files:**
- Modify: `web/components/reception/form-input-bar.tsx`

Context: `form-input-bar.tsx` has two code paths — a modern one using `schema.sections` from the backend, and a legacy one that groups a flat `schema.fields` array into sections using `SECTION_LABELS`. The legacy path is dead code: the backend always sends `sections` for dynamic forms. Remove it entirely.

Current file structure:
- Lines 38–44: `SECTION_LABELS` constant — **delete**
- Lines 46–77: `buildSections()` — **replace with sections-only version**
- Lines 79–91: `flattenFields()` — **replace with sections-only version**
- Line 19: `fields?: FormFieldDef[]` in `ActiveForm.schema` type — **remove**

- [ ] **Step 1: Remove `SECTION_LABELS` constant**

In `web/components/reception/form-input-bar.tsx`, delete lines 37–44:
```typescript
/** Legacy fallback: maps the first field in each section to a label. */
const SECTION_LABELS: Record<string, string> = {
  first_name: "Personal Info",
  phone: "Contact",
  chief_complaint: "Visit Details",
  insurance_provider: "Insurance",
  emergency_contact_name: "Emergency Contact",
};
```

- [ ] **Step 2: Replace `buildSections` with sections-only version**

Replace the entire `buildSections` function (lines 46–77) with:
```typescript
/** Build sections from backend-provided schema. */
function buildSections(schema: ActiveForm["schema"]): Section[] {
  if (!schema.sections || schema.sections.length === 0) return [];
  return schema.sections.map((s) => ({
    label: s.label,
    fields: s.fields.map((f) => ({
      ...f,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      field_type: f.field_type || (f as any).type || "text",
    })),
  }));
}
```

- [ ] **Step 3: Replace `flattenFields` with sections-only version**

Replace the entire `flattenFields` function (lines 79–91) with:
```typescript
/** Flatten all fields from all sections into a single array. */
function flattenFields(schema: ActiveForm["schema"]): FormFieldDef[] {
  if (!schema.sections || schema.sections.length === 0) return [];
  return schema.sections.flatMap((s) =>
    s.fields.map((f) => ({
      ...f,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      field_type: f.field_type || (f as any).type || "text",
    }))
  );
}
```

- [ ] **Step 4: Remove `fields?` from `ActiveForm.schema` type**

In the `ActiveForm` interface (lines 9–24), remove the line:
```typescript
    // Legacy forms provide a flat fields array.
    fields?: FormFieldDef[];
```

The final `ActiveForm` interface should be:
```typescript
export interface ActiveForm {
  id: string;
  template: string;
  schema: {
    title: string;
    form_type: "multi_field" | "yes_no" | "question";
    message?: string;
    // Dynamic forms provide sections directly from the backend.
    sections?: Array<{ label: string; fields: FormFieldDef[] }>;
    // Question form type
    choices?: string[];
    allow_multiple?: boolean;
  };
}
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd web && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors referencing `form-input-bar.tsx`. (Pre-existing errors in unrelated files are acceptable.)

- [ ] **Step 6: Commit**

```bash
git add web/components/reception/form-input-bar.tsx
git commit -m "refactor(intake): remove legacy flat-fields fallback from FormInputBar"
```

---

## Self-Review

### Spec Coverage Check

| Spec Requirement | Task |
|-----------------|------|
| New intake system prompt (`src/prompt/intake.py`) | Task 1 |
| Intake mode routing via `mode: "intake"` field | Task 3 |
| Intake agent in dependencies | Task 2 |
| `phone` added to `PATIENT_IDENTITY_FIELDS` | Task 4 |
| `height_cm`, `weight_kg` added to `SAFE_FIELDS` | Task 4 |
| `_process_dynamic_input` creates VitalSign | Task 5 |
| Session `patient_id` threaded via accumulator | Task 5 |
| `save_intake` called for Step 2 clinical data | Task 5 |
| IntakeSubmission nullable columns | Task 6 |
| vault.py `or None` for nullable columns | Task 6 |
| Migration updated for nullable columns | Task 6 |
| Frontend SECTION_LABELS removed | Task 7 |
| Frontend buildSections legacy branch removed | Task 7 |
| Frontend flattenFields legacy branch removed | Task 7 |
| Frontend `fields?` type removed | Task 7 |

All spec requirements are covered. No TBDs or placeholders.
