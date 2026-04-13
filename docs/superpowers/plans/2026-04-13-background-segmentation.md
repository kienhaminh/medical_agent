# Background Segmentation with Agent Notification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make BraTS MRI segmentation non-blocking — UI-triggered runs notify via WebSocket toast; agent-triggered runs post a clinical interpretation into the chat conversation when done.

**Architecture:** A single async background worker `_run_segmentation_background` handles both paths. Path 1 (manual UI): fires from a new `POST /segment-async` endpoint, sends a `imaging.segmentation` WS event to the triggering doctor on completion. Path 2 (agent): the `segment_patient_image` tool fires the same worker with `session_id`, which on completion creates a trigger message and dispatches `_run_agent_background` to post the clinical interpretation back in the conversation.

**Tech Stack:** Python/FastAPI (asyncio background tasks), SQLAlchemy async, LangGraph agent, WebSocket connection manager, Next.js/React, TypeScript

---

## File Map

| File | Change |
|------|--------|
| `src/models/imaging.py` | Add `segmentation_status` column |
| `alembic/versions/009_imaging_segmentation_status.py` | Migration for new column |
| `src/api/ws/events.py` | Add `IMAGING_SEGMENTATION` event type |
| `src/api/routers/patients/segmentation_worker.py` | **New** — background worker + agent trigger |
| `src/api/routers/patients/imaging.py` | Add `POST /segment-async` endpoint |
| `src/tools/medical_img_segmentation_tool.py` | Make tool non-blocking, add `session_id` param |
| `src/api/routers/chat/messages.py` | Inject `session_id` into agent context message |
| `src/prompt/system.py` | Update `segment_patient_image` call instructions |
| `web/lib/ws-events.ts` | Add `imaging.segmentation` event type + routing |
| `web/lib/api.ts` | Add `runSegmentationAsync` function |
| `web/app/(dashboard)/doctor/page.tsx` | Pass `chatSessionId` + `userId` to `ClinicalWorkspace` |
| `web/components/doctor/clinical-workspace.tsx` | Thread `chatSessionId` + `userId` to `PatientCardPanel` |
| `web/components/doctor/patient-card-panel.tsx` | Thread `chatSessionId` + `userId` to `ImagingAnalysisDialog` |
| `web/components/doctor/imaging-analysis-dialog.tsx` | Use async endpoint, show queued state |

---

### Task 1: Add `segmentation_status` to Imaging model + migration

**Files:**
- Modify: `src/models/imaging.py`
- Create: `alembic/versions/009_imaging_segmentation_status.py`

- [ ] **Step 1: Add column to model**

In `src/models/imaging.py`, add after the `slice_index` column:

```python
# Status of the segmentation background job: idle | running | complete | error
segmentation_status: Mapped[str] = mapped_column(String(20), default="idle", server_default="idle")
```

Full updated class (only the columns section shown):

```python
class Imaging(Base):
    __tablename__ = "imaging"

    id: Mapped[int] = mapped_column(primary_key=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"), index=True)
    title: Mapped[str] = mapped_column(String(200))
    image_type: Mapped[str] = mapped_column(String(50))
    preview_url: Mapped[str] = mapped_column(Text)
    original_url: Mapped[str] = mapped_column(Text)
    segmentation_result: Mapped[Optional[Dict[str, Any]]] = mapped_column(_JSONB, nullable=True)
    slice_index: Mapped[Optional[int]] = mapped_column(nullable=True)
    segmentation_status: Mapped[str] = mapped_column(String(20), default="idle", server_default="idle")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())

    patient: Mapped["Patient"] = relationship(back_populates="imaging")
```

- [ ] **Step 2: Create migration**

Create `alembic/versions/009_imaging_segmentation_status.py`:

```python
"""Add segmentation_status to imaging

Revision ID: 009
Revises: 008
Create Date: 2026-04-13
"""
from alembic import op
import sqlalchemy as sa

revision = "009"
down_revision = "008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "imaging",
        sa.Column("segmentation_status", sa.String(20), nullable=False, server_default="idle"),
    )


def downgrade() -> None:
    op.drop_column("imaging", "segmentation_status")
```

- [ ] **Step 3: Run migration**

```bash
cd /Users/kien.ha/Code/medical_agent
alembic upgrade head
```

Expected: `Running upgrade ... -> 009, Add segmentation_status to imaging`

- [ ] **Step 4: Verify**

