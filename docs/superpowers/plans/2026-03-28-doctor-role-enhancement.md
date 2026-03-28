# Doctor Role Enhancement — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the doctor workspace from a basic queue+chat interface into a full clinical workstation — enriched patient cards, proactive pre-visit brief, one-click SOAP draft, differential diagnosis panel, specialist consultation, lab/imaging orders, and shift handoff generation.

**Architecture:** New `urgency_level` field on Visit. New `orders` table + CRUD API. Four new backend tools (pre-visit brief, DDx, create-order, shift-handoff) registered to the Doctor Agent. Five new frontend components integrated into the existing two-panel layout. Specialist agents added to `CORE_AGENTS`.

**Tech Stack:** FastAPI, SQLAlchemy (async + sync), Alembic, LangChain tools, Next.js 16 App Router, TypeScript, Tailwind CSS v4, Shadcn/ui

---

## File Map

### Created
- `src/models/order.py` — Order SQLAlchemy model (lab/imaging orders per visit)
- `src/api/routers/orders.py` — Orders CRUD endpoints
- `src/tools/builtin/pre_visit_brief_tool.py` — AI tool: assemble structured patient brief from DB
- `src/tools/builtin/differential_diagnosis_tool.py` — AI tool: DDx with ICD-10 codes via LLM
- `src/tools/builtin/create_order_tool.py` — AI tool: create lab/imaging order
- `src/tools/builtin/shift_handoff_tool.py` — AI tool: generate shift handoff document
- `alembic/versions/260329_add_urgency_to_visits.py` — urgency_level on visits
- `alembic/versions/260329b_create_orders_table.py` — orders table
- `web/components/doctor/pre-visit-brief-card.tsx` — Auto-generated patient brief card
- `web/components/doctor/ddx-panel.tsx` — Differential Diagnosis structured panel
- `web/components/doctor/specialist-consult-panel.tsx` — Specialist second opinion chat panel
- `web/components/doctor/orders-panel.tsx` — Lab & Imaging orders UI
- `web/components/doctor/shift-handoff-modal.tsx` — Shift handoff generator modal
- `tests/test_doctor_tools.py` — Unit tests for new doctor tools

### Modified
- `src/models/visit.py` — add `urgency_level: Mapped[Optional[str]]`
- `src/models/__init__.py` — export `Order`
- `src/api/models.py` — add `urgency_level` + `wait_minutes` to `VisitListResponse`; add `OrderCreate`, `OrderResponse`, `DDxResponse`, `HandoffResponse`
- `src/api/routers/visits.py` — include urgency + wait_minutes in list; add `/ddx` and `/handoff` endpoints
- `src/api/server.py` — import and register orders router
- `src/agent/core_agents.py` — add new tools to Doctor Agent; add Cardiologist, Neurologist, Pulmonologist specialist agents
- `web/components/doctor/active-patients-queue.tsx` — urgency badge, chief complaint, wait time on each card
- `web/components/doctor/clinical-notes-editor.tsx` — "Draft with AI" button
- `web/components/doctor/quick-actions-bar.tsx` — "End Shift" button
- `web/app/(dashboard)/doctor/page.tsx` — integrate new panels
- `web/app/(dashboard)/doctor/use-doctor-workspace.ts` — state + handlers for all new features
- `web/lib/api.ts` — add API functions for orders, DDx, brief, handoff

---

## Task 1: Add urgency_level to Visit model

**Files:**
- Modify: `src/models/visit.py`
- Create: `alembic/versions/260329_add_urgency_to_visits.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_doctor_tools.py
import pytest
from src.models import SessionLocal, Visit

def test_visit_has_urgency_level_field():
    """Visit model must expose urgency_level attribute."""
    v = Visit()
    assert hasattr(v, "urgency_level")
    v.urgency_level = "urgent"
    assert v.urgency_level == "urgent"
```

- [ ] **Step 2: Run test — expect AttributeError or failure**

```bash
pytest tests/test_doctor_tools.py::test_visit_has_urgency_level_field -v
```

Expected: FAIL

- [ ] **Step 3: Add field to Visit model**

In `src/models/visit.py`, after the `assigned_doctor` field (line 54), add:

```python
    urgency_level: Mapped[Optional[str]] = mapped_column(
        String(20), nullable=True
    )  # "routine" | "urgent" | "critical"
```

- [ ] **Step 4: Create Alembic migration**

```python
# alembic/versions/260329_add_urgency_to_visits.py
"""add urgency_level to visits

Revision ID: 260329_visits_urgency
Revises: 260328_visits_doctor_fields
Create Date: 2026-03-29
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '260329_visits_urgency'
down_revision: Union[str, Sequence[str], None] = '260328_visits_doctor_fields'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    op.add_column('visits', sa.Column('urgency_level', sa.String(20), nullable=True))

def downgrade() -> None:
    op.drop_column('visits', 'urgency_level')
```

- [ ] **Step 5: Run migration**

```bash
alembic upgrade head
```

Expected: `Running upgrade 260328_visits_doctor_fields -> 260329_visits_urgency`

- [ ] **Step 6: Run test — expect PASS**

```bash
pytest tests/test_doctor_tools.py::test_visit_has_urgency_level_field -v
```

- [ ] **Step 7: Commit**

```bash
git add src/models/visit.py alembic/versions/260329_add_urgency_to_visits.py tests/test_doctor_tools.py
git commit -m "feat: add urgency_level field to Visit model"
```

---

## Task 2: Add urgency_level + wait_minutes to visit list API

**Files:**
- Modify: `src/api/models.py`
- Modify: `src/api/routers/visits.py`

- [ ] **Step 1: Add fields to VisitListResponse in `src/api/models.py`**

In the `VisitListResponse` class (after line 316), change to:

```python
class VisitListResponse(VisitResponse):
    """Visit response for list view — includes patient_name, urgency, and wait time."""
    patient_name: str = "Unknown"
    urgency_level: Optional[str] = None
    wait_minutes: int = 0
```

Also add `urgency_level` to `VisitResponse` (after `assigned_doctor`, before `created_at`):

```python
    urgency_level: Optional[str] = None
```

- [ ] **Step 2: Update `_visit_to_response` and list endpoint in `src/api/routers/visits.py`**

Add import at top:

```python
from datetime import datetime, timezone
```

Update `_visit_to_response` to include urgency_level:

```python
def _visit_to_response(v: Visit) -> VisitResponse:
    return VisitResponse(
        id=v.id, visit_id=v.visit_id, patient_id=v.patient_id,
        status=v.status, confidence=v.confidence,
        routing_suggestion=v.routing_suggestion,
        routing_decision=v.routing_decision,
        chief_complaint=v.chief_complaint,
        intake_session_id=v.intake_session_id,
        reviewed_by=v.reviewed_by,
        current_department=v.current_department,
        queue_position=v.queue_position,
        clinical_notes=v.clinical_notes,
        assigned_doctor=v.assigned_doctor,
        urgency_level=v.urgency_level,
        created_at=v.created_at.isoformat(),
        updated_at=v.updated_at.isoformat(),
    )
```

Find the visit list endpoint (`GET /api/visits`) and locate where `VisitListResponse` objects are built. Update that section to compute wait_minutes and include urgency_level. Look for the line that constructs `VisitListResponse` and update it:

```python
now = datetime.now(timezone.utc)
created = v.created_at.replace(tzinfo=timezone.utc) if v.created_at.tzinfo is None else v.created_at
wait_minutes = int((now - created).total_seconds() / 60)

responses.append(VisitListResponse(
    **_visit_to_response(v).__dict__,
    patient_name=patient_name,
    urgency_level=v.urgency_level,
    wait_minutes=wait_minutes,
))
```

- [ ] **Step 3: Verify API response manually**

```bash
# Start the backend
python -m src.api.server

# In another terminal:
curl -s "http://localhost:8000/api/visits?exclude_status=completed" | python -m json.tool | grep -E "urgency|wait_minutes"
```

Expected: each visit has `"urgency_level": null` (or a value) and `"wait_minutes": <number>`

- [ ] **Step 4: Commit**

```bash
git add src/api/models.py src/api/routers/visits.py
git commit -m "feat: add urgency_level and wait_minutes to visit list response"
```

---

## Task 3: Enrich patient queue cards (frontend)

**Files:**
- Modify: `web/components/doctor/active-patients-queue.tsx`
- Modify: `web/lib/api.ts`

- [ ] **Step 1: Update VisitListItem type in `web/lib/api.ts`**

Find the `VisitListItem` interface and add the new fields:

```typescript
export interface VisitListItem extends Visit {
  patient_name: string;
  urgency_level?: "routine" | "urgent" | "critical" | null;
  wait_minutes?: number;
}
```

- [ ] **Step 2: Replace table layout with card grid in `web/components/doctor/active-patients-queue.tsx`**

The component currently renders a table. Replace the inner content with enriched cards that show urgency, chief complaint, and wait time. Add a helper at the top of the file:

