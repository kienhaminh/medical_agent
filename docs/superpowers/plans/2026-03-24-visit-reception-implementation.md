# Phase 1: Visit Files & Reception Flow — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Visit model, Reception AI agent intake flow, and Doctor's review queue so patients can be triaged and routed to departments.

**Architecture:** New `Visit` SQLAlchemy model with state machine tracks patient encounters. A Reception `SubAgent` conducts intake conversations via the existing chat system, then calls a built-in `complete_triage` tool to update the visit. Two new Next.js pages: `/reception` for intake and `/doctor/queue` for routing approval.

**Tech Stack:** FastAPI, SQLAlchemy 2.0 async, Alembic, Next.js 14, TypeScript, shadcn/ui, Tailwind CSS

**Spec:** `docs/superpowers/specs/2026-03-24-visit-reception-design.md`

---

## File Map

### Backend — New Files
| File | Responsibility |
|------|---------------|
| `src/models/visit.py` | Visit SQLAlchemy model + VisitStatus enum |
| `src/api/routers/visits.py` | Visit CRUD API routes (POST, GET, GET/{id}, PATCH/{id}/route) |
| `src/tools/builtin/complete_triage_tool.py` | Built-in tool handler for triage completion |
| `src/constants/departments.py` | Department string constants list |
| `alembic/versions/260324_create_visits_table.py` | DB migration (auto-generated) |

### Backend — Modified Files
| File | Change |
|------|--------|
| `src/models/__init__.py` | Add `Visit` import and export |
| `src/api/models.py` | Add Visit Pydantic schemas (VisitCreate, VisitResponse, etc.) |
| `src/api/server.py` | Register visits router |
| `src/api/routers/__init__.py` | Export visits module (if needed) |

### Frontend — New Files
| File | Responsibility |
|------|---------------|
| `web/app/(dashboard)/reception/page.tsx` | Reception intake page shell |
| `web/components/reception/patient-selector.tsx` | Patient search + "Start Visit" button |
| `web/components/reception/visit-info-card.tsx` | Visit status sidebar card |
| `web/components/reception/intake-chat.tsx` | Chat panel wrapping existing chat components |
| `web/app/(dashboard)/doctor/queue/page.tsx` | Doctor's review queue page |
| `web/components/doctor/visit-queue-card.tsx` | Individual visit card in queue |
| `web/components/doctor/route-approval-dialog.tsx` | Change department dialog |
| `web/components/doctor/intake-viewer-dialog.tsx` | Read-only intake conversation viewer |

### Frontend — Modified Files
| File | Change |
|------|--------|
| `web/lib/api.ts` | Add Visit types + API functions |
| `web/components/sidebar.tsx` | Add Reception and Doctor Queue nav items |

---

## Task 1: Visit Model + Migration

**Files:**
- Create: `src/models/visit.py`
- Create: `src/constants/departments.py`
- Modify: `src/models/__init__.py`

- [ ] **Step 1: Create department constants**

```python
# src/constants/departments.py
"""Hospital department constants for routing."""

DEPARTMENTS = [
    "general_checkup",
    "cardiology",
    "neurology",
    "orthopedics",
    "dermatology",
    "gastroenterology",
    "pulmonology",
    "endocrinology",
    "ophthalmology",
    "ent",
    "urology",
    "radiology",
    "internal_medicine",
    "emergency",
]

DEPARTMENT_LABELS = {
    "general_checkup": "General Check-up",
    "cardiology": "Cardiology",
    "neurology": "Neurology",
    "orthopedics": "Orthopedics",
    "dermatology": "Dermatology",
    "gastroenterology": "Gastroenterology",
    "pulmonology": "Pulmonology",
    "endocrinology": "Endocrinology",
    "ophthalmology": "Ophthalmology",
    "ent": "ENT (Ear, Nose, Throat)",
    "urology": "Urology",
    "radiology": "Radiology",
    "internal_medicine": "Internal Medicine",
    "emergency": "Emergency",
}
```

- [ ] **Step 2: Create Visit model**

```python
# src/models/visit.py
"""Visit model for tracking patient encounters."""
import enum
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Enum, Float, ForeignKey, Index, JSON, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class VisitStatus(str, enum.Enum):
    """Visit lifecycle states."""
    INTAKE = "intake"
    TRIAGED = "triaged"
    AUTO_ROUTED = "auto_routed"
    PENDING_REVIEW = "pending_review"
    ROUTED = "routed"
    IN_DEPARTMENT = "in_department"
    COMPLETED = "completed"


# Confidence threshold for auto-routing
AUTO_ROUTE_THRESHOLD = 0.7


class Visit(Base):
    """Visit model — tracks a single patient encounter through the hospital."""
    __tablename__ = "visits"

    id: Mapped[int] = mapped_column(primary_key=True)
    visit_id: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"), index=True)
    status: Mapped[str] = mapped_column(
        Enum(VisitStatus, values_callable=lambda x: [e.value for e in x]),
        default=VisitStatus.INTAKE.value,
    )
    confidence: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    routing_suggestion: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    routing_decision: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    chief_complaint: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    intake_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    intake_session_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("chat_sessions.id"), nullable=True
    )
    reviewed_by: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=func.now(), onupdate=func.now()
    )

    # Relationships
    patient: Mapped["Patient"] = relationship()
    intake_session: Mapped[Optional["ChatSession"]] = relationship()

    __table_args__ = (
        Index("ix_visits_status", "status"),
        Index("ix_visits_created_at", "created_at"),
    )
```

- [ ] **Step 3: Register Visit in models/__init__.py**

Add to `src/models/__init__.py`:
- Import: `from .visit import Visit, VisitStatus`
- Add `"Visit"` and `"VisitStatus"` to `__all__`