```bash
python -c "
from src.models import SessionLocal, Imaging
with SessionLocal() as db:
    col_names = [c.name for c in Imaging.__table__.columns]
    assert 'segmentation_status' in col_names, 'column missing'
    print('OK:', col_names)
"
```

Expected: prints column list including `segmentation_status`

- [ ] **Step 5: Commit**

```bash
git add src/models/imaging.py alembic/versions/009_imaging_segmentation_status.py
git commit -m "feat: add segmentation_status column to Imaging model"
```

---

### Task 2: Add `imaging.segmentation` WebSocket event type

**Files:**
- Modify: `src/api/ws/events.py`
- Modify: `web/lib/ws-events.ts`

- [ ] **Step 1: Add to backend enum**

In `src/api/ws/events.py`, add to the `WSEventType` enum and `NOTIFICATION_ROUTING`:

```python
class WSEventType(str, Enum):
    # ... existing entries ...
    IMAGING_SEGMENTATION = "imaging.segmentation"
```

Add to `NOTIFICATION_ROUTING`:

```python
NOTIFICATION_ROUTING: dict[WSEventType, dict[str, bool]] = {
    # ... existing entries ...
    WSEventType.IMAGING_SEGMENTATION: {"bell": True, "inline": False, "toast": True},
}
```

- [ ] **Step 2: Add to frontend event types**

In `web/lib/ws-events.ts`, extend `WSEventType`:

```typescript
export type WSEventType =
  | "order.created"
  | "order.claimed"
  | "order.completed"
  | "visit.created"
  | "visit.routed"
  | "visit.checked_in"
  | "visit.completed"
  | "visit.transferred"
  | "visit.notes_updated"
  | "queue.updated"
  | "ai.insight"
  | "lab.critical"
  | "imaging.segmentation";   // ← add this
```

Add to `NOTIFICATION_ROUTING`:

```typescript
export const NOTIFICATION_ROUTING: Record<WSEventType, NotificationLayers> = {
  // ... existing entries ...
  "imaging.segmentation": { bell: true, inline: false, toast: true },
};
```

Add to `eventTitle`:

```typescript
case "imaging.segmentation":
  return `Segmentation complete: ${payload.patient_name}`;
```

Add to `eventDescription`:

```typescript
case "imaging.segmentation":
  return "BraTS MRI segmentation finished. Open the imaging viewer to see results.";
```

- [ ] **Step 3: Commit**

```bash
git add src/api/ws/events.py web/lib/ws-events.ts
git commit -m "feat: add imaging.segmentation WebSocket event type"
```

---

### Task 3: Create background segmentation worker

**Files:**
- Create: `src/api/routers/patients/segmentation_worker.py`

- [ ] **Step 1: Create the worker module**

Create `src/api/routers/patients/segmentation_worker.py`:

```python
"""Background worker for BraTS MRI segmentation.

Two execution paths:
  Path 1 (session_id=None, user_id provided): Manual UI trigger.
    On completion → sends imaging.segmentation WS notification to the triggering doctor.

  Path 2 (session_id provided): Agent-initiated.
    On completion → creates a trigger message in the chat session and dispatches
    the agent to post a clinical interpretation in the conversation.
"""

import asyncio
import logging
import time

from sqlalchemy import select

from src.models import AsyncSessionLocal, Patient
from src.models.imaging import Imaging
from src.models.chat import ChatMessage
from src.api.ws.connection_manager import manager
from src.api.ws.events import WSEvent, WSEventType
from src.tools.medical_img_segmentation_tool import (
    _call_segmentation_mcp,
    _rewrite_for_mcp,
    _MODALITY_PARAM,
)
from src.utils.upload_storage import local_path_from_public_url, public_url_for_rel

logger = logging.getLogger(__name__)


async def _run_segmentation_background(
    patient_id: int,
    imaging_id: int,
    session_id: int | None = None,
    user_id: str | None = None,
) -> None:
    """Run BraTS segmentation in the background and notify on completion.

    Args:
        patient_id: Patient DB ID.
        imaging_id: Primary Imaging record DB ID (used to locate the group).
        session_id: If provided (agent path), posts agent interpretation to this chat session.
        user_id: If provided (manual path), sends WS notification to this specific user.
    """
    # Import here to avoid circular imports
    from src.api.routers.patients.imaging import _extract_aligned_preview

    try:
        # ── Step 1: Mark record as running ──────────────────────────────────
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(Imaging)
                .where(Imaging.id == imaging_id)
                .where(Imaging.patient_id == patient_id)
            )
            imaging_record = result.scalar_one_or_none()
            if not imaging_record:
                logger.warning("Segmentation background: imaging %d not found", imaging_id)
                return

            imaging_record.segmentation_status = "running"
            await db.commit()

            # Collect modality URLs (same logic as the synchronous segment endpoint)
            if imaging_record.group_id is not None:
                group_result = await db.execute(
                    select(Imaging)
                    .where(Imaging.group_id == imaging_record.group_id)
                    .where(Imaging.patient_id == patient_id)
                )
            else:
                group_result = await db.execute(
                    select(Imaging).where(Imaging.patient_id == patient_id)
                )
            group_images = group_result.scalars().all()

            modality_urls = {
                img.image_type: _rewrite_for_mcp(img.original_url)
                for img in group_images
                if img.image_type in _MODALITY_PARAM
            }
            if imaging_record.image_type in _MODALITY_PARAM:
                modality_urls[imaging_record.image_type] = _rewrite_for_mcp(imaging_record.original_url)

            slice_idx = imaging_record.slice_index if imaging_record.slice_index is not None else -1

            # Fetch patient name for notification message
            patient_result = await db.execute(select(Patient).where(Patient.id == patient_id))
            patient_obj = patient_result.scalar_one_or_none()
            patient_name = patient_obj.name if patient_obj else f"Patient {patient_id}"

        # ── Step 2: Run MCP (outside DB session — can take several minutes) ─
        segmentation_payload = await _call_segmentation_mcp(
            modality_urls=modality_urls,
            patient_id=str(patient_id),
            slice_index=slice_idx,
        )

        # ── Step 3: Persist result ───────────────────────────────────────────
        ts = int(time.time())
        artifacts = segmentation_payload.get("artifacts", {})
        for key in ("overlay_image", "predmask_image", "json_summary"):
            artifact = artifacts.get(key, {})
            if "url" in artifact:
                artifact["url"] = f"{artifact['url']}?v={ts}"
        segmentation_payload["artifacts"] = artifacts

        async with AsyncSessionLocal() as db:
            result = await db.execute(select(Imaging).where(Imaging.id == imaging_id))
            imaging_record = result.scalar_one_or_none()
            if not imaging_record:
                return

            imaging_record.segmentation_result = segmentation_payload
            imaging_record.segmentation_status = "complete"

            if imaging_record.slice_index is None:
                mcp_slice = segmentation_payload.get("input", {}).get("slice_index")
                if mcp_slice is not None:
                    imaging_record.slice_index = mcp_slice

            # Save aligned preview (matches MCP orientation for pixel-perfect overlay)
            used_slice = imaging_record.slice_index
            if used_slice is not None:
                nii_path = local_path_from_public_url(imaging_record.original_url)
                if nii_path and nii_path.is_file():
                    orig_stem = nii_path.stem.replace(".nii", "")
                    aligned_filename = f"{orig_stem}_aligned_preview.jpg"
                    aligned_path = nii_path.parent / aligned_filename
                    if _extract_aligned_preview(nii_path, used_slice, aligned_path):
                        rel = f"patients/{patient_id}/{aligned_filename}"
                        aligned_url = f"{public_url_for_rel(rel)}?v={ts}"
                        segmentation_payload["aligned_preview_url"] = aligned_url
                        imaging_record.segmentation_result = segmentation_payload

            await db.commit()

        # ── Step 4: Notify ───────────────────────────────────────────────────
        if session_id:
            await _trigger_agent_report(patient_id, patient_name, session_id, segmentation_payload)
        elif user_id:
            await _send_ws_notification(patient_id, patient_name, imaging_id, user_id, segmentation_payload)

    except Exception:
        logger.exception("Background segmentation failed for imaging %d", imaging_id)
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(Imaging).where(Imaging.id == imaging_id))
            imaging_record = result.scalar_one_or_none()
            if imaging_record:
                imaging_record.segmentation_status = "error"
                await db.commit()


async def _send_ws_notification(
    patient_id: int,
    patient_name: str,
    imaging_id: int,
    user_id: str,
    segmentation_payload: dict,
) -> None:
    """Send imaging.segmentation WS push notification to the triggering doctor."""
    overlay_url = (
        segmentation_payload.get("artifacts", {})
        .get("overlay_image", {})
        .get("url", "")
    )
    event = WSEvent(
        type=WSEventType.IMAGING_SEGMENTATION,
        payload={
            "patient_id": patient_id,
            "patient_name": patient_name,
            "imaging_id": imaging_id,
            "overlay_url": overlay_url,
        },
        target_type="user",
        target_id=user_id,
        severity="info",
    )
    await manager.send_to_user(user_id, event)
    logger.info("Sent segmentation WS notification to user=%s for patient=%d", user_id, patient_id)


async def _trigger_agent_report(
    patient_id: int,
    patient_name: str,
    session_id: int,
    segmentation_payload: dict,
) -> None:
    """Create a trigger message and dispatch the agent to interpret segmentation results."""
    # Import here to avoid circular imports at module load time
    from src.api.routers.chat.messages import _run_agent_background
    from src.api.routers.chat import broadcast as chat_broadcast

    overlay_url = (
        segmentation_payload.get("artifacts", {})
        .get("overlay_image", {})
        .get("url", "")
    )
    tumour_classes = segmentation_payload.get("prediction", {}).get("pred_classes_in_slice", [])
    modalities = segmentation_payload.get("input", {}).get("modalities_provided", [])

    trigger_content = (
        f"[System] BraTS segmentation for {patient_name} (patient_id={patient_id}) completed.\n"
        f"Modalities used: {', '.join(modalities)}\n"
        f"Tumour classes detected in best slice: {tumour_classes}\n"
        f"Overlay image: {overlay_url}\n\n"
        f"Please provide a concise clinical interpretation of these results, "
        f"including the overlay image using overlay_markdown format."
    )

    async with AsyncSessionLocal() as db:
        # Persist the trigger message so chat history is complete
        trigger_msg = ChatMessage(
            session_id=session_id,
            role="user",
            content=trigger_content,
            status="completed",
        )
        db.add(trigger_msg)
        await db.commit()

        # Create placeholder for the agent response
        assistant_msg = ChatMessage(
            session_id=session_id,
            role="assistant",
            content="",
            status="pending",
        )
        db.add(assistant_msg)
        await db.commit()
        await db.refresh(assistant_msg)
        assistant_msg_id = assistant_msg.id

    bg_task = asyncio.create_task(
        _run_agent_background(
            message_id=assistant_msg_id,
            session_id=session_id,
            user_id="system",
            user_message=trigger_content,
            patient_id=patient_id,
        )
    )
    chat_broadcast.register_task(assistant_msg_id, bg_task)
    logger.info(
        "Dispatched agent for segmentation report: session=%d message=%d",
        session_id,
        assistant_msg_id,
    )
```