```typescript
function UrgencyBadge({ level }: { level?: string | null }) {
  const config = {
    critical: { label: "Critical", className: "bg-red-100 text-red-700 border-red-200" },
    urgent: { label: "Urgent", className: "bg-amber-100 text-amber-700 border-amber-200" },
    routine: { label: "Routine", className: "bg-green-100 text-green-700 border-green-200" },
  };
  const c = config[level as keyof typeof config] ?? config.routine;
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${c.className}`}>
      {c.label}
    </span>
  );
}
```

Replace the table rows with card items:

```typescript
<div className="space-y-2">
  {visits.map((visit) => (
    <button
      key={visit.id}
      onClick={() => onSelectVisit(visit)}
      className="w-full text-left p-3 rounded-lg border border-border hover:bg-accent transition-colors"
    >
      <div className="flex items-center justify-between mb-1">
        <span className="font-medium text-sm">{visit.patient_name}</span>
        <UrgencyBadge level={visit.urgency_level} />
      </div>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="font-mono">{visit.visit_id}</span>
        {visit.current_department && (
          <span>· {visit.current_department}</span>
        )}
        {visit.wait_minutes !== undefined && (
          <span>· {visit.wait_minutes}m wait</span>
        )}
      </div>
      {visit.chief_complaint && (
        <p className="text-xs text-muted-foreground mt-1 truncate">
          {visit.chief_complaint}
        </p>
      )}
    </button>
  ))}
</div>
```

- [ ] **Step 3: Verify visually**

Navigate to `http://localhost:3000/dashboard/doctor`. The queue should show card-style items with urgency badges and wait times.

- [ ] **Step 4: Commit**

```bash
git add web/components/doctor/active-patients-queue.tsx web/lib/api.ts
git commit -m "feat: enrich doctor queue cards with urgency badge, wait time, chief complaint"
```

---

## Task 4: Pre-visit brief tool (backend)

**Files:**
- Create: `src/tools/builtin/pre_visit_brief_tool.py`
- Modify: `src/agent/core_agents.py`

- [ ] **Step 1: Write failing test in `tests/test_doctor_tools.py`**

```python
from unittest.mock import patch, MagicMock

def test_pre_visit_brief_returns_structured_data(db_session):
    """pre_visit_brief tool returns a formatted string with patient sections."""
    from src.tools.builtin.pre_visit_brief_tool import pre_visit_brief

    # Create a patient and visit in the test DB
    from src.models.patient import Patient
    from src.models.visit import Visit
    patient = Patient(name="John Doe", dob="1970-01-01", gender="Male")
    db_session.add(patient)
    db_session.flush()

    visit = Visit(
        visit_id="VIS-20260329-001",
        patient_id=patient.id,
        status="in_department",
        chief_complaint="Chest pain",
        urgency_level="urgent",
    )
    db_session.add(visit)
    db_session.commit()

    result = pre_visit_brief(patient_id=patient.id, visit_id=visit.id)

    assert "John Doe" in result
    assert "Chest pain" in result
    assert "urgent" in result.lower()
```

- [ ] **Step 2: Run test — expect ImportError or FAIL**

```bash
pytest tests/test_doctor_tools.py::test_pre_visit_brief_returns_structured_data -v
```

- [ ] **Step 3: Create `src/tools/builtin/pre_visit_brief_tool.py`**

```python
"""Pre-visit brief tool — assembles a structured patient summary for the doctor.

Queries patient demographics, current visit, and recent medical records
from the database and formats them as a readable brief. No LLM call —
pure DB aggregation for speed and reliability.
"""
import logging
from typing import Optional
from sqlalchemy import select, desc

from src.models import SessionLocal, Visit, Patient, MedicalRecord
from src.tools.registry import ToolRegistry

logger = logging.getLogger(__name__)


def pre_visit_brief(patient_id: int, visit_id: int) -> str:
    """Generate a structured pre-visit brief for a patient.

    Assembles patient demographics, current chief complaint, urgency level,
    and the last 3 medical records into a concise doctor briefing.

    Args:
        patient_id: The patient's database ID
        visit_id: The current visit's primary key ID

    Returns:
        Formatted brief string with demographics, chief complaint, and recent records
    """
    with SessionLocal() as db:
        patient = db.execute(
            select(Patient).where(Patient.id == patient_id)
        ).scalar_one_or_none()

        if not patient:
            return f"Error: Patient {patient_id} not found."

        visit = db.execute(
            select(Visit).where(Visit.id == visit_id)
        ).scalar_one_or_none()

        if not visit:
            return f"Error: Visit {visit_id} not found."

        # Fetch last 3 medical records
        records = db.execute(
            select(MedicalRecord)
            .where(MedicalRecord.patient_id == patient_id)
            .order_by(desc(MedicalRecord.created_at))
            .limit(3)
        ).scalars().all()

        # Build brief
        urgency = (visit.urgency_level or "routine").upper()
        lines = [
            f"# Pre-Visit Brief — {patient.name}",
            f"**Urgency:** {urgency}",
            f"**DOB:** {patient.dob}  |  **Gender:** {patient.gender}",
            f"**Visit:** {visit.visit_id}  |  **Department:** {visit.current_department or 'Unassigned'}",
            "",
            f"**Chief Complaint:** {visit.chief_complaint or 'Not recorded'}",
            "",
        ]

        if records:
            lines.append("**Recent Records (last 3):**")
            for r in records:
                date = r.created_at.strftime("%Y-%m-%d") if r.created_at else "Unknown"
                preview = (r.summary or r.content or "")[:120]
                lines.append(f"- [{date}] {preview}{'...' if len(preview) == 120 else ''}")
        else:
            lines.append("**Recent Records:** No records on file.")

        return "\n".join(lines)


_registry = ToolRegistry()
_registry.register(
    pre_visit_brief,
    scope="assignable",
    symbol="pre_visit_brief",
    allow_overwrite=True,
)
```

- [ ] **Step 4: Run test — expect PASS**

```bash
pytest tests/test_doctor_tools.py::test_pre_visit_brief_returns_structured_data -v
```

- [ ] **Step 5: Add tool to Doctor Agent in `src/agent/core_agents.py`**

Update `DOCTOR_AGENT["tools"]` list and the tools description in `DOCTOR_AGENT_BASE_PROMPT`:

```python
# In DOCTOR_AGENT_BASE_PROMPT, update the Available Tools section:
"""**Available Tools:**
1. 'query_patient_basic_info' - Get patient demographics
2. 'query_patient_medical_records' - Get medical history and records
3. 'query_patient_imaging' - Get medical imaging records
4. 'save_clinical_note' - Save clinical notes for a patient visit
5. 'update_visit_status' - Update the status of a patient visit (e.g., discharge)
6. 'pre_visit_brief' - Generate a structured pre-visit patient brief (demographics + recent records)
7. 'generate_differential_diagnosis' - Generate ranked differential diagnoses with ICD-10 codes
8. 'create_order' - Create a lab or imaging order for the patient
9. 'generate_shift_handoff' - Generate a shift handoff document for all active patients"""
```

```python
DOCTOR_AGENT = {
    ...
    "tools": [
        "query_patient_basic_info",
        "query_patient_medical_records",
        "query_patient_imaging",
        "save_clinical_note",
        "update_visit_status",
        "pre_visit_brief",
        "generate_differential_diagnosis",
        "create_order",
        "generate_shift_handoff",
    ]
}
```

- [ ] **Step 6: Commit**

```bash
git add src/tools/builtin/pre_visit_brief_tool.py src/agent/core_agents.py tests/test_doctor_tools.py
git commit -m "feat: add pre_visit_brief tool to Doctor Agent"
```

---

## Task 5: Pre-visit brief card (frontend)

**Files:**
- Create: `web/components/doctor/pre-visit-brief-card.tsx`
- Modify: `web/app/(dashboard)/doctor/use-doctor-workspace.ts`
- Modify: `web/app/(dashboard)/doctor/page.tsx`

- [ ] **Step 1: Add API function to `web/lib/api.ts`**

After the `listActiveVisits` function, add:

```typescript
export async function getVisitBrief(visitId: number): Promise<{ brief: string }> {
  const response = await fetch(`${API_BASE_URL}/visits/${visitId}/brief`);
  if (!response.ok) throw new Error("Failed to fetch visit brief");
  return response.json();
}
```

- [ ] **Step 2: Add brief endpoint to `src/api/routers/visits.py`**

```python
from src.tools.builtin.pre_visit_brief_tool import pre_visit_brief as _pre_visit_brief_fn

@router.get("/api/visits/{visit_id}/brief")
async def get_visit_brief(visit_id: int, db: AsyncSession = Depends(get_db)):
    """Return a pre-visit patient brief assembled from DB data."""
    visit = await db.execute(select(Visit).where(Visit.id == visit_id))
    visit = visit.scalar_one_or_none()
    if not visit:
        raise HTTPException(status_code=404, detail="Visit not found")
    brief_text = _pre_visit_brief_fn(patient_id=visit.patient_id, visit_id=visit.id)
    return {"brief": brief_text}
```

- [ ] **Step 3: Create `web/components/doctor/pre-visit-brief-card.tsx`**