- [ ] **Step 4: Generate and run Alembic migration**

Run:
```bash
cd /Users/kien.ha/Code/medical_agent
alembic revision --autogenerate -m "create visits table"
alembic upgrade head
```

Expected: Migration file created in `alembic/versions/`, table `visits` created with all columns and indexes.

- [ ] **Step 5: Verify migration**

Run:
```bash
alembic current
```

Expected: Shows the latest migration as current head.

- [ ] **Step 6: Commit**

```bash
git add src/models/visit.py src/constants/departments.py src/models/__init__.py alembic/versions/
git commit -m "feat: add Visit model with status enum and department constants"
```

---

## Task 2: Visit Pydantic Schemas

**Files:**
- Modify: `src/api/models.py`

- [ ] **Step 1: Add Visit Pydantic models to src/api/models.py**

Append to end of file:

```python
# --- Visit schemas ---

class VisitCreate(BaseModel):
    """Request body for creating a new visit."""
    patient_id: int

class VisitRouteUpdate(BaseModel):
    """Request body for doctor routing approval."""
    routing_decision: list[str]
    reviewed_by: str

class VisitResponse(BaseModel):
    """Visit response for list and detail views."""
    id: int
    visit_id: str
    patient_id: int
    status: str
    confidence: Optional[float] = None
    routing_suggestion: Optional[list[str]] = None
    routing_decision: Optional[list[str]] = None
    chief_complaint: Optional[str] = None
    intake_session_id: Optional[int] = None
    reviewed_by: Optional[str] = None
    created_at: str
    updated_at: str

class VisitDetailResponse(VisitResponse):
    """Extended visit response with patient info and intake notes."""
    patient_name: str
    patient_dob: str
    patient_gender: str
    intake_notes: Optional[str] = None
```

- [ ] **Step 2: Commit**

```bash
git add src/api/models.py
git commit -m "feat: add Visit Pydantic schemas"
```

---

## Task 3: Visit API Routes

**Files:**
- Create: `src/api/routers/visits.py`
- Modify: `src/api/server.py`

- [ ] **Step 1: Create visits router**

```python
# src/api/routers/visits.py
"""Visit API routes — create, list, detail, and routing approval."""
import logging
from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func as sa_func
from sqlalchemy.ext.asyncio import AsyncSession

from src.models import get_db, Visit, Patient, ChatSession, SubAgent
from src.models.visit import VisitStatus, AUTO_ROUTE_THRESHOLD
from ..models import VisitCreate, VisitResponse, VisitDetailResponse, VisitRouteUpdate

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Visits"])


def _visit_to_response(v: Visit) -> VisitResponse:
    """Convert Visit ORM object to VisitResponse."""
    return VisitResponse(
        id=v.id,
        visit_id=v.visit_id,
        patient_id=v.patient_id,
        status=v.status,
        confidence=v.confidence,
        routing_suggestion=v.routing_suggestion,
        routing_decision=v.routing_decision,
        chief_complaint=v.chief_complaint,
        intake_session_id=v.intake_session_id,
        reviewed_by=v.reviewed_by,
        created_at=v.created_at.isoformat(),
        updated_at=v.updated_at.isoformat(),
    )


async def _generate_visit_id(db: AsyncSession) -> str:
    """Generate VIS-YYYYMMDD-NNN visit ID.

    Queries for the max NNN for today's date and increments.
    """
    today = date.today()
    prefix = f"VIS-{today.strftime('%Y%m%d')}-"

    result = await db.execute(
        select(Visit.visit_id)
        .where(Visit.visit_id.like(f"{prefix}%"))
        .order_by(Visit.visit_id.desc())
        .limit(1)
    )
    last_id = result.scalar_one_or_none()

    if last_id:
        last_num = int(last_id.split("-")[-1])
        next_num = last_num + 1
    else:
        next_num = 1

    return f"{prefix}{next_num:03d}"


@router.post("/api/visits", response_model=VisitResponse)
async def create_visit(visit_data: VisitCreate, db: AsyncSession = Depends(get_db)):
    """Create a new visit and start intake.

    1. Checks no active intake exists for this patient
    2. Looks up Reception agent by role
    3. Creates ChatSession + Visit
    """
    # Validate patient exists
    patient = await db.execute(
        select(Patient).where(Patient.id == visit_data.patient_id)
    )
    patient = patient.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    # Check for duplicate active intake
    existing = await db.execute(
        select(Visit).where(
            Visit.patient_id == visit_data.patient_id,
            Visit.status == VisitStatus.INTAKE.value,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=409,
            detail="Patient already has an active intake visit",
        )

    # Look up Reception agent
    reception_agent = await db.execute(
        select(SubAgent).where(SubAgent.role == "reception_triage")
    )
    reception_agent = reception_agent.scalar_one_or_none()
    if not reception_agent:
        raise HTTPException(
            status_code=500,
            detail="Reception agent not configured. Create a SubAgent with role='reception_triage'.",
        )

    # Generate visit ID (retry up to 3 times for concurrent creation)
    from sqlalchemy.exc import IntegrityError

    visit = None
    for attempt in range(3):
        try:
            vid = await _generate_visit_id(db)

            # Create chat session
            session = ChatSession(
                title=f"Intake - {vid}",
                agent_id=reception_agent.id,
            )
            db.add(session)
            await db.flush()

            # Create visit
            visit = Visit(
                visit_id=vid,
                patient_id=visit_data.patient_id,
                status=VisitStatus.INTAKE.value,
                intake_session_id=session.id,
            )
            db.add(visit)
            await db.commit()
            await db.refresh(visit)
            break
        except IntegrityError:
            await db.rollback()
            if attempt == 2:
                raise HTTPException(
                    status_code=500, detail="Failed to generate unique visit ID"
                )

    return _visit_to_response(visit)


@router.get("/api/visits", response_model=list[VisitResponse])
async def list_visits(
    status: str | None = None,
    patient_id: int | None = None,
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
):
    """List visits with optional filters."""
    query = select(Visit).order_by(Visit.created_at.desc())

    if status:
        query = query.where(Visit.status == status)
    if patient_id:
        query = query.where(Visit.patient_id == patient_id)

    query = query.limit(limit).offset(offset)
    result = await db.execute(query)
    visits = result.scalars().all()

    return [_visit_to_response(v) for v in visits]


@router.get("/api/visits/{visit_id}", response_model=VisitDetailResponse)
async def get_visit(visit_id: int, db: AsyncSession = Depends(get_db)):
    """Get visit detail with patient info."""
    result = await db.execute(
        select(Visit).where(Visit.id == visit_id)
    )
    visit = result.scalar_one_or_none()
    if not visit:
        raise HTTPException(status_code=404, detail="Visit not found")

    # Fetch patient for flattened fields
    patient = await db.execute(
        select(Patient).where(Patient.id == visit.patient_id)
    )
    patient = patient.scalar_one_or_none()

    return VisitDetailResponse(
        id=visit.id,
        visit_id=visit.visit_id,
        patient_id=visit.patient_id,
        status=visit.status,
        confidence=visit.confidence,
        routing_suggestion=visit.routing_suggestion,
        routing_decision=visit.routing_decision,
        chief_complaint=visit.chief_complaint,
        intake_session_id=visit.intake_session_id,
        reviewed_by=visit.reviewed_by,
        created_at=visit.created_at.isoformat(),
        updated_at=visit.updated_at.isoformat(),
        patient_name=patient.name if patient else "Unknown",
        patient_dob=patient.dob if patient else "",
        patient_gender=patient.gender if patient else "",
        intake_notes=visit.intake_notes,
    )


@router.patch("/api/visits/{visit_id}/route", response_model=VisitResponse)
async def route_visit(
    visit_id: int,
    route_data: VisitRouteUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Doctor approves or changes routing for a visit."""
    result = await db.execute(
        select(Visit).where(Visit.id == visit_id)
    )
    visit = result.scalar_one_or_none()
    if not visit:
        raise HTTPException(status_code=404, detail="Visit not found")

    if visit.status not in (
        VisitStatus.AUTO_ROUTED.value,
        VisitStatus.PENDING_REVIEW.value,
    ):
        raise HTTPException(
            status_code=400,
            detail=f"Visit cannot be routed from status '{visit.status}'. Must be 'auto_routed' or 'pending_review'.",
        )

    visit.routing_decision = route_data.routing_decision
    visit.reviewed_by = route_data.reviewed_by
    visit.status = VisitStatus.ROUTED.value

    await db.commit()
    await db.refresh(visit)

    return _visit_to_response(visit)
```