- [ ] **Step 2: Commit**

```bash
git add src/api/routers/patients/segmentation_worker.py
git commit -m "feat: add background segmentation worker with WS notify and agent report"
```

---

### Task 4: Add `POST /segment-async` endpoint

**Files:**
- Modify: `src/api/routers/patients/imaging.py`

- [ ] **Step 1: Add request model and endpoint**

Add to the imports in `src/api/routers/patients/imaging.py`:

```python
from pydantic import BaseModel
from src.api.routers.patients.segmentation_worker import _run_segmentation_background
```

Add request model (before the router's first route):

```python
class SegmentAsyncRequest(BaseModel):
    """Body for the non-blocking segment-async endpoint."""
    user_id: str | None = None    # used for WS notification (manual path)
    session_id: int | None = None  # used for agent report (agent path)
```

Add the endpoint after the existing `/segment` endpoint:

```python
@router.post(
    "/api/patients/{patient_id}/imaging/{imaging_id}/segment-async",
    status_code=202,
)
async def segment_imaging_async(
    patient_id: int,
    imaging_id: int,
    body: SegmentAsyncRequest,
    db: AsyncSession = Depends(get_db),
):
    """Start BraTS segmentation as a background task and return immediately.

    On completion:
    - If body.session_id is set: agent posts clinical interpretation to that chat session.
    - If body.user_id is set: sends an imaging.segmentation WS notification to that user.
    """
    result = await db.execute(
        select(Imaging)
        .where(Imaging.id == imaging_id)
        .where(Imaging.patient_id == patient_id)
    )
    imaging_record = result.scalar_one_or_none()
    if not imaging_record:
        raise HTTPException(status_code=404, detail="Imaging record not found")

    if imaging_record.segmentation_status == "running":
        return {"status": "already_running", "imaging_id": imaging_id}

    asyncio.create_task(
        _run_segmentation_background(
            patient_id=patient_id,
            imaging_id=imaging_id,
            session_id=body.session_id,
            user_id=body.user_id,
        )
    )

    return {"status": "queued", "imaging_id": imaging_id}
```

- [ ] **Step 2: Verify endpoint appears in OpenAPI**

```bash
cd /Users/kien.ha/Code/medical_agent
python -c "
from src.api.server import app
routes = [r.path for r in app.routes]
match = [r for r in routes if 'segment-async' in r]
print('Found:', match)
assert match, 'endpoint not registered'
"
```

Expected: `Found: ['/api/patients/{patient_id}/imaging/{imaging_id}/segment-async']`

- [ ] **Step 3: Commit**

```bash
git add src/api/routers/patients/imaging.py
git commit -m "feat: add POST /segment-async endpoint for background segmentation"
```

---

### Task 5: Make `segment_patient_image` tool non-blocking

**Files:**
- Modify: `src/tools/medical_img_segmentation_tool.py`

- [ ] **Step 1: Add `session_id` param and background dispatch**

Replace the `segment_patient_image` function body. The new version checks the cache (same as before), and if a real MCP call is needed fires a background task instead of blocking:

```python
def segment_patient_image(patient_id: int, session_id: int | None = None) -> str:
    """Start MRI segmentation for a patient in the background.

    If a valid cached result exists, returns it immediately (no background task).
    Otherwise, fires a background asyncio task and returns status=queued.

    Args:
        patient_id: The patient's database ID.
        session_id: The active chat session ID. When provided, the agent will post
                    a clinical interpretation to this session when segmentation completes.

    Returns:
        JSON string. Either cached results (status=success, already_segmented=true)
        or {status: "queued"} when the background task has been dispatched.
    """
    from src.models import SessionLocal, Imaging
    from src.api.routers.patients.segmentation_worker import _run_segmentation_background

    try:
        with SessionLocal() as db:
            all_records = db.query(Imaging).filter(
                Imaging.patient_id == patient_id,
            ).order_by(Imaging.id).all()

            if not all_records:
                return json.dumps(
                    {"status": "error", "error": f"No MRI imaging records found for patient {patient_id}"},
                    ensure_ascii=True,
                )

            # Use the most recent imaging group; fall back to all records if ungrouped.
            grouped = [r for r in all_records if r.group_id is not None]
            if grouped:
                latest_group_id = max(r.group_id for r in grouped)
                imaging_records = [r for r in grouped if r.group_id == latest_group_id]
            else:
                imaging_records = all_records

            # Check for a cached segmentation result.
            intended_modalities = {
                img.image_type for img in imaging_records if img.image_type in _MODALITY_PARAM
            }
            cached_payload = None
            for rec in imaging_records:
                seg = rec.segmentation_result
                if not seg or seg.get("status") != "success":
                    continue
                cached_modalities = set(seg.get("input", {}).get("modalities_provided", []))
                if intended_modalities <= cached_modalities:
                    cached_payload = seg
                    break

            if cached_payload is not None:
                # Return cached result immediately — no background task needed.
                _output_base = os.getenv("PUBLIC_UPLOAD_BASE_URL", "http://localhost:8000/uploads").rstrip("/")
                for artifact in cached_payload.get("artifacts", {}).values():
                    if isinstance(artifact, dict) and "path" in artifact:
                        artifact["url"] = f"{_output_base}/{artifact['path'].rsplit('/', 1)[-1]}"

                overlay_url = cached_payload.get("artifacts", {}).get("overlay_image", {}).get("url", "")
                predmask_url = cached_payload.get("artifacts", {}).get("predmask_image", {}).get("url", "")
                tumour_classes = cached_payload.get("prediction", {}).get("pred_classes_in_slice", [])
                modalities_used = cached_payload.get("input", {}).get("modalities_provided", sorted(intended_modalities))

                return json.dumps(
                    {
                        "status": cached_payload.get("status", "unknown"),
                        "already_segmented": True,
                        "modalities_used": modalities_used,
                        "overlay_url": overlay_url,
                        "overlay_markdown": f"![MRI Segmentation Overlay]({overlay_url})",
                        "predmask_url": predmask_url,
                        "predmask_markdown": f"![Segmentation Mask]({predmask_url})" if predmask_url else "",
                        "tumour_classes": tumour_classes,
                    },
                    ensure_ascii=True,
                )

            # No cache — dispatch background task and return immediately.
            primary_imaging_id = imaging_records[0].id

        # Schedule the background coroutine on the running event loop.
        # The tool is called from within the async LangGraph agent, so a loop is always running.
        loop = asyncio.get_running_loop()
        loop.create_task(
            _run_segmentation_background(
                patient_id=patient_id,
                imaging_id=primary_imaging_id,
                session_id=session_id,
            )
        )

        return json.dumps(
            {
                "status": "queued",
                "message": (
                    f"BraTS segmentation has been started in the background for patient {patient_id}. "
                    "This typically takes 3–5 minutes. "
                    + (
                        "I will post the clinical interpretation directly in this conversation when it is ready."
                        if session_id
                        else "You will receive a notification when it is complete."
                    )
                ),
            },
            ensure_ascii=True,
        )

    except Exception as exc:
        return json.dumps(
            {
                "status": "error",
                "error": str(exc),
                "mcp_url": _mcp_url(),
            },
            ensure_ascii=True,
        )
```

- [ ] **Step 2: Commit**

```bash
git add src/tools/medical_img_segmentation_tool.py
git commit -m "feat: make segment_patient_image non-blocking, add session_id param"
```

---

### Task 6: Inject `session_id` into agent context + update system prompt

**Files:**
- Modify: `src/api/routers/chat/messages.py`
- Modify: `src/prompt/system.py`

- [ ] **Step 1: Add `session_id` to context message in `_run_agent_background`**

In `src/api/routers/chat/messages.py`, find the `context_message` construction inside `_run_agent_background` (around line 92):

```python
context_message = (
    f"Context: Patient {patient.name} "
    f"(DOB: {patient.dob}, Gender: {patient.gender}, patient_id={patient.id}"
)
```

Change to:

```python
context_message = (
    f"Context: Patient {patient.name} "
    f"(DOB: {patient.dob}, Gender: {patient.gender}, patient_id={patient.id}, "
    f"session_id={session_id}"
)
```

- [ ] **Step 2: Add `session_id` to context message in the streaming `/api/chat` endpoint**

In the same file, find the equivalent `context_message` construction in the `chat` function (around line 431):

```python
context_message = f"Context: Patient {patient.name} (DOB: {patient.dob}, Gender: {patient.gender}, patient_id={patient.id}).\n\n"
```

Change to:

```python
context_message = (
    f"Context: Patient {patient.name} "
    f"(DOB: {patient.dob}, Gender: {patient.gender}, patient_id={patient.id}, "
    f"session_id={session.id}).\n\n"
)
```

- [ ] **Step 3: Update system prompt for `segment_patient_image`**

In `src/prompt/system.py`, find the `segment_patient_image` tool section and update the "How to call" line:

Replace:
```
- **How to call:** `segment_patient_image(patient_id=<id>)` — call **exactly once** per request.
  - The tool fetches all MRI modality URLs for the patient and sends them in a single MCP call. No imaging_id needed.
  - Do NOT call this tool multiple times for the same patient.
```

With:
```
- **How to call:** `segment_patient_image(patient_id=<id>, session_id=<session_id>)` — call **exactly once** per request.
  - Always pass `session_id` from the context prepended to every message — this ensures results are posted back here when ready.
  - The tool fetches all MRI modality URLs for the patient and sends them in a single MCP call. No imaging_id needed.
  - Do NOT call this tool multiple times for the same patient.
- **Background behaviour:** If no cached result exists, the tool starts segmentation in the background and returns `status=queued` immediately. Tell the doctor: "Segmentation is running in the background — I'll post the results here when it's done (typically 3–5 minutes)." Do NOT say you cannot display results.
```

- [ ] **Step 4: Commit**

```bash
git add src/api/routers/chat/messages.py src/prompt/system.py
git commit -m "feat: inject session_id into agent context, update segmentation prompt"
```

---

### Task 7: Frontend API helper + prop threading

**Files:**
- Modify: `web/lib/api.ts`
- Modify: `web/app/(dashboard)/doctor/page.tsx`
- Modify: `web/components/doctor/clinical-workspace.tsx`
- Modify: `web/components/doctor/patient-card-panel.tsx`

- [ ] **Step 1: Add `runSegmentationAsync` to `web/lib/api.ts`**

Find the existing `runSegmentation` function in `web/lib/api.ts` and add this function after it:

```typescript
export async function runSegmentationAsync(
  patientId: number,
  imagingId: number,
  opts?: { userId?: string; sessionId?: number | null },
): Promise<{ status: string; imaging_id: number }> {
  const res = await fetch(
    `${API_BASE_URL}/patients/${patientId}/imaging/${imagingId}/segment-async`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: opts?.userId ?? null,
        session_id: opts?.sessionId ?? null,
      }),
    },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Segment-async failed: ${res.status}`);
  }
  return res.json();
}
```

- [ ] **Step 2: Pass `chatSessionId` and `userId` from doctor page to `ClinicalWorkspace`**

In `web/app/(dashboard)/doctor/page.tsx`, find where `ClinicalWorkspace` is rendered and add two props:

```tsx
<ClinicalWorkspace
  {/* ...existing props... */}
  chatSessionId={workspace.chatSessionId}
  userId={user ? String(user.id) : undefined}