```typescript
"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Sparkles } from "lucide-react";

interface PreVisitBriefCardProps {
  brief: string;
  loading: boolean;
}

export function PreVisitBriefCard({ brief, loading }: PreVisitBriefCardProps) {
  const [expanded, setExpanded] = useState(true);

  if (loading) {
    return (
      <div className="border border-border rounded-lg p-3 mb-3 animate-pulse">
        <div className="h-4 bg-muted rounded w-1/3 mb-2" />
        <div className="h-3 bg-muted rounded w-full mb-1" />
        <div className="h-3 bg-muted rounded w-3/4" />
      </div>
    );
  }

  if (!brief) return null;

  return (
    <div className="border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 rounded-lg mb-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3 text-sm font-medium text-amber-800 dark:text-amber-300"
      >
        <span className="flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5" />
          Pre-Visit Brief
        </span>
        {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {expanded && (
        <div className="px-3 pb-3 text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed border-t border-amber-200 dark:border-amber-800 pt-2">
          {brief}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Add brief state to `use-doctor-workspace.ts`**

Add state and loading flag near the top of the hook:

```typescript
const [visitBrief, setVisitBrief] = useState<string>("");
const [briefLoading, setBriefLoading] = useState(false);
```

In the `selectVisit` function, after loading the patient, fetch the brief:

```typescript
setBriefLoading(true);
setVisitBrief("");
getVisitBrief(visit.id)
  .then((data) => setVisitBrief(data.brief))
  .catch(() => setVisitBrief(""))
  .finally(() => setBriefLoading(false));
```

Return from the hook:

```typescript
return {
  // ... existing returns ...
  visitBrief,
  briefLoading,
};
```

- [ ] **Step 5: Render brief card in `page.tsx`**

Import `PreVisitBriefCard` and destructure `visitBrief`, `briefLoading` from the workspace hook. In the right panel (AI panel section), render the card above the chat messages:

```typescript
// Inside the AI panel wrapper, before the messages list:
<PreVisitBriefCard brief={visitBrief} loading={briefLoading} />
```

- [ ] **Step 6: Verify visually**

Select a patient in the doctor workspace. The right panel should briefly show a loading skeleton, then display the pre-visit brief card above the chat area.

- [ ] **Step 7: Commit**

```bash
git add web/components/doctor/pre-visit-brief-card.tsx web/app/(dashboard)/doctor/use-doctor-workspace.ts web/app/(dashboard)/doctor/page.tsx web/lib/api.ts src/api/routers/visits.py
git commit -m "feat: proactive pre-visit brief card in doctor AI panel"
```

---

## Task 6: One-click SOAP draft

**Files:**
- Modify: `web/components/doctor/clinical-notes-editor.tsx`
- Modify: `web/app/(dashboard)/doctor/use-doctor-workspace.ts`

- [ ] **Step 1: Add `draftSoapNote` handler to `use-doctor-workspace.ts`**

The handler sends a standardized message to the AI chat which triggers the agent to generate a SOAP note. Add near the other handlers:

```typescript
const [draftingNote, setDraftingNote] = useState(false);

const draftSoapNote = async () => {
  if (!selectedPatient || !selectedVisit) return;
  setDraftingNote(true);

  // Send a specific prompt to the Doctor AI that triggers SOAP generation
  const prompt = `Please generate a SOAP clinical note for patient ${selectedPatient.name} (ID: ${selectedPatient.id}), visit ${selectedVisit.visit_id}. Chief complaint: ${selectedVisit.chief_complaint || "not recorded"}. Use the patient's medical records and current visit information. Format as: **S (Subjective):** ... **O (Objective):** ... **A (Assessment):** ... **P (Plan):** ...`;

  // Use the existing chat submit mechanism
  setChatInput(prompt);
  // Trigger submit programmatically
  await handleChatSubmitWithMessage(prompt);
  setDraftingNote(false);
  setActiveTab("notes"); // Switch to notes tab so doctor can review
};
```

Add a helper `handleChatSubmitWithMessage(message: string)` that sends without requiring form event:

```typescript
const handleChatSubmitWithMessage = async (message: string) => {
  // Extract the core of handleChatSubmit but accept a message param
  // Copy the chat submission logic from handleChatSubmit, substituting chatInput -> message
  // ... (follow same pattern as existing handleChatSubmit)
};
```

Return `draftSoapNote` and `draftingNote` from the hook.

- [ ] **Step 2: Add "Draft with AI" button to `clinical-notes-editor.tsx`**

Update the component props to accept the new callback:

```typescript
interface ClinicalNotesEditorProps {
  notes: string;
  onChange: (notes: string) => void;
  saving: boolean;
  saved: boolean;
  disabled?: boolean;
  onDraftWithAI?: () => void;
  drafting?: boolean;
}
```

Add the button in the editor header toolbar area:

```typescript
{onDraftWithAI && (
  <button
    onClick={onDraftWithAI}
    disabled={disabled || drafting}
    className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 disabled:opacity-50 transition-colors"
  >
    <Sparkles className="h-3 w-3" />
    {drafting ? "Drafting..." : "Draft with AI"}
  </button>
)}
```

- [ ] **Step 3: Wire in `page.tsx`**

Pass `onDraftWithAI={draftSoapNote}` and `drafting={draftingNote}` to `<ClinicalNotesEditor />`.

- [ ] **Step 4: Verify manually**

Open the Notes tab in the doctor workspace with a patient selected. Click "Draft with AI". The AI chat should receive the SOAP prompt, generate a response, and the workspace switches to notes tab.

- [ ] **Step 5: Commit**

```bash
git add web/components/doctor/clinical-notes-editor.tsx web/app/(dashboard)/doctor/use-doctor-workspace.ts web/app/(dashboard)/doctor/page.tsx
git commit -m "feat: one-click SOAP draft button triggers AI note generation"
```

---

## Task 7: Differential diagnosis tool (backend)

**Files:**
- Create: `src/tools/builtin/differential_diagnosis_tool.py`
- Modify: `src/api/models.py`
- Modify: `src/api/routers/visits.py`

- [ ] **Step 1: Write failing test in `tests/test_doctor_tools.py`**

```python
def test_ddx_tool_returns_json_string():
    """DDx tool returns valid JSON with diagnoses list."""
    import json
    from src.tools.builtin.differential_diagnosis_tool import generate_differential_diagnosis

    # We mock the LLM call so the test doesn't require a live API key
    mock_response = json.dumps({
        "diagnoses": [
            {
                "name": "Acute Coronary Syndrome",
                "icd10": "I24.9",
                "likelihood": "High",
                "evidence": "Chest pain, radiation to arm",
                "red_flags": ["Diaphoresis", "ST elevation"]
            }
        ]
    })

    with patch("src.tools.builtin.differential_diagnosis_tool._call_llm", return_value=mock_response):
        result = generate_differential_diagnosis(
            patient_id=1,
            chief_complaint="Chest pain radiating to left arm",
            context="67yo male, hypertensive"
        )

    parsed = json.loads(result)
    assert "diagnoses" in parsed
    assert len(parsed["diagnoses"]) >= 1
    assert "icd10" in parsed["diagnoses"][0]
```

- [ ] **Step 2: Create `src/tools/builtin/differential_diagnosis_tool.py`**

```python
"""Differential diagnosis tool — generates ranked DDx list with ICD-10 codes.

Uses the configured LLM provider to analyze symptoms and context,
then returns structured JSON with diagnoses, likelihood, evidence, and red flags.
"""
import json
import logging
from typing import Optional

from src.tools.registry import ToolRegistry

logger = logging.getLogger(__name__)

DDX_PROMPT_TEMPLATE = """You are an expert clinician. Given the patient information below, generate a ranked differential diagnosis list.

Chief Complaint: {chief_complaint}
Additional Context: {context}

Return ONLY valid JSON in this exact format (no markdown, no explanation):
{{
  "diagnoses": [
    {{
      "name": "Diagnosis name",
      "icd10": "ICD-10 code",
      "likelihood": "High|Medium|Low",
      "evidence": "Key supporting findings",
      "red_flags": ["flag1", "flag2"]
    }}
  ]
}}

Include 3-6 diagnoses ranked by likelihood (most likely first). Include at least one must-not-miss diagnosis."""


def _call_llm(prompt: str) -> str:
    """Call the configured LLM provider and return the raw text response."""
    from src.api.dependencies import llm_provider
    response = llm_provider.llm.invoke(prompt)
    return response.content if hasattr(response, "content") else str(response)