- [ ] **Step 2: Register visits router in server.py**

In `src/api/server.py`:
- Add `visits` to the import: `from .routers import patients, agents, tools, chat, usage, skills, visits`
- Add: `app.include_router(visits.router)` after `app.include_router(skills.router)`

- [ ] **Step 3: Verify server starts**

Run:
```bash
cd /Users/kien.ha/Code/medical_agent && python -c "from src.api.server import app; print('OK')"
```

Expected: `OK` printed without import errors.

- [ ] **Step 4: Commit**

```bash
git add src/api/routers/visits.py src/api/server.py src/api/models.py
git commit -m "feat: add Visit API routes (create, list, detail, route)"
```

---

## Task 4: complete_triage Tool Handler

**Files:**
- Create: `src/tools/builtin/complete_triage_tool.py`
- Modify: `src/tools/builtin/__init__.py`

- [ ] **Step 1: Create the tool handler**

Follows the exact pattern of existing tools like `patient_basic_info_tool.py`: synchronous DB access via `SessionLocal`, self-registration at import time via `ToolRegistry`.

```python
# src/tools/builtin/complete_triage_tool.py
"""Built-in tool for completing patient intake triage.

Called by the Reception agent after gathering enough information
to suggest department routing. Self-registers at import time.
"""
import logging
from typing import List
from sqlalchemy import select

from src.models import SessionLocal
from src.models.visit import Visit, VisitStatus, AUTO_ROUTE_THRESHOLD
from src.tools.registry import ToolRegistry

logger = logging.getLogger(__name__)


def complete_triage(
    id: int,
    chief_complaint: str,
    intake_notes: str,
    routing_suggestion: List[str],
    confidence: float,
) -> str:
    """Complete the patient intake triage and route the visit.

    Call this when you have gathered enough information from the patient
    to suggest a department routing. This updates the visit record and
    routes it based on confidence level.

    Args:
        id: The visit primary key ID (provided in system context)
        chief_complaint: One-line summary of the patient's primary concern
        intake_notes: Structured summary of symptoms, history, and assessment
        routing_suggestion: List of department names to route to (e.g., ['cardiology'])
        confidence: Confidence in the routing suggestion (0.0-1.0)

    Returns:
        Confirmation message with routing outcome
    """
    with SessionLocal() as db:
        visit = db.execute(
            select(Visit).where(Visit.id == id)
        ).scalar_one_or_none()

        if not visit:
            return f"Error: Visit with id={id} not found."

        if visit.status != VisitStatus.INTAKE.value:
            return f"Error: Visit is not in intake status (current: {visit.status})."

        # Update triage fields
        visit.chief_complaint = chief_complaint
        visit.intake_notes = intake_notes
        visit.routing_suggestion = routing_suggestion
        visit.confidence = confidence

        # Route based on confidence threshold
        if confidence >= AUTO_ROUTE_THRESHOLD:
            visit.routing_decision = routing_suggestion
            visit.status = VisitStatus.AUTO_ROUTED.value
            route_msg = f"Auto-routed to: {', '.join(routing_suggestion)} (confidence: {confidence:.2f})"
        else:
            visit.status = VisitStatus.PENDING_REVIEW.value
            route_msg = f"Sent to doctor for review (confidence: {confidence:.2f})"

        db.commit()

        logger.info("Triage completed for visit %s: %s", visit.visit_id, route_msg)

        return f"Triage completed. {route_msg}. You may now give the patient a closing message."


# Auto-register to the global tool registry (matches existing pattern)
_registry = ToolRegistry()
_registry.register(
    complete_triage,
    scope="assignable",
    symbol="complete_triage",
    allow_overwrite=True,
)
```