/>
```

- [ ] **Step 3: Thread props through `ClinicalWorkspace`**

In `web/components/doctor/clinical-workspace.tsx`, extend `ClinicalWorkspaceProps`:

```typescript
interface ClinicalWorkspaceProps {
  // ...existing fields...
  chatSessionId?: number | null;
  userId?: string;
}
```

Pass them to `PatientCardPanel`:

```tsx
<PatientCardPanel
  patient={props.patient}
  selectedVisit={props.selectedVisit ?? null}
  visitBrief={props.visitBrief}
  briefLoading={props.briefLoading}
  chatSessionId={props.chatSessionId}
  userId={props.userId}
/>
```

- [ ] **Step 4: Thread props through `PatientCardPanel`**

In `web/components/doctor/patient-card-panel.tsx`, extend `PatientCardPanelProps` (find the existing interface):

```typescript
interface PatientCardPanelProps {
  // ...existing fields...
  chatSessionId?: number | null;
  userId?: string;
}
```

Pass them to `ImagingAnalysisDialog`:

```tsx
<ImagingAnalysisDialog
  imagingGroup={dialogGroup}
  patientId={patientId}
  onClose={() => setDialogGroup(null)}
  onSegmentationComplete={handleSegmentationComplete}
  sessionId={chatSessionId}
  userId={userId}