def generate_differential_diagnosis(
    patient_id: int,
    chief_complaint: str,
    context: Optional[str] = None,
) -> str:
    """Generate a ranked differential diagnosis list with ICD-10 codes.

    Args:
        patient_id: Patient's database ID (used for audit logging)
        chief_complaint: Patient's primary presenting complaint
        context: Additional clinical context (age, gender, history keywords)

    Returns:
        JSON string with diagnoses list: [{name, icd10, likelihood, evidence, red_flags}]
    """
    prompt = DDX_PROMPT_TEMPLATE.format(
        chief_complaint=chief_complaint,
        context=context or "No additional context provided",
    )

    try:
        raw = _call_llm(prompt)
        # Strip markdown code fences if present
        raw = raw.strip()
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[1].rsplit("```", 1)[0].strip()
        # Validate JSON
        parsed = json.loads(raw)
        assert "diagnoses" in parsed
        return json.dumps(parsed)
    except Exception as e:
        logger.error("DDx tool failed: %s", e)
        return json.dumps({"diagnoses": [], "error": str(e)})


_registry = ToolRegistry()
_registry.register(
    generate_differential_diagnosis,
    scope="assignable",
    symbol="generate_differential_diagnosis",
    allow_overwrite=True,
)
```

- [ ] **Step 3: Add DDx schemas to `src/api/models.py`**

```python
class DiagnosisItem(BaseModel):
    name: str
    icd10: str
    likelihood: str  # "High" | "Medium" | "Low"
    evidence: str
    red_flags: List[str] = []

class DDxResponse(BaseModel):
    visit_id: int
    chief_complaint: Optional[str] = None
    diagnoses: List[DiagnosisItem] = []
    error: Optional[str] = None
```

- [ ] **Step 4: Add `/ddx` endpoint to `src/api/routers/visits.py`**

```python
from src.tools.builtin.differential_diagnosis_tool import generate_differential_diagnosis as _ddx_fn
from ..models import DDxResponse, DiagnosisItem
import json

@router.post("/api/visits/{visit_id}/ddx", response_model=DDxResponse)
async def get_differential_diagnosis(visit_id: int, db: AsyncSession = Depends(get_db)):
    """Generate differential diagnoses for a visit based on chief complaint."""
    visit = await db.execute(select(Visit).where(Visit.id == visit_id))
    visit = visit.scalar_one_or_none()
    if not visit:
        raise HTTPException(status_code=404, detail="Visit not found")

    patient = await db.execute(select(Patient).where(Patient.id == visit.patient_id))
    patient = patient.scalar_one_or_none()

    context = f"{patient.dob}, {patient.gender}" if patient else None
    raw = _ddx_fn(
        patient_id=visit.patient_id,
        chief_complaint=visit.chief_complaint or "Not specified",
        context=context,
    )
    data = json.loads(raw)
    diagnoses = [DiagnosisItem(**d) for d in data.get("diagnoses", [])]
    return DDxResponse(
        visit_id=visit_id,
        chief_complaint=visit.chief_complaint,
        diagnoses=diagnoses,
        error=data.get("error"),
    )
```

- [ ] **Step 5: Run test — expect PASS**

```bash
pytest tests/test_doctor_tools.py::test_ddx_tool_returns_json_string -v
```

- [ ] **Step 6: Commit**

```bash
git add src/tools/builtin/differential_diagnosis_tool.py src/api/models.py src/api/routers/visits.py tests/test_doctor_tools.py
git commit -m "feat: add DDx tool and /visits/{id}/ddx endpoint"
```

---

## Task 8: Differential Diagnosis Panel (frontend)

**Files:**
- Create: `web/components/doctor/ddx-panel.tsx`
- Modify: `web/lib/api.ts`
- Modify: `web/app/(dashboard)/doctor/use-doctor-workspace.ts`
- Modify: `web/app/(dashboard)/doctor/page.tsx`

- [ ] **Step 1: Add API types and function to `web/lib/api.ts`**

```typescript
export interface DiagnosisItem {
  name: string;
  icd10: string;
  likelihood: "High" | "Medium" | "Low";
  evidence: string;
  red_flags: string[];
}

export interface DDxResponse {
  visit_id: number;
  chief_complaint?: string;
  diagnoses: DiagnosisItem[];
  error?: string;
}

export async function getDifferentialDiagnosis(visitId: number): Promise<DDxResponse> {
  const response = await fetch(`${API_BASE_URL}/visits/${visitId}/ddx`, {
    method: "POST",
  });
  if (!response.ok) throw new Error("Failed to generate differential diagnosis");
  return response.json();
}
```

- [ ] **Step 2: Create `web/components/doctor/ddx-panel.tsx`**

```typescript
"use client";