- [ ] **Step 2: Register in builtin __init__.py**

Add to `src/tools/builtin/__init__.py`:
- Import: `from . import complete_triage_tool`
- Convenience import: `from .complete_triage_tool import complete_triage`
- Add `"complete_triage"` to `__all__`

- [ ] **Step 3: Verify import works**

Run:
```bash
cd /Users/kien.ha/Code/medical_agent && python -c "from src.tools.builtin.complete_triage_tool import complete_triage; print('OK')"
```

Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add src/tools/builtin/complete_triage_tool.py src/tools/builtin/__init__.py
git commit -m "feat: add complete_triage built-in tool handler"
```

---

## Task 5: Frontend API Types + Functions

**Files:**
- Modify: `web/lib/api.ts`

- [ ] **Step 1: Add Visit types and API functions to web/lib/api.ts**

Append to the file:

```typescript
// --- Visit types ---

export interface Visit {
  id: number;
  visit_id: string;
  patient_id: number;
  status: string;
  confidence: number | null;
  routing_suggestion: string[] | null;
  routing_decision: string[] | null;
  chief_complaint: string | null;
  intake_session_id: number | null;
  reviewed_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface VisitDetail extends Visit {
  patient_name: string;
  patient_dob: string;
  patient_gender: string;
  intake_notes: string | null;
}

// --- Visit API functions ---

export async function createVisit(patientId: number): Promise<Visit> {
  const response = await fetch(`${API_BASE_URL}/visits`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ patient_id: patientId }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to create visit");
  }
  return response.json();
}

export async function listVisits(params?: {
  status?: string;
  patient_id?: number;
  limit?: number;
  offset?: number;
}): Promise<Visit[]> {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.set("status", params.status);
  if (params?.patient_id) searchParams.set("patient_id", String(params.patient_id));
  if (params?.limit) searchParams.set("limit", String(params.limit));
  if (params?.offset) searchParams.set("offset", String(params.offset));
  const qs = searchParams.toString();
  const response = await fetch(`${API_BASE_URL}/visits${qs ? `?${qs}` : ""}`);
  if (!response.ok) throw new Error("Failed to fetch visits");
  return response.json();
}

export async function getVisit(id: number): Promise<VisitDetail> {
  const response = await fetch(`${API_BASE_URL}/visits/${id}`);
  if (!response.ok) throw new Error("Failed to fetch visit");
  return response.json();
}

export async function routeVisit(
  id: number,
  routingDecision: string[],
  reviewedBy: string
): Promise<Visit> {
  const response = await fetch(`${API_BASE_URL}/visits/${id}/route`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      routing_decision: routingDecision,
      reviewed_by: reviewedBy,
    }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to route visit");
  }
  return response.json();
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run:
```bash
cd /Users/kien.ha/Code/medical_agent/web && npx tsc --noEmit 2>&1 | grep "api.ts"
```

Expected: No errors from `api.ts`.

- [ ] **Step 3: Commit**

```bash
git add web/lib/api.ts
git commit -m "feat: add Visit types and API functions to frontend"
```

---

## Task 6: Sidebar Navigation Update

**Files:**
- Modify: `web/components/sidebar.tsx`

- [ ] **Step 1: Add imports and nav items**

In `web/components/sidebar.tsx`:

Add `ClipboardList` and `Stethoscope` to the lucide-react import (line 7-20).

Add two new items to the `navigation` array after the "Patients" entry (after line 36):

```typescript
  {
    name: "Reception",
    href: "/reception",
    icon: ClipboardList,
  },
  {
    name: "Doctor Queue",
    href: "/doctor/queue",
    icon: Stethoscope,
  },
```

- [ ] **Step 2: Verify TypeScript compiles**

Run:
```bash
cd /Users/kien.ha/Code/medical_agent/web && npx tsc --noEmit 2>&1 | grep "sidebar"
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add web/components/sidebar.tsx
git commit -m "feat: add Reception and Doctor Queue to sidebar navigation"
```

---

## Task 7: Reception Page — Patient Selector + Visit Info Card

**Files:**
- Create: `web/components/reception/patient-selector.tsx`
- Create: `web/components/reception/visit-info-card.tsx`

- [ ] **Step 1: Create patient selector component**