/>
```

- [ ] **Step 5: Type-check**

```bash
cd /Users/kien.ha/Code/medical_agent/web
npx tsc --noEmit 2>&1 | grep -E "doctor|clinical-workspace|patient-card|imaging-analysis" | head -20
```

Expected: no errors in these files.

- [ ] **Step 6: Commit**

```bash
git add web/lib/api.ts web/app/\(dashboard\)/doctor/page.tsx web/components/doctor/clinical-workspace.tsx web/components/doctor/patient-card-panel.tsx
git commit -m "feat: add runSegmentationAsync API helper, thread sessionId/userId to imaging dialog"
```

---

### Task 8: Update `ImagingAnalysisDialog` for async flow

**Files:**
- Modify: `web/components/doctor/imaging-analysis-dialog.tsx`

- [ ] **Step 1: Add new props and state**

Add `sessionId` and `userId` to the props interface:

```typescript
interface ImagingAnalysisDialogProps {
  imagingGroup: Imaging[];
  patientId: number;
  onClose: () => void;
  onSegmentationComplete: (updated: Imaging) => void;
  sessionId?: number | null;   // ← add
  userId?: string;              // ← add
}
```

Destructure in the component:

```typescript
export function ImagingAnalysisDialog({
  imagingGroup,
  patientId,
  onClose,
  onSegmentationComplete,
  sessionId,
  userId,
}: ImagingAnalysisDialogProps) {
```

Add a `queued` state alongside the existing `running` state:

```typescript
const [queued, setQueued] = useState(false);
```

- [ ] **Step 2: Replace `handleRunSegmentation`**

Replace the existing `handleRunSegmentation` callback:

```typescript
const handleRunSegmentation = useCallback(async () => {
  if (!primaryForSeg) return;
  setRunning(true);
  setError(null);
  try {
    await runSegmentationAsync(patientId, primaryForSeg.id, {
      userId: userId ?? undefined,
      sessionId: sessionId ?? undefined,
    });
    setQueued(true);
  } catch (err) {
    setError(err instanceof Error ? err.message : "Segmentation failed to start");
  } finally {
    setRunning(false);
  }
}, [primaryForSeg, patientId, userId, sessionId]);
```

Add the import at the top of the file:

```typescript
import { imagingSliceUrl, imagingMaskUrl, runSegmentationAsync } from "@/lib/api";
```

- [ ] **Step 3: Update the Run button and show queued state**

Find the bottom bar actions section. Replace the existing run button block:

```tsx
{/* Actions */}
<div className="flex items-center gap-3 shrink-0">
  {error && (
    <span className="text-[11px] text-red-400">{error}</span>
  )}
  {segResult && (
    <span className="text-[10px] font-mono" style={{ color: "rgba(255,255,255,0.22)" }}>
      {segResult.model?.architecture ?? ""}
    </span>
  )}

  {queued ? (
    <span
      className="text-[11px] font-mono px-3 py-1.5 rounded"
      style={{ border: "1px solid rgba(96,165,250,0.3)", color: "rgba(96,165,250,0.7)" }}
    >
      Running in background — you&apos;ll be notified when done
    </span>
  ) : segResult ? (
    <button
      type="button"
      onClick={handleRunSegmentation}
      disabled={running}
      className="px-3 py-1.5 text-[10px] font-bold tracking-wider rounded uppercase transition-opacity disabled:opacity-30 disabled:cursor-not-allowed"
      style={{ border: "1px solid rgba(255,255,255,0.18)", color: "rgba(255,255,255,0.45)" }}
    >
      ↺ Re-run
    </button>
  ) : (
    <button
      type="button"
      onClick={handleRunSegmentation}
      disabled={running || !primaryForSeg}
      className="flex items-center gap-2 px-4 py-2 text-[11px] font-bold tracking-wider rounded uppercase transition-all disabled:opacity-30 disabled:cursor-not-allowed"
      style={{ background: "#2563eb", color: "white" }}
    >
      <Layers className="h-3.5 w-3.5" />
      {running ? "Starting…" : "Run BraTS Segmentation"}
    </button>
  )}
</div>
```

- [ ] **Step 4: Remove the "Processing" full-screen overlay**

The existing full-screen processing overlay (the `{running && (...)}` block in the image area) should be removed — the dialog no longer blocks while running. Delete the block:

```tsx
{/* Processing overlay */}
{running && (
  <div
    className="absolute inset-0 flex flex-col items-center justify-center gap-4"
    style={{ background: "rgba(5,5,8,0.85)", backdropFilter: "blur(4px)" }}
  >
    ...
  </div>
)}
```

- [ ] **Step 5: Type-check**

```bash
cd /Users/kien.ha/Code/medical_agent/web
npx tsc --noEmit 2>&1 | grep "imaging-analysis" | head -10
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add web/components/doctor/imaging-analysis-dialog.tsx
git commit -m "feat: imaging dialog uses async segmentation, shows queued state"
```

---

### Task 9: Verify end-to-end (manual path)

- [ ] **Step 1: Start the dev stack**

```bash
cd /Users/kien.ha/Code/medical_agent
docker compose up -d   # or however the stack is started
```

- [ ] **Step 2: Trigger manual segmentation**

1. Open the doctor page, select a patient with MRI imaging
2. Open a study group → click "Run BraTS Segmentation"
3. Verify button changes to "Running in background — you'll be notified when done" immediately
4. Dialog can be closed without issue

- [ ] **Step 3: Verify WS notification arrives**

After 3–5 minutes (or faster if GPU):
1. Bell icon in header should show a new notification: "Segmentation complete: [Patient Name]"
2. Toast should appear at bottom of screen

- [ ] **Step 4: Verify agent path**

1. In the AI panel, type: "Please segment the MRI for this patient"
2. Agent should respond immediately: "BraTS segmentation has been started in the background… I'll post the results here when ready."
3. After 3–5 minutes, a new message should appear in the chat with the clinical interpretation and overlay image

- [ ] **Step 5: Verify DB state**

```bash
python -c "
from src.models import SessionLocal
from src.models.imaging import Imaging
with SessionLocal() as db:
    recs = db.query(Imaging).order_by(Imaging.id.desc()).limit(3).all()
    for r in recs:
        print(r.id, r.segmentation_status, bool(r.segmentation_result))
"
```

Expected: records show `complete True` after segmentation finishes.

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat: background BraTS segmentation with WS notify and agent report"
```