import { useState } from "react";
import { Brain, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import type { DiagnosisItem } from "@/lib/api";

interface DdxPanelProps {
  diagnoses: DiagnosisItem[];
  loading: boolean;
  onGenerate: () => void;
  disabled?: boolean;
  chiefComplaint?: string;
}

const likelihoodColor = {
  High: "text-red-600 bg-red-50 border-red-200",
  Medium: "text-amber-600 bg-amber-50 border-amber-200",
  Low: "text-slate-600 bg-slate-50 border-slate-200",
};

export function DdxPanel({ diagnoses, loading, onGenerate, disabled, chiefComplaint }: DdxPanelProps) {
  const [expanded, setExpanded] = useState<number | null>(null);

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="flex items-center justify-between p-3 bg-muted/30 border-b border-border">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-violet-600" />
          <span className="text-sm font-medium">Differential Diagnosis</span>
          {chiefComplaint && (
            <span className="text-xs text-muted-foreground truncate max-w-[160px]">
              · {chiefComplaint}
            </span>
          )}
        </div>
        <button
          onClick={onGenerate}
          disabled={disabled || loading}
          className="text-xs px-2.5 py-1 rounded-md bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50 transition-colors"
        >
          {loading ? "Generating..." : diagnoses.length ? "Refresh" : "Generate"}
        </button>
      </div>

      {diagnoses.length === 0 && !loading && (
        <p className="text-xs text-muted-foreground text-center py-6">
          Click Generate to run differential diagnosis
        </p>
      )}

      {loading && (
        <div className="space-y-2 p-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-muted animate-pulse rounded-md" />
          ))}
        </div>
      )}

      <div className="divide-y divide-border">
        {diagnoses.map((dx, i) => (
          <div key={i}>
            <button
              onClick={() => setExpanded(expanded === i ? null : i)}
              className="w-full flex items-center justify-between p-3 text-left hover:bg-accent/50 transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm font-medium truncate">{dx.name}</span>
                <span className="font-mono text-xs text-muted-foreground shrink-0">{dx.icd10}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-2">
                <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${likelihoodColor[dx.likelihood]}`}>
                  {dx.likelihood}
                </span>
                {expanded === i ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
              </div>
            </button>
            {expanded === i && (
              <div className="px-3 pb-3 text-xs space-y-1.5 bg-muted/20">
                <p><span className="font-medium">Evidence:</span> {dx.evidence}</p>
                {dx.red_flags.length > 0 && (
                  <div className="flex items-start gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 text-red-500 mt-0.5 shrink-0" />
                    <span className="text-red-600">{dx.red_flags.join(", ")}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Add DDx state to `use-doctor-workspace.ts`**

```typescript
import { getDifferentialDiagnosis, type DiagnosisItem } from "@/lib/api";

const [ddxDiagnoses, setDdxDiagnoses] = useState<DiagnosisItem[]>([]);
const [ddxLoading, setDdxLoading] = useState(false);

const generateDdx = async () => {
  if (!selectedVisit) return;
  setDdxLoading(true);
  setDdxDiagnoses([]);
  try {
    const result = await getDifferentialDiagnosis(selectedVisit.id);
    setDdxDiagnoses(result.diagnoses);
  } catch (e) {
    console.error("DDx failed:", e);
  } finally {
    setDdxLoading(false);
  }
};

// Reset DDx when patient changes
// Add to selectVisit: setDdxDiagnoses([]); setDdxLoading(false);
```

Return `ddxDiagnoses`, `ddxLoading`, `generateDdx` from the hook.

- [ ] **Step 4: Render DDx panel in `page.tsx`**

Add a new tab "DDx" to the workspace tabs, or render the panel below the clinical notes editor. Import and use `DdxPanel`:

```typescript
// In the patient tab content or as a new "DDx" tab:
<DdxPanel
  diagnoses={ddxDiagnoses}
  loading={ddxLoading}
  onGenerate={generateDdx}
  disabled={!selectedVisit}
  chiefComplaint={selectedVisit?.chief_complaint ?? undefined}
/>
```

- [ ] **Step 5: Verify visually**

Select a patient with a chief complaint. Click "Generate" on the DDx panel. Diagnoses should appear with ICD-10 codes, likelihood badges, and expandable evidence/red-flags.

- [ ] **Step 6: Commit**

```bash
git add web/components/doctor/ddx-panel.tsx web/lib/api.ts web/app/(dashboard)/doctor/use-doctor-workspace.ts web/app/(dashboard)/doctor/page.tsx
git commit -m "feat: differential diagnosis panel with ICD-10 codes and red flags"
```

---

## Task 9: Specialist agents (backend)

**Files:**
- Modify: `src/agent/core_agents.py`

- [ ] **Step 1: Add specialist agent definitions to `src/agent/core_agents.py`**

Add after `DOCTOR_AGENT`:

```python
def _make_specialist_agent(specialty: str, focus: str, color: str, icon: str) -> dict:
    prompt = f"""You are an expert {specialty} AI assistant providing specialist consultation to attending physicians.

**Your Role:** Provide targeted {specialty.lower()} insights for patient consultations. Be concise and clinically precise.

Your focus areas:
{focus}

Guidelines:
- Lead with the most clinically significant {specialty.lower()} findings
- Use standard medical terminology
- Suggest specialty-specific workup and management
- Highlight red flags that require urgent {specialty.lower()} intervention
- Reference evidence-based guidelines when relevant
- Format differentials clearly with likelihood
- **Wait for tool results before responding**"""

    return {{
        "name": f"{specialty} Consultant",
        "role": f"{specialty.lower()}_consultant",
        "description": f"Specialist {specialty} consultation — provides domain-expert clinical insights for patient encounters.",
        "system_prompt": prompt,
        "color": color,
        "icon": icon,
        "is_template": False,
        "tools": ["query_patient_basic_info", "query_patient_medical_records", "query_patient_imaging"],
    }}


CARDIOLOGIST_AGENT = _make_specialist_agent(
    specialty="Cardiology",
    focus="- Chest pain evaluation and ACS risk stratification\n- Heart failure assessment\n- Arrhythmia management\n- Hypertension and dyslipidemia\n- Cardiac imaging interpretation",
    color="#ef4444",
    icon="Heart",
)

NEUROLOGIST_AGENT = _make_specialist_agent(
    specialty="Neurology",
    focus="- Headache and migraine evaluation\n- Stroke risk assessment\n- Seizure management\n- Peripheral neuropathy\n- Cognitive decline assessment",
    color="#8b5cf6",
    icon="Brain",
)

PULMONOLOGIST_AGENT = _make_specialist_agent(
    specialty="Pulmonology",
    focus="- Dyspnea and cough evaluation\n- COPD and asthma management\n- Pneumonia assessment\n- Pulmonary embolism risk\n- Sleep-disordered breathing",
    color="#06b6d4",
    icon="Wind",
)

CORE_AGENTS = [INTERNIST_AGENT, DOCTOR_AGENT, CARDIOLOGIST_AGENT, NEUROLOGIST_AGENT, PULMONOLOGIST_AGENT]
```

- [ ] **Step 2: Verify agents seed correctly**

```bash
# Restart the backend and check logs
python -m src.api.server 2>&1 | grep -i "agent"
```

Expected: Cardiology, Neurology, Pulmonology agents appear in startup logs (or check `/api/agents` endpoint).

- [ ] **Step 3: Commit**

```bash
git add src/agent/core_agents.py
git commit -m "feat: add Cardiologist, Neurologist, Pulmonologist specialist agents"
```

---

## Task 10: Specialist consult panel (frontend)

**Files:**
- Create: `web/components/doctor/specialist-consult-panel.tsx`
- Modify: `web/app/(dashboard)/doctor/use-doctor-workspace.ts`
- Modify: `web/app/(dashboard)/doctor/page.tsx`
- Modify: `web/lib/api.ts`

- [ ] **Step 1: Add API function to fetch agents by role in `web/lib/api.ts`**

```typescript
export interface AgentInfo {
  id: number;
  name: string;
  role: string;
  color: string;
  icon: string;
}

export async function listAgents(): Promise<AgentInfo[]> {
  const response = await fetch(`${API_BASE_URL}/agents`);
  if (!response.ok) throw new Error("Failed to fetch agents");
  return response.json();
}
```

- [ ] **Step 2: Create `web/components/doctor/specialist-consult-panel.tsx`**

```typescript
"use client";

import { useState } from "react";
import { UserRoundSearch, Send, ChevronDown, ChevronUp } from "lucide-react";
import type { Message } from "@/types/agent-ui";

interface Specialist {
  id: number;
  name: string;
  role: string;
  color: string;
}

interface ConsultResult {
  specialist: Specialist;
  messages: Message[];
}

interface SpecialistConsultPanelProps {
  specialists: Specialist[];
  patientId?: number;
  visitId?: number;
  onConsult: (specialist: Specialist, question: string) => Promise<string>;
  disabled?: boolean;
}

export function SpecialistConsultPanel({
  specialists,
  patientId,
  visitId,
  onConsult,
  disabled,
}: SpecialistConsultPanelProps) {
  const [selected, setSelected] = useState<Specialist | null>(null);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ConsultResult[]>([]);
  const [openResult, setOpenResult] = useState<number | null>(null);

  const handleConsult = async () => {
    if (!selected || !question.trim()) return;
    setLoading(true);
    try {
      const response = await onConsult(selected, question);
      setResults((prev) => [
        { specialist: selected, messages: [{ id: Date.now().toString(), role: "assistant", content: response, timestamp: new Date() }] },
        ...prev,
      ]);
      setQuestion("");
      setOpenResult(0);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 p-3 bg-muted/30 border-b border-border">
        <UserRoundSearch className="h-4 w-4 text-blue-600" />
        <span className="text-sm font-medium">Specialist Consult</span>
      </div>

      <div className="p-3 space-y-2">
        {/* Specialist selector */}
        <div className="flex flex-wrap gap-1.5">
          {specialists.map((s) => (
            <button
              key={s.id}
              onClick={() => setSelected(selected?.id === s.id ? null : s)}
              className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-colors ${
                selected?.id === s.id
                  ? "text-white border-transparent"
                  : "text-muted-foreground border-border hover:border-foreground"
              }`}
              style={selected?.id === s.id ? { backgroundColor: s.color } : {}}
            >
              {s.name.replace(" Consultant", "")}
            </button>
          ))}
        </div>

        {selected && (
          <div className="flex gap-2">
            <input
              className="flex-1 text-xs px-2.5 py-1.5 rounded-md border border-border bg-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder={`Ask ${selected.name}...`}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleConsult(); }}}
              disabled={loading || disabled}
            />
            <button
              onClick={handleConsult}
              disabled={loading || !question.trim() || disabled}
              className="p-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {results.length > 0 && (
        <div className="border-t border-border divide-y divide-border">
          {results.map((r, i) => (
            <div key={i}>
              <button
                onClick={() => setOpenResult(openResult === i ? null : i)}
                className="w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-accent/50 transition-colors"
              >
                <span className="font-medium" style={{ color: r.specialist.color }}>
                  {r.specialist.name}
                </span>
                {openResult === i ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </button>
              {openResult === i && (
                <div className="px-3 pb-3 text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">
                  {r.messages[0]?.content}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Add consult handler to `use-doctor-workspace.ts`**

```typescript
const [specialists, setSpecialists] = useState<AgentInfo[]>([]);

// Load specialists on mount — filter to *_consultant roles
useEffect(() => {
  listAgents()
    .then((agents) => setSpecialists(agents.filter((a) => a.role.endsWith("_consultant"))))
    .catch(() => {});
}, []);

const consultSpecialist = async (specialist: { id: number; name: string }, question: string): Promise<string> => {
  // Send a one-shot chat message to the specialist agent
  const payload = {
    message: question + (selectedPatient ? ` (Patient ID: ${selectedPatient.id}, ${selectedPatient.name})` : ""),
    agent_id: specialist.id,
    patient_id: selectedPatient?.id,
  };
  const { message_id } = await sendChatMessage(payload);

  // Stream the response and collect full text
  return new Promise((resolve, reject) => {
    let fullContent = "";
    const cleanup = streamMessageUpdates(
      message_id,
      (event) => {
        if (event.type === "chunk" || event.type === "content") fullContent += event.content;
        if (event.type === "done") { cleanup(); resolve(fullContent); }
        if (event.type === "error") { cleanup(); reject(new Error(event.message)); }
      },
      (err) => { cleanup(); reject(err); }
    );
  });
};
```

Return `specialists` and `consultSpecialist` from the hook.

- [ ] **Step 4: Render panel in `page.tsx`**

Add `SpecialistConsultPanel` below the DDx panel in the doctor workspace:

```typescript
<SpecialistConsultPanel
  specialists={specialists}
  patientId={selectedPatient?.id}
  visitId={selectedVisit?.id}
  onConsult={consultSpecialist}
  disabled={!selectedPatient}
/>
```

- [ ] **Step 5: Verify visually**

Select a patient. Click "Cardiologist". Type a question like "Is this chest pain presentation concerning for ACS?" and press Enter. The response should appear in a collapsible result below.

- [ ] **Step 6: Commit**

```bash
git add web/components/doctor/specialist-consult-panel.tsx web/app/(dashboard)/doctor/use-doctor-workspace.ts web/app/(dashboard)/doctor/page.tsx web/lib/api.ts
git commit -m "feat: specialist consult panel with Cardiologist, Neurologist, Pulmonologist"
```

---

## Task 11: Order model + migration

**Files:**
- Create: `src/models/order.py`
- Create: `alembic/versions/260329b_create_orders_table.py`
- Modify: `src/models/__init__.py`

- [ ] **Step 1: Write failing test**

```python
def test_order_model_exists():
    """Order model has required fields."""
    from src.models.order import Order
    o = Order()
    assert hasattr(o, "visit_id")
    assert hasattr(o, "patient_id")
    assert hasattr(o, "order_type")
    assert hasattr(o, "order_name")
    assert hasattr(o, "status")
```

- [ ] **Step 2: Run test — expect ImportError**

```bash
pytest tests/test_doctor_tools.py::test_order_model_exists -v
```

- [ ] **Step 3: Create `src/models/order.py`**

```python
"""Order model — tracks lab and imaging orders created by doctors during visits."""
import enum
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Enum, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class OrderType(str, enum.Enum):
    LAB = "lab"
    IMAGING = "imaging"


class OrderStatus(str, enum.Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class Order(Base):
    """A lab or imaging order placed by a doctor during a patient visit."""
    __tablename__ = "orders"

    id: Mapped[int] = mapped_column(primary_key=True)
    visit_id: Mapped[int] = mapped_column(ForeignKey("visits.id"), index=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"), index=True)
    order_type: Mapped[str] = mapped_column(
        Enum(OrderType, values_callable=lambda x: [e.value for e in x]),
    )
    order_name: Mapped[str] = mapped_column(String(200))
    status: Mapped[str] = mapped_column(
        Enum(OrderStatus, values_callable=lambda x: [e.value for e in x]),
        default=OrderStatus.PENDING.value,
    )
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    ordered_by: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=func.now(), onupdate=func.now()
    )
```

- [ ] **Step 4: Create migration `alembic/versions/260329b_create_orders_table.py`**

```python
"""create orders table

Revision ID: 260329b_create_orders
Revises: 260329_visits_urgency
Create Date: 2026-03-29
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '260329b_create_orders'
down_revision: Union[str, Sequence[str], None] = '260329_visits_urgency'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    op.create_table(
        'orders',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('visit_id', sa.Integer(), sa.ForeignKey('visits.id'), nullable=False, index=True),
        sa.Column('patient_id', sa.Integer(), sa.ForeignKey('patients.id'), nullable=False, index=True),
        sa.Column('order_type', sa.String(20), nullable=False),
        sa.Column('order_name', sa.String(200), nullable=False),
        sa.Column('status', sa.String(20), nullable=False, server_default='pending'),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('ordered_by', sa.String(200), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now()),
    )

def downgrade() -> None:
    op.drop_table('orders')
```

- [ ] **Step 5: Export from `src/models/__init__.py`**

Add to imports:
```python
from .order import Order, OrderType, OrderStatus
```

Add to `__all__`:
```python
"Order", "OrderType", "OrderStatus",
```

- [ ] **Step 6: Run migration**

```bash
alembic upgrade head
```

- [ ] **Step 7: Run test — expect PASS**

```bash
pytest tests/test_doctor_tools.py::test_order_model_exists -v
```

- [ ] **Step 8: Commit**

```bash
git add src/models/order.py alembic/versions/260329b_create_orders_table.py src/models/__init__.py tests/test_doctor_tools.py
git commit -m "feat: add Order model and orders table migration"
```

---

## Task 12: Orders API router

**Files:**
- Create: `src/api/routers/orders.py`
- Modify: `src/api/models.py`
- Modify: `src/api/server.py`

- [ ] **Step 1: Add Order schemas to `src/api/models.py`**

```python
class OrderCreate(BaseModel):
    order_type: str  # "lab" | "imaging"
    order_name: str
    notes: Optional[str] = None
    ordered_by: Optional[str] = None

class OrderResponse(BaseModel):
    id: int
    visit_id: int
    patient_id: int
    order_type: str
    order_name: str
    status: str
    notes: Optional[str] = None
    ordered_by: Optional[str] = None
    created_at: str
```

- [ ] **Step 2: Create `src/api/routers/orders.py`**

```python
"""Orders API — create and list lab/imaging orders for a visit."""
import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models import get_db, Visit, Patient
from src.models.order import Order
from ..models import OrderCreate, OrderResponse

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Orders"])


@router.post("/api/visits/{visit_id}/orders", response_model=OrderResponse)
async def create_order(
    visit_id: int,
    body: OrderCreate,
    db: AsyncSession = Depends(get_db),
):
    """Create a lab or imaging order for a visit."""
    visit = await db.execute(select(Visit).where(Visit.id == visit_id))
    visit = visit.scalar_one_or_none()
    if not visit:
        raise HTTPException(status_code=404, detail="Visit not found")

    order = Order(
        visit_id=visit_id,
        patient_id=visit.patient_id,
        order_type=body.order_type,
        order_name=body.order_name,
        notes=body.notes,
        ordered_by=body.ordered_by,
    )
    db.add(order)
    await db.commit()
    await db.refresh(order)

    return OrderResponse(
        id=order.id,
        visit_id=order.visit_id,
        patient_id=order.patient_id,
        order_type=order.order_type,
        order_name=order.order_name,
        status=order.status,
        notes=order.notes,
        ordered_by=order.ordered_by,
        created_at=order.created_at.isoformat(),
    )


@router.get("/api/visits/{visit_id}/orders", response_model=list[OrderResponse])
async def list_orders(visit_id: int, db: AsyncSession = Depends(get_db)):
    """List all orders for a visit."""
    result = await db.execute(
        select(Order).where(Order.visit_id == visit_id).order_by(Order.created_at.desc())
    )
    orders = result.scalars().all()
    return [
        OrderResponse(
            id=o.id,
            visit_id=o.visit_id,
            patient_id=o.patient_id,
            order_type=o.order_type,
            order_name=o.order_name,
            status=o.status,
            notes=o.notes,
            ordered_by=o.ordered_by,
            created_at=o.created_at.isoformat(),
        )
        for o in orders
    ]
```

- [ ] **Step 3: Register router in `src/api/server.py`**

Add to imports:
```python
from .routers import patients, agents, tools, chat, usage, skills, visits, departments, hospital, auth, orders
```

Add after existing `app.include_router()` calls:
```python
app.include_router(orders.router)
```

- [ ] **Step 4: Verify endpoint**

```bash
# Restart backend, then:
curl -s -X POST "http://localhost:8000/api/visits/1/orders" \
  -H "Content-Type: application/json" \
  -d '{"order_type": "lab", "order_name": "CBC", "ordered_by": "Dr. Chen"}' | python -m json.tool
```

Expected: `{"id": 1, "visit_id": 1, "order_type": "lab", "order_name": "CBC", "status": "pending", ...}`

- [ ] **Step 5: Commit**

```bash
git add src/api/routers/orders.py src/api/models.py src/api/server.py
git commit -m "feat: orders API router — create and list lab/imaging orders per visit"
```

---

## Task 13: Create order tool (backend)

**Files:**
- Create: `src/tools/builtin/create_order_tool.py`

- [ ] **Step 1: Write failing test**

```python
def test_create_order_tool_returns_confirmation(db_session):
    """create_order tool persists order and returns confirmation."""
    from src.models.patient import Patient
    from src.models.visit import Visit
    from src.tools.builtin.create_order_tool import create_order

    patient = Patient(name="Jane Smith", dob="1985-06-15", gender="Female")
    db_session.add(patient)
    db_session.flush()

    visit = Visit(
        visit_id="VIS-20260329-002",
        patient_id=patient.id,
        status="in_department",
    )
    db_session.add(visit)
    db_session.commit()

    result = create_order(
        patient_id=patient.id,
        visit_id=visit.id,
        order_type="lab",
        order_name="CBC with differential",
        ordered_by="Dr. Chen",
    )

    assert "CBC" in result
    assert "created" in result.lower()
```

- [ ] **Step 2: Create `src/tools/builtin/create_order_tool.py`**

```python
"""Create order tool — allows the Doctor agent to place lab and imaging orders.

Self-registers at import time.
"""
import logging
from typing import Optional
from sqlalchemy import select

from src.models import SessionLocal, Visit
from src.models.order import Order
from src.tools.registry import ToolRegistry

logger = logging.getLogger(__name__)


def create_order(
    patient_id: int,
    visit_id: int,
    order_type: str,
    order_name: str,
    notes: Optional[str] = None,
    ordered_by: Optional[str] = None,
) -> str:
    """Create a lab or imaging order for a patient visit.

    Args:
        patient_id: The patient's database ID
        visit_id: The visit's primary key ID
        order_type: Type of order — "lab" or "imaging"
        order_name: Name of the test or study (e.g., "CBC", "Chest X-Ray")
        notes: Optional clinical notes or special instructions
        ordered_by: Name of the ordering physician

    Returns:
        Confirmation message with order details
    """
    if order_type not in ("lab", "imaging"):
        return f"Error: order_type must be 'lab' or 'imaging', got '{order_type}'."

    with SessionLocal() as db:
        visit = db.execute(select(Visit).where(Visit.id == visit_id)).scalar_one_or_none()
        if not visit:
            return f"Error: Visit {visit_id} not found."
        if visit.patient_id != patient_id:
            return f"Error: Visit {visit_id} does not belong to patient {patient_id}."

        order = Order(
            visit_id=visit_id,
            patient_id=patient_id,
            order_type=order_type,
            order_name=order_name,
            notes=notes,
            ordered_by=ordered_by,
        )
        db.add(order)
        db.commit()
        db.refresh(order)

        logger.info("Order %d created: %s for visit %s", order.id, order_name, visit.visit_id)
        return f"Order created successfully: {order_type.upper()} — {order_name} (Order ID: {order.id}, Status: pending)."


_registry = ToolRegistry()
_registry.register(
    create_order,
    scope="assignable",
    symbol="create_order",
    allow_overwrite=True,
)
```

- [ ] **Step 3: Run test — expect PASS**

```bash
pytest tests/test_doctor_tools.py::test_create_order_tool_returns_confirmation -v
```

- [ ] **Step 4: Commit**

```bash
git add src/tools/builtin/create_order_tool.py tests/test_doctor_tools.py
git commit -m "feat: create_order tool for Doctor Agent to place lab/imaging orders"
```

---

## Task 14: Orders panel (frontend)

**Files:**
- Create: `web/components/doctor/orders-panel.tsx`
- Modify: `web/lib/api.ts`
- Modify: `web/app/(dashboard)/doctor/use-doctor-workspace.ts`
- Modify: `web/app/(dashboard)/doctor/page.tsx`

- [ ] **Step 1: Add API types and functions to `web/lib/api.ts`**

```typescript
export interface Order {
  id: number;
  visit_id: number;
  patient_id: number;
  order_type: "lab" | "imaging";
  order_name: string;
  status: "pending" | "in_progress" | "completed" | "cancelled";
  notes?: string;
  ordered_by?: string;
  created_at: string;
}

export async function listOrders(visitId: number): Promise<Order[]> {
  const response = await fetch(`${API_BASE_URL}/visits/${visitId}/orders`);
  if (!response.ok) throw new Error("Failed to fetch orders");
  return response.json();
}

export async function createOrder(visitId: number, data: {
  order_type: "lab" | "imaging";
  order_name: string;
  notes?: string;
  ordered_by?: string;
}): Promise<Order> {
  const response = await fetch(`${API_BASE_URL}/visits/${visitId}/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error("Failed to create order");
  return response.json();
}
```

- [ ] **Step 2: Create `web/components/doctor/orders-panel.tsx`**

```typescript
"use client";

import { useState } from "react";
import { ClipboardList, Plus, TestTube, Scan } from "lucide-react";
import type { Order } from "@/lib/api";

interface OrdersPanelProps {
  orders: Order[];
  onCreateOrder: (type: "lab" | "imaging", name: string, notes?: string) => Promise<void>;
  disabled?: boolean;
  loading?: boolean;
}

const STATUS_STYLE = {
  pending: "text-amber-600 bg-amber-50",
  in_progress: "text-blue-600 bg-blue-50",
  completed: "text-green-600 bg-green-50",
  cancelled: "text-slate-500 bg-slate-100",
};

const QUICK_ORDERS = {
  lab: ["CBC", "BMP", "Troponin", "D-Dimer", "ABG", "Lipid Panel", "HbA1c"],
  imaging: ["Chest X-Ray", "CT Head", "CT Chest", "CT Abdomen/Pelvis", "ECG", "Echo"],
};

export function OrdersPanel({ orders, onCreateOrder, disabled, loading }: OrdersPanelProps) {
  const [orderType, setOrderType] = useState<"lab" | "imaging">("lab");
  const [orderName, setOrderName] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!orderName.trim()) return;
    setSubmitting(true);
    try {
      await onCreateOrder(orderType, orderName.trim(), notes.trim() || undefined);
      setOrderName("");
      setNotes("");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 p-3 bg-muted/30 border-b border-border">
        <ClipboardList className="h-4 w-4 text-teal-600" />
        <span className="text-sm font-medium">Orders</span>
        {orders.length > 0 && (
          <span className="ml-auto text-xs text-muted-foreground">{orders.length} order{orders.length !== 1 ? "s" : ""}</span>
        )}
      </div>

      {/* New order form */}
      <div className="p-3 border-b border-border space-y-2">
        <div className="flex gap-1.5">
          {(["lab", "imaging"] as const).map((t) => (
            <button
              key={t}
              onClick={() => { setOrderType(t); setOrderName(""); }}
              className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-md border font-medium transition-colors ${
                orderType === t
                  ? "bg-teal-600 text-white border-teal-600"
                  : "border-border text-muted-foreground hover:border-foreground"
              }`}
            >
              {t === "lab" ? <TestTube className="h-3 w-3" /> : <Scan className="h-3 w-3" />}
              {t === "lab" ? "Lab" : "Imaging"}
            </button>
          ))}
        </div>

        {/* Quick select */}
        <div className="flex flex-wrap gap-1">
          {QUICK_ORDERS[orderType].map((name) => (
            <button
              key={name}
              onClick={() => setOrderName(name)}
              className={`text-xs px-2 py-0.5 rounded border transition-colors ${
                orderName === name
                  ? "bg-teal-50 border-teal-300 text-teal-700"
                  : "border-border text-muted-foreground hover:border-foreground"
              }`}
            >
              {name}
            </button>
          ))}
        </div>

        <input
          className="w-full text-xs px-2.5 py-1.5 rounded-md border border-border bg-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          placeholder="Order name (or type custom)"
          value={orderName}
          onChange={(e) => setOrderName(e.target.value)}
          disabled={disabled || submitting}
        />

        <button
          onClick={handleSubmit}
          disabled={!orderName.trim() || disabled || submitting}
          className="w-full flex items-center justify-center gap-1.5 text-xs py-1.5 rounded-md bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          {submitting ? "Placing..." : "Place Order"}
        </button>
      </div>

      {/* Orders list */}
      {orders.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">No orders yet</p>
      ) : (
        <div className="divide-y divide-border">
          {orders.map((o) => (
            <div key={o.id} className="flex items-center justify-between px-3 py-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  {o.order_type === "lab" ? <TestTube className="h-3 w-3 text-muted-foreground shrink-0" /> : <Scan className="h-3 w-3 text-muted-foreground shrink-0" />}
                  <span className="text-xs font-medium truncate">{o.order_name}</span>
                </div>
                {o.notes && <p className="text-xs text-muted-foreground truncate pl-4">{o.notes}</p>}
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ml-2 ${STATUS_STYLE[o.status]}`}>
                {o.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Add orders state to `use-doctor-workspace.ts`**

```typescript
import { listOrders, createOrder, type Order } from "@/lib/api";

const [orders, setOrders] = useState<Order[]>([]);
const [ordersLoading, setOrdersLoading] = useState(false);

// In selectVisit, after loading the patient:
setOrders([]);
if (visit.id) {
  listOrders(visit.id).then(setOrders).catch(() => {});
}

const handleCreateOrder = async (
  type: "lab" | "imaging",
  name: string,
  notes?: string
) => {
  if (!selectedVisit) return;
  const order = await createOrder(selectedVisit.id, {
    order_type: type,
    order_name: name,
    notes,
    ordered_by: "Dr. " + (user?.name || "Unknown"),
  });
  setOrders((prev) => [order, ...prev]);
};
```

Return `orders`, `ordersLoading`, `handleCreateOrder`.

- [ ] **Step 4: Add Orders tab to `page.tsx`**

Add an "Orders" tab to the existing tab list, and render `<OrdersPanel>` in its content area.

- [ ] **Step 5: Verify visually**

Select a patient. Navigate to the Orders tab. Select "Lab" → "CBC" → click "Place Order". The order should appear in the list with status "pending".

- [ ] **Step 6: Commit**

```bash
git add web/components/doctor/orders-panel.tsx web/lib/api.ts web/app/(dashboard)/doctor/use-doctor-workspace.ts web/app/(dashboard)/doctor/page.tsx
git commit -m "feat: orders panel — place and track lab/imaging orders per visit"
```

---

## Task 15: Shift handoff tool + endpoint

**Files:**
- Create: `src/tools/builtin/shift_handoff_tool.py`
- Modify: `src/api/models.py`
- Modify: `src/api/routers/visits.py`

- [ ] **Step 1: Create `src/tools/builtin/shift_handoff_tool.py`**

```python
"""Shift handoff tool — generates a structured handoff document for all active patients.

Queries all in-department visits, assembles patient summaries, and uses the LLM
to format a handoff brief for the incoming doctor.
"""
import logging
from typing import Optional
from sqlalchemy import select

from src.models import SessionLocal, Visit, Patient
from src.models.order import Order
from src.models.visit import VisitStatus
from src.tools.registry import ToolRegistry

logger = logging.getLogger(__name__)

HANDOFF_PROMPT = """You are generating a clinical shift handoff document. Based on the patient data below, create a structured handoff for the incoming doctor.

Format each patient as:
**[Patient Name]** — Visit {visit_id} | {department}
- Chief Complaint: {complaint}
- Status/Plan: [brief status and outstanding items]
- Pending: [any pending orders, results, or actions]
- Priority: [Routine/Urgent/Critical]

Patient Data:
{patient_data}

Write a concise, clinical handoff. Prioritize critical/urgent patients first."""


def _call_llm(prompt: str) -> str:
    from src.api.dependencies import llm_provider
    response = llm_provider.llm.invoke(prompt)
    return response.content if hasattr(response, "content") else str(response)


def generate_shift_handoff(department: Optional[str] = None) -> str:
    """Generate a shift handoff document for all active in-department patients.

    Args:
        department: Optional — filter to a specific department. If None, includes all.

    Returns:
        Formatted handoff document as markdown string
    """
    with SessionLocal() as db:
        query = select(Visit, Patient).join(
            Patient, Visit.patient_id == Patient.id
        ).where(Visit.status == VisitStatus.IN_DEPARTMENT.value)

        if department:
            query = query.where(Visit.current_department == department)

        rows = db.execute(query).all()

        if not rows:
            return "No active patients in department at time of handoff."

        patient_sections = []
        for visit, patient in rows:
            # Fetch pending orders
            pending_orders = db.execute(
                select(Order).where(
                    Order.visit_id == visit.id,
                    Order.status == "pending"
                )
            ).scalars().all()

            orders_str = ", ".join(o.order_name for o in pending_orders) if pending_orders else "None"
            section = (
                f"Patient: {patient.name} ({patient.dob}, {patient.gender})\n"
                f"Visit: {visit.visit_id} | Department: {visit.current_department or 'Unknown'}\n"
                f"Chief Complaint: {visit.chief_complaint or 'Not recorded'}\n"
                f"Urgency: {visit.urgency_level or 'routine'}\n"
                f"Clinical Notes: {(visit.clinical_notes or 'None')[:300]}\n"
                f"Pending Orders: {orders_str}"
            )
            patient_sections.append(section)

        prompt = HANDOFF_PROMPT.format(patient_data="\n\n".join(patient_sections))

        try:
            return _call_llm(prompt)
        except Exception as e:
            logger.error("Shift handoff LLM call failed: %s", e)
            # Fallback: return raw data without LLM formatting
            return "# Shift Handoff\n\n" + "\n\n---\n\n".join(patient_sections)


_registry = ToolRegistry()
_registry.register(
    generate_shift_handoff,
    scope="assignable",
    symbol="generate_shift_handoff",
    allow_overwrite=True,
)
```

- [ ] **Step 2: Add HandoffResponse schema to `src/api/models.py`**

```python
class HandoffResponse(BaseModel):
    document: str
    patient_count: int
    department: Optional[str] = None
```

- [ ] **Step 3: Add `/handoff` endpoint to `src/api/routers/visits.py`**

```python
from src.tools.builtin.shift_handoff_tool import generate_shift_handoff as _handoff_fn
from ..models import HandoffResponse

@router.get("/api/visits/handoff", response_model=HandoffResponse)
async def get_shift_handoff(
    department: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """Generate a shift handoff document for all active in-department patients."""
    # Count active patients for the response metadata
    query = select(func.count(Visit.id)).where(Visit.status == VisitStatus.IN_DEPARTMENT.value)
    if department:
        query = query.where(Visit.current_department == department)
    count = (await db.execute(query)).scalar() or 0

    document = _handoff_fn(department=department)
    return HandoffResponse(document=document, patient_count=count, department=department)
```

**Note:** The `/handoff` route must be declared BEFORE any `/{visit_id}` routes to avoid route conflicts. Place it near the top of the visits router.

- [ ] **Step 4: Commit**

```bash
git add src/tools/builtin/shift_handoff_tool.py src/api/models.py src/api/routers/visits.py
git commit -m "feat: shift handoff tool and GET /api/visits/handoff endpoint"
```

---

## Task 16: Shift handoff modal (frontend)

**Files:**
- Create: `web/components/doctor/shift-handoff-modal.tsx`
- Modify: `web/lib/api.ts`
- Modify: `web/components/doctor/quick-actions-bar.tsx`
- Modify: `web/app/(dashboard)/doctor/use-doctor-workspace.ts`

- [ ] **Step 1: Add API function to `web/lib/api.ts`**

```typescript
export interface HandoffResponse {
  document: string;
  patient_count: number;
  department?: string;
}

export async function getShiftHandoff(department?: string): Promise<HandoffResponse> {
  const url = department
    ? `${API_BASE_URL}/visits/handoff?department=${encodeURIComponent(department)}`
    : `${API_BASE_URL}/visits/handoff`;
  const response = await fetch(url);
  if (!response.ok) throw new Error("Failed to generate shift handoff");
  return response.json();
}
```

- [ ] **Step 2: Create `web/components/doctor/shift-handoff-modal.tsx`**

```typescript
"use client";

import { useState } from "react";
import { FileText, Copy, Check, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ShiftHandoffModalProps {
  open: boolean;
  onClose: () => void;
  document: string;
  patientCount: number;
  loading: boolean;
}

export function ShiftHandoffModal({
  open,
  onClose,
  document,
  patientCount,
  loading,
}: ShiftHandoffModalProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(document);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Shift Handoff
              {patientCount > 0 && (
                <span className="text-sm font-normal text-muted-foreground">
                  — {patientCount} patient{patientCount !== 1 ? "s" : ""}
                </span>
              )}
            </DialogTitle>
            <button
              onClick={handleCopy}
              disabled={loading || !document}
              className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border border-border hover:bg-accent transition-colors disabled:opacity-50"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto mt-2">
          {loading ? (
            <div className="space-y-3 animate-pulse">
              {[1, 2, 3].map((i) => (
                <div key={i} className="space-y-1.5">
                  <div className="h-4 bg-muted rounded w-1/3" />
                  <div className="h-3 bg-muted rounded w-full" />
                  <div className="h-3 bg-muted rounded w-4/5" />
                </div>
              ))}
            </div>
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <pre className="whitespace-pre-wrap text-xs leading-relaxed font-sans bg-muted/30 rounded-md p-4">
                {document || "No active patients to hand off."}
              </pre>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3: Add handoff state to `use-doctor-workspace.ts`**

```typescript
import { getShiftHandoff, type HandoffResponse } from "@/lib/api";

const [handoffOpen, setHandoffOpen] = useState(false);
const [handoffDoc, setHandoffDoc] = useState("");
const [handoffCount, setHandoffCount] = useState(0);
const [handoffLoading, setHandoffLoading] = useState(false);

const openShiftHandoff = async () => {
  setHandoffOpen(true);
  setHandoffLoading(true);
  setHandoffDoc("");
  try {
    const data = await getShiftHandoff();
    setHandoffDoc(data.document);
    setHandoffCount(data.patient_count);
  } catch (e) {
    setHandoffDoc("Failed to generate handoff. Please try again.");
  } finally {
    setHandoffLoading(false);
  }
};
```

Return `handoffOpen`, `setHandoffOpen`, `handoffDoc`, `handoffCount`, `handoffLoading`, `openShiftHandoff`.

- [ ] **Step 4: Add "End Shift" button to `quick-actions-bar.tsx`**

Update the component's props to accept `onEndShift`:

```typescript
interface QuickActionsBarProps {
  // ... existing props ...
  onEndShift?: () => void;
}
```

Add button:

```typescript
{onEndShift && (
  <button
    onClick={onEndShift}
    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-border text-muted-foreground hover:bg-accent transition-colors"
  >
    <FileText className="h-3.5 w-3.5" />
    End Shift
  </button>
)}
```

- [ ] **Step 5: Wire modal in `page.tsx`**

Pass `onEndShift={openShiftHandoff}` to `QuickActionsBar`. Render `ShiftHandoffModal` at the bottom of the page:

```typescript
<ShiftHandoffModal
  open={handoffOpen}
  onClose={() => setHandoffOpen(false)}
  document={handoffDoc}
  patientCount={handoffCount}
  loading={handoffLoading}
/>
```

- [ ] **Step 6: Verify visually**

Click "End Shift" in the quick actions bar. The modal should open with a loading skeleton, then display the AI-generated handoff document. Clicking "Copy" copies the text to clipboard.

- [ ] **Step 7: Commit**

```bash
git add web/components/doctor/shift-handoff-modal.tsx web/lib/api.ts web/components/doctor/quick-actions-bar.tsx web/app/(dashboard)/doctor/use-doctor-workspace.ts web/app/(dashboard)/doctor/page.tsx
git commit -m "feat: shift handoff modal — AI generates end-of-shift patient summary"
```

---

## Self-Review Checklist

- [x] **urgency_level** on Visit: Tasks 1–3
- [x] **wait_minutes** in queue cards: Task 2–3
- [x] **Proactive pre-visit brief**: Tasks 4–5
- [x] **One-click SOAP draft**: Task 6
- [x] **DDx panel** with ICD-10 + evidence + red flags: Tasks 7–8
- [x] **Specialist agents** (Cardiologist, Neurologist, Pulmonologist): Task 9
- [x] **Specialist consult panel**: Task 10
- [x] **Orders** (model, migration, API, tool, UI): Tasks 11–14
- [x] **Shift handoff** (tool, endpoint, modal): Tasks 15–16