```typescript
// web/components/reception/patient-selector.tsx
"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Loader2, Search, UserPlus } from "lucide-react";
import { listPatients, createVisit, type Patient, type Visit } from "@/lib/api";

interface PatientSelectorProps {
  onVisitCreated: (visit: Visit, patient: Patient) => void;
  disabled?: boolean;
}

export function PatientSelector({ onVisitCreated, disabled }: PatientSelectorProps) {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [search, setSearch] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listPatients().then(setPatients).catch(console.error);
  }, []);

  const filtered = patients.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleStartVisit = async () => {
    if (!selectedPatient || creating) return;
    setCreating(true);
    setError(null);
    try {
      const visit = await createVisit(selectedPatient.id);
      onVisitCreated(visit, selectedPatient);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create visit");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search patients..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 medical-input"
          disabled={disabled}
        />
      </div>

      <div className="space-y-2 max-h-[300px] overflow-y-auto">
        {filtered.map((patient) => (
          <Card
            key={patient.id}
            className={`p-3 cursor-pointer transition-all ${
              selectedPatient?.id === patient.id
                ? "border-cyan-500 bg-cyan-500/5"
                : "border-border/50 hover:border-cyan-500/50"
            } ${disabled ? "opacity-50 pointer-events-none" : ""}`}
            onClick={() => setSelectedPatient(patient)}
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-cyan-500/10 flex items-center justify-center text-xs font-bold text-cyan-500">
                {patient.name.split(" ").map((n) => n[0]).join("")}
              </div>
              <div>
                <p className="font-medium text-sm">{patient.name}</p>
                <p className="text-xs text-muted-foreground">
                  DOB: {patient.dob} · {patient.gender}
                </p>
              </div>
            </div>
          </Card>
        ))}
        {filtered.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            No patients found
          </p>
        )}
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-500 text-sm">
          {error}
        </div>
      )}

      <Button
        onClick={handleStartVisit}
        disabled={!selectedPatient || creating || disabled}
        className="w-full primary-button"
      >
        {creating ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Creating Visit...
          </>
        ) : (
          <>
            <UserPlus className="w-4 h-4 mr-2" />
            Start Visit
          </>
        )}
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Create visit info card component**

```typescript
// web/components/reception/visit-info-card.tsx
"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Visit, Patient } from "@/lib/api";

interface VisitInfoCardProps {
  visit: Visit;
  patient: Patient;
}

const STATUS_COLORS: Record<string, string> = {
  intake: "bg-cyan-500/15 text-cyan-500",
  triaged: "bg-blue-500/15 text-blue-500",
  auto_routed: "bg-green-500/15 text-green-500",
  pending_review: "bg-orange-500/15 text-orange-500",
  routed: "bg-green-500/15 text-green-500",
};

const STATUS_LABELS: Record<string, string> = {
  intake: "Intake in progress",
  triaged: "Triaged",
  auto_routed: "Auto-Routed",
  pending_review: "Needs Doctor Review",
  routed: "Routed",
};

export function VisitInfoCard({ visit, patient }: VisitInfoCardProps) {
  return (
    <div className="space-y-4">
      {/* Patient info */}
      <Card className="p-4 bg-cyan-500/5 border-cyan-500/20">
        <div className="text-xs uppercase text-muted-foreground mb-2">Patient</div>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-cyan-500/15 flex items-center justify-center text-sm font-bold text-cyan-500">
            {patient.name.split(" ").map((n) => n[0]).join("")}
          </div>
          <div>
            <p className="font-semibold">{patient.name}</p>
            <p className="text-xs text-muted-foreground">
              DOB: {patient.dob} · {patient.gender}
            </p>
          </div>
        </div>
      </Card>

      {/* Visit info */}
      <Card className="p-4 border-border/50">
        <div className="text-xs uppercase text-muted-foreground mb-2">Visit</div>
        <p className="text-sm font-mono text-muted-foreground">{visit.visit_id}</p>
        <div className="mt-2">
          <Badge className={STATUS_COLORS[visit.status] || "bg-muted"}>
            {STATUS_LABELS[visit.status] || visit.status}
          </Badge>
        </div>
        {visit.confidence !== null && (
          <div className="mt-3 text-xs text-muted-foreground">
            Confidence: <span className="font-medium">{(visit.confidence * 100).toFixed(0)}%</span>
          </div>
        )}
        {visit.routing_suggestion && (
          <div className="mt-2 text-xs text-muted-foreground">
            Suggested: <span className="text-cyan-500">{visit.routing_suggestion.join(", ")}</span>
          </div>
        )}
      </Card>
    </div>
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run:
```bash
cd /Users/kien.ha/Code/medical_agent/web && npx tsc --noEmit 2>&1 | grep "reception"
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add web/components/reception/
git commit -m "feat: add PatientSelector and VisitInfoCard components for reception"
```

---

## Task 8: Reception Page — Intake Chat + Page Shell

**Files:**
- Create: `web/components/reception/intake-chat.tsx`
- Create: `web/app/(dashboard)/reception/page.tsx`

- [ ] **Step 1: Create intake chat component**

This component wraps the existing chat functionality — it sends messages via `/api/chat` using the visit's `intake_session_id` and `patient_id`.

```typescript
// web/components/reception/intake-chat.tsx
"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Send } from "lucide-react";
import type { Visit } from "@/lib/api";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface IntakeChatProps {
  visit: Visit;
  patientId: number;
}

export function IntakeChat({ visit, patientId }: IntakeChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const content = input.trim();
    setInput("");

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content,
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    const assistantId = (Date.now() + 1).toString();
    setMessages((prev) => [
      ...prev,
      { id: assistantId, role: "assistant", content: "" },
    ]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: content,
          patient_id: patientId,
          session_id: visit.intake_session_id,
          stream: true,
        }),
      });

      if (!response.ok) throw new Error("Failed to send message");

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error("Response body is not readable");

      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split("\n")) {
          if (line.startsWith("data: ")) {
            try {
              const parsed = JSON.parse(line.slice(6));
              if (parsed.chunk) {
                accumulated += parsed.chunk;
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantId
                      ? { ...msg, content: accumulated }
                      : msg
                  )
                );
              }
              if (parsed.done) break;
            } catch {
              // Ignore parse errors
            }
          }
        }
      }
    } catch (error) {
      console.error(error);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantId
            ? { ...msg, content: "Connection error. Please try again." }
            : msg
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="flex flex-col h-full border-border/50 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border/50 bg-cyan-500/5">
        <div className="font-semibold text-sm">Reception Agent</div>
        <div className="text-xs text-muted-foreground">
          Intake for {visit.visit_id}
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-3">
          {messages.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              Send a message to begin the intake conversation.
            </p>
          )}
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${
                msg.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[80%] px-3 py-2 rounded-xl text-sm ${
                  msg.role === "user"
                    ? "bg-cyan-500/15 text-foreground"
                    : "bg-muted/50 text-foreground"
                }`}
              >
                {msg.content || (
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <form
        onSubmit={sendMessage}
        className="p-3 border-t border-border/50 flex gap-2"
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Describe your symptoms..."
          className="medical-input"
          disabled={isLoading}
        />
        <Button
          type="submit"
          disabled={!input.trim() || isLoading}
          className="primary-button"
          size="icon"
        >
          <Send className="w-4 h-4" />
        </Button>
      </form>
    </Card>
  );
}
```

- [ ] **Step 2: Create reception page**

```typescript
// web/app/(dashboard)/reception/page.tsx
"use client";

import { useState, useEffect } from "react";
import { PatientSelector } from "@/components/reception/patient-selector";
import { VisitInfoCard } from "@/components/reception/visit-info-card";
import { IntakeChat } from "@/components/reception/intake-chat";
import { getVisit, type Visit, type Patient } from "@/lib/api";

export default function ReceptionPage() {
  const [visit, setVisit] = useState<Visit | null>(null);
  const [patient, setPatient] = useState<Patient | null>(null);

  // Poll visit status during intake
  useEffect(() => {
    if (!visit || visit.status !== "intake") return;

    const interval = setInterval(async () => {
      try {
        const updated = await getVisit(visit.id);
        if (updated.status !== "intake") {
          setVisit(updated);
        }
      } catch {
        // Ignore polling errors
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [visit?.id, visit?.status]);

  const handleVisitCreated = (newVisit: Visit, selectedPatient: Patient) => {
    setVisit(newVisit);
    setPatient(selectedPatient);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="container mx-auto p-6 flex-1 flex flex-col min-h-0">
        <h1 className="font-display text-2xl font-bold mb-6">Reception</h1>

        <div className="flex-1 flex gap-6 min-h-0">
          {/* Left sidebar */}
          <div className="w-[300px] flex-shrink-0 space-y-4 overflow-y-auto">
            {visit && patient ? (
              <VisitInfoCard visit={visit} patient={patient} />
            ) : (
              <PatientSelector
                onVisitCreated={handleVisitCreated}
                disabled={!!visit}
              />
            )}
          </div>

          {/* Right: Chat area */}
          <div className="flex-1 min-h-0">
            {visit ? (
              <IntakeChat visit={visit} patientId={visit.patient_id} />
            ) : (
              <div className="h-full flex items-center justify-center border-2 border-dashed border-border/50 rounded-lg">
                <p className="text-muted-foreground">
                  Select a patient and start a visit to begin intake
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run:
```bash
cd /Users/kien.ha/Code/medical_agent/web && npx tsc --noEmit 2>&1 | grep -E "reception|intake"
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add web/components/reception/intake-chat.tsx web/app/\(dashboard\)/reception/page.tsx
git commit -m "feat: add Reception intake page with chat interface"
```

---

## Task 9: Doctor Queue — Visit Card + Route Approval Dialog

**Files:**
- Create: `web/components/doctor/visit-queue-card.tsx`
- Create: `web/components/doctor/route-approval-dialog.tsx`

- [ ] **Step 1: Create visit queue card**

```typescript
// web/components/doctor/visit-queue-card.tsx
"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, Edit, Eye } from "lucide-react";
import type { VisitDetail } from "@/lib/api";

interface VisitQueueCardProps {
  visit: VisitDetail;
  onApprove: (visit: VisitDetail) => void;
  onChangeRoute: (visit: VisitDetail) => void;
  onViewIntake: (visit: VisitDetail) => void;
}

export function VisitQueueCard({
  visit,
  onApprove,
  onChangeRoute,
  onViewIntake,
}: VisitQueueCardProps) {
  const isNeedsReview = visit.status === "pending_review";

  return (
    <Card
      className={`p-4 ${
        isNeedsReview
          ? "border-orange-500/30 bg-orange-500/5"
          : "border-cyan-500/20 bg-cyan-500/3"
      }`}
    >
      <div className="flex gap-4">
        {/* Status dot */}
        <div
          className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
            isNeedsReview ? "bg-orange-500" : "bg-green-500"
          }`}
        />

        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className="font-semibold">{visit.patient_name}</span>
              <span className="text-xs text-muted-foreground ml-2">
                {visit.visit_id}
              </span>
            </div>
            <Badge
              className={
                isNeedsReview
                  ? "bg-orange-500/15 text-orange-500"
                  : "bg-green-500/15 text-green-500"
              }
            >
              {isNeedsReview ? "Needs Review" : "Auto-Routed"}
            </Badge>
          </div>

          {/* Chief complaint */}
          {visit.chief_complaint && (
            <p className="text-sm text-muted-foreground mt-2">
              {visit.chief_complaint}
            </p>
          )}

          {/* Routing info */}
          <div className="text-xs text-muted-foreground mt-2">
            {visit.routing_suggestion && (
              <span>
                Suggested:{" "}
                <span className="text-cyan-500">
                  {visit.routing_suggestion.join(", ")}
                </span>
              </span>
            )}
            {visit.confidence !== null && (
              <span className="ml-3">
                Confidence:{" "}
                <span
                  className={
                    visit.confidence >= 0.7 ? "text-green-500" : "text-orange-500"
                  }
                >
                  {(visit.confidence * 100).toFixed(0)}%
                </span>
              </span>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 mt-3">
            {isNeedsReview && (
              <Button
                size="sm"
                onClick={() => onApprove(visit)}
                className="primary-button text-xs"
              >
                <Check className="w-3.5 h-3.5 mr-1" />
                Approve Route
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => onChangeRoute(visit)}
              className="text-xs"
            >
              <Edit className="w-3.5 h-3.5 mr-1" />
              Change Department
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onViewIntake(visit)}
              className="text-xs"
            >
              <Eye className="w-3.5 h-3.5 mr-1" />
              View Intake
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
```

- [ ] **Step 2: Create route approval dialog**

```typescript
// web/components/doctor/route-approval-dialog.tsx
"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { routeVisit, type VisitDetail } from "@/lib/api";

const DEPARTMENTS = [
  { value: "general_checkup", label: "General Check-up" },
  { value: "cardiology", label: "Cardiology" },
  { value: "neurology", label: "Neurology" },
  { value: "orthopedics", label: "Orthopedics" },
  { value: "dermatology", label: "Dermatology" },
  { value: "gastroenterology", label: "Gastroenterology" },
  { value: "pulmonology", label: "Pulmonology" },
  { value: "endocrinology", label: "Endocrinology" },
  { value: "ophthalmology", label: "Ophthalmology" },
  { value: "ent", label: "ENT" },
  { value: "urology", label: "Urology" },
  { value: "radiology", label: "Radiology" },
  { value: "internal_medicine", label: "Internal Medicine" },
  { value: "emergency", label: "Emergency" },
];

interface RouteApprovalDialogProps {
  visit: VisitDetail | null;
  open: boolean;
  onClose: () => void;
  onRouted: () => void;
}

export function RouteApprovalDialog({
  visit,
  open,
  onClose,
  onRouted,
}: RouteApprovalDialogProps) {
  const [selected, setSelected] = useState<string[]>([]);
  const [reviewedBy, setReviewedBy] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize selected with current suggestion when visit changes
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen && visit?.routing_suggestion) {
      setSelected(visit.routing_suggestion);
    }
    if (!isOpen) onClose();
  };

  const toggleDepartment = (dept: string) => {
    setSelected((prev) =>
      prev.includes(dept) ? prev.filter((d) => d !== dept) : [...prev, dept]
    );
  };

  const handleSubmit = async () => {
    if (!visit || selected.length === 0 || !reviewedBy.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await routeVisit(visit.id, selected, reviewedBy.trim());
      onRouted();
      onClose();
      setSelected([]);
      setReviewedBy("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to route visit");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Route Visit</DialogTitle>
          <DialogDescription>
            {visit?.patient_name} — {visit?.visit_id}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {visit?.chief_complaint && (
            <div className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg">
              {visit.chief_complaint}
            </div>
          )}

          <div className="space-y-2">
            <Label>Select department(s)</Label>
            <div className="flex flex-wrap gap-2">
              {DEPARTMENTS.map((dept) => (
                <Badge
                  key={dept.value}
                  variant="outline"
                  className={`cursor-pointer transition-colors ${
                    selected.includes(dept.value)
                      ? "bg-cyan-500/15 border-cyan-500 text-cyan-500"
                      : "hover:border-cyan-500/50"
                  }`}
                  onClick={() => toggleDepartment(dept.value)}
                >
                  {dept.label}
                </Badge>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reviewedBy">Reviewed by</Label>
            <Input
              id="reviewedBy"
              placeholder="Dr. Smith"
              value={reviewedBy}
              onChange={(e) => setReviewedBy(e.target.value)}
              className="medical-input"
            />
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-500 text-sm">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={saving || selected.length === 0 || !reviewedBy.trim()}
            className="primary-button"
          >
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Confirm Route
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add web/components/doctor/
git commit -m "feat: add VisitQueueCard and RouteApprovalDialog for doctor queue"
```

---

## Task 10: Doctor Queue — Intake Viewer + Page Shell

**Files:**
- Create: `web/components/doctor/intake-viewer-dialog.tsx`
- Create: `web/app/(dashboard)/doctor/queue/page.tsx`

- [ ] **Step 1: Create intake viewer dialog**

```typescript
// web/components/doctor/intake-viewer-dialog.tsx
"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getSessionMessages, type VisitDetail } from "@/lib/api";

interface IntakeViewerDialogProps {
  visit: VisitDetail | null;
  open: boolean;
  onClose: () => void;
}

interface SessionMessage {
  id: number;
  role: string;
  content: string;
  created_at: string;
}

export function IntakeViewerDialog({
  visit,
  open,
  onClose,
}: IntakeViewerDialogProps) {
  const [messages, setMessages] = useState<SessionMessage[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && visit?.intake_session_id) {
      setLoading(true);
      getSessionMessages(visit.intake_session_id)
        .then(setMessages)
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [open, visit?.intake_session_id]);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[600px] max-h-[70vh]">
        <DialogHeader>
          <DialogTitle>
            Intake Conversation — {visit?.visit_id}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[50vh] pr-2">
          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Loading conversation...
            </p>
          ) : messages.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No messages found.
            </p>
          ) : (
            <div className="space-y-3">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${
                    msg.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[80%] px-3 py-2 rounded-xl text-sm ${
                      msg.role === "user"
                        ? "bg-cyan-500/15"
                        : "bg-muted/50"
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Intake notes */}
        {visit?.intake_notes && (
          <div className="mt-4 p-3 bg-muted/30 rounded-lg border border-border/50">
            <p className="text-xs uppercase text-muted-foreground mb-1">
              Intake Notes
            </p>
            <p className="text-sm whitespace-pre-wrap">{visit.intake_notes}</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Create doctor queue page**

```typescript
// web/app/(dashboard)/doctor/queue/page.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VisitQueueCard } from "@/components/doctor/visit-queue-card";
import { RouteApprovalDialog } from "@/components/doctor/route-approval-dialog";
import { IntakeViewerDialog } from "@/components/doctor/intake-viewer-dialog";
import { listVisits, routeVisit, type VisitDetail, type Visit } from "@/lib/api";
import { Loader2 } from "lucide-react";

export default function DoctorQueuePage() {
  const [visits, setVisits] = useState<VisitDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("needs_review");

  // Dialog state
  const [routeDialogVisit, setRouteDialogVisit] = useState<VisitDetail | null>(null);
  const [intakeViewerVisit, setIntakeViewerVisit] = useState<VisitDetail | null>(null);

  const fetchVisits = useCallback(async () => {
    try {
      // Fetch all non-intake visits (we cast to VisitDetail — list endpoint returns enough data)
      const data = await listVisits();
      const nonIntake = data.filter((v) => v.status !== "intake") as unknown as VisitDetail[];
      setVisits(nonIntake);
    } catch (err) {
      console.error("Failed to fetch visits:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVisits();
    // Poll every 5 seconds
    const interval = setInterval(fetchVisits, 5000);
    return () => clearInterval(interval);
  }, [fetchVisits]);

  const needsReview = visits.filter((v) => v.status === "pending_review");
  const autoRouted = visits.filter((v) => v.status === "auto_routed");

  const handleApprove = async (visit: VisitDetail) => {
    if (!visit.routing_suggestion) return;
    try {
      await routeVisit(visit.id, visit.routing_suggestion, "Doctor (quick approve)");
      fetchVisits();
    } catch (err) {
      console.error("Failed to approve route:", err);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <h1 className="font-display text-2xl font-bold mb-6">Doctor&apos;s Queue</h1>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="needs_review">
            Needs Review ({needsReview.length})
          </TabsTrigger>
          <TabsTrigger value="auto_routed">
            Auto-Routed ({autoRouted.length})
          </TabsTrigger>
          <TabsTrigger value="all">
            All Visits ({visits.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="needs_review">
          <VisitList
            visits={needsReview}
            onApprove={handleApprove}
            onChangeRoute={setRouteDialogVisit}
            onViewIntake={setIntakeViewerVisit}
            emptyMessage="No visits pending review"
          />
        </TabsContent>

        <TabsContent value="auto_routed">
          <VisitList
            visits={autoRouted}
            onApprove={handleApprove}
            onChangeRoute={setRouteDialogVisit}
            onViewIntake={setIntakeViewerVisit}
            emptyMessage="No auto-routed visits"
          />
        </TabsContent>

        <TabsContent value="all">
          <VisitList
            visits={visits}
            onApprove={handleApprove}
            onChangeRoute={setRouteDialogVisit}
            onViewIntake={setIntakeViewerVisit}
            emptyMessage="No visits yet"
          />
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <RouteApprovalDialog
        visit={routeDialogVisit}
        open={!!routeDialogVisit}
        onClose={() => setRouteDialogVisit(null)}
        onRouted={fetchVisits}
      />
      <IntakeViewerDialog
        visit={intakeViewerVisit}
        open={!!intakeViewerVisit}
        onClose={() => setIntakeViewerVisit(null)}
      />
    </div>
  );
}

function VisitList({
  visits,
  onApprove,
  onChangeRoute,
  onViewIntake,
  emptyMessage,
}: {
  visits: VisitDetail[];
  onApprove: (v: VisitDetail) => void;
  onChangeRoute: (v: VisitDetail) => void;
  onViewIntake: (v: VisitDetail) => void;
  emptyMessage: string;
}) {
  if (visits.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground border-2 border-dashed border-border/50 rounded-lg">
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {visits.map((visit) => (
        <VisitQueueCard
          key={visit.id}
          visit={visit}
          onApprove={onApprove}
          onChangeRoute={onChangeRoute}
          onViewIntake={onViewIntake}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run:
```bash
cd /Users/kien.ha/Code/medical_agent/web && npx tsc --noEmit 2>&1 | grep -E "doctor|queue"
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add web/components/doctor/intake-viewer-dialog.tsx web/app/\(dashboard\)/doctor/
git commit -m "feat: add Doctor's review queue page with intake viewer"
```

---

## Task 11: Integration Verification

- [ ] **Step 1: Verify backend starts without errors**

Run:
```bash
cd /Users/kien.ha/Code/medical_agent && python -c "from src.api.server import app; print('Backend OK')"
```

Expected: `Backend OK`

- [ ] **Step 2: Verify frontend compiles without errors**

Run:
```bash
cd /Users/kien.ha/Code/medical_agent/web && npx tsc --noEmit 2>&1 | grep -v "types/agent.ts"
```

Expected: No new errors (only the pre-existing `types/agent.ts` error).

- [ ] **Step 3: Verify new API routes are registered**

Run:
```bash
cd /Users/kien.ha/Code/medical_agent && python -c "
from src.api.server import app
routes = [r.path for r in app.routes if hasattr(r, 'path')]
assert '/api/visits' in routes, 'Missing /api/visits route'
assert '/api/visits/{visit_id}' in routes, 'Missing /api/visits/{visit_id} route'
assert '/api/visits/{visit_id}/route' in routes, 'Missing /api/visits/{visit_id}/route route'
print('All visit routes registered')
"
```

Expected: `All visit routes registered`

- [ ] **Step 4: Final commit if any fixes were needed**

```bash
git add -A && git status
```

If changes exist, commit with appropriate message.
