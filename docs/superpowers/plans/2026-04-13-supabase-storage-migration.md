# Supabase Storage Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace local `uploads/` filesystem with Supabase Storage for all medical images so the backend server never touches image bytes.

**Architecture:** The backend streams uploads directly to Supabase Storage via `supabase-py`, stores public URLs in the DB, and passes those URLs to the segmentation MCP. The MCP downloads NIfTI files from Supabase, runs segmentation, generates all per-slice images (MRI JPEGs + mask PNGs), computes the best slice, uploads everything to Supabase, and returns structured metadata. The backend stores the result JSON in the DB — zero image bytes flow through the backend process.

**Tech Stack:** `supabase-py` (backend + MCP), Supabase Storage bucket `medical_images` (project `wdrbsbeowafbfpnourfm`), FastAPI, SQLAlchemy, Next.js (frontend slice viewer)

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/utils/upload_storage.py` | **Rewrite** | Supabase Storage client: upload bytes, build public URLs |
| `src/api/server.py` | **Modify** | Remove StaticFiles `/uploads` mount |
| `src/api/routers/patients/imaging.py` | **Modify** | Stream upload to Supabase; remove nibabel; remove `/slice` `/mask` endpoints |
| `src/api/routers/patients/segmentation_worker.py` | **Modify** | Remove local file ops (`_extract_aligned_preview`, `local_path_from_public_url`) |
| `src/tools/medical_img_segmentation_tool.py` | **Modify** | Pass `imaging_id` to MCP call |
| `src/tools/mri_best_slice_tool.py` | **Rewrite** | Pure DB read from `segmentation_result.best_slice` |
| `segmentation-mcp/mcp_server.py` | **Modify** | Add `imaging_id` param; generate all slices; compute best slice; fix storage paths |
| `docker-compose.yml` | **Modify** | Remove volume mount; add Supabase env vars to MCP service |
| `pyproject.toml` | **Modify** | Add `supabase` dependency |
| `.env.example` | **Modify** | Add `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET` |
| `web/lib/api.ts` | **Modify** | Remove `imagingSliceUrl` / `imagingMaskUrl` |
| `web/components/doctor/imaging-analysis-dialog.tsx` | **Modify** | Use Supabase slice URLs from `segmentation_result.slice_url_pattern` |

---

## Task 1: Add supabase dependency + env vars

**Files:**
- Modify: `pyproject.toml`
- Modify: `.env.example`

- [ ] **Step 1: Add supabase to pyproject.toml**

In `pyproject.toml` under `[tool.poetry.dependencies]`, add after line `pgvector = "^0.2.0"`:

```toml
supabase = "^2.0.0"
```

- [ ] **Step 2: Install dependency**

```bash
poetry add supabase
```

Expected: supabase installed, `poetry.lock` updated.

- [ ] **Step 3: Update .env.example**

Add to `.env.example` after the existing `DATABASE_URL` line:

```bash
# Supabase Storage (for medical images)
SUPABASE_URL=https://wdrbsbeowafbfpnourfm.supabase.co
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_STORAGE_BUCKET=medical_images
```

- [ ] **Step 4: Commit**

```bash
git add pyproject.toml poetry.lock .env.example
git commit -m "feat: add supabase-py dependency for storage migration"
```

---

## Task 2: Rewrite `upload_storage.py` as Supabase Storage client

**Files:**
- Modify: `src/utils/upload_storage.py`
- Create: `tests/unit/test_upload_storage.py`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/test_upload_storage.py`:

```python
"""Tests for Supabase-backed upload_storage module."""
import os
import pytest


def test_public_url_for_rel_builds_correct_url(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://abc123.supabase.co")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "test-key")
    monkeypatch.setenv("SUPABASE_STORAGE_BUCKET", "medical_images")

    # Import after env vars are set
    import importlib
    import src.utils.upload_storage as mod
    importlib.reload(mod)

    url = mod.public_url_for_rel("patients/1/scan.nii.gz")
    assert url == "https://abc123.supabase.co/storage/v1/object/public/medical_images/patients/1/scan.nii.gz"


def test_patient_rel_path():
    import src.utils.upload_storage as mod
    assert mod.patient_rel_path(42, "flair_abc.nii.gz") == "patients/42/flair_abc.nii.gz"


def test_slice_url_pattern(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://abc123.supabase.co")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "test-key")
    monkeypatch.setenv("SUPABASE_STORAGE_BUCKET", "medical_images")

    import importlib
    import src.utils.upload_storage as mod
    importlib.reload(mod)

    pattern = mod.slice_url_pattern(patient_id=1, imaging_id=5)
    assert pattern["mri"].startswith("https://abc123.supabase.co")
    assert "patients/1/slices/5/mri_z{z}.jpg" in pattern["mri"]
    assert "patients/1/slices/5/mask_z{z}.png" in pattern["mask"]
```

- [ ] **Step 2: Run test — expect failure**

```bash
pytest tests/unit/test_upload_storage.py -v
```

Expected: FAIL — old `upload_storage.py` has no `patient_rel_path` or `slice_url_pattern`.

- [ ] **Step 3: Rewrite `src/utils/upload_storage.py`**

Replace the entire file with:

```python
"""Supabase Storage client — replaces local uploads/ filesystem.

All medical images are stored in the Supabase Storage bucket defined by
SUPABASE_STORAGE_BUCKET (default: medical_images). The bucket is public,
so reads require no auth; writes use the service role key.

Required env vars:
  SUPABASE_URL               e.g. https://xyz.supabase.co
  SUPABASE_SERVICE_ROLE_KEY  from Supabase dashboard → Settings → API
  SUPABASE_STORAGE_BUCKET    default: medical_images
"""
from __future__ import annotations

import os
from functools import lru_cache

from supabase import create_client, Client


@lru_cache(maxsize=1)
def _client() -> Client:
    """Return a cached Supabase client (initialised once per process)."""
    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    return create_client(url, key)


def _bucket_name() -> str:
    return os.getenv("SUPABASE_STORAGE_BUCKET", "medical_images")


def upload_bytes(rel_path: str, data: bytes, content_type: str) -> str:
    """Upload *data* to Supabase Storage at *rel_path* and return its public URL.

    Uses upsert so re-uploading the same path overwrites the previous object.
    """
    rel = rel_path.lstrip("/")
    _client().storage.from_(_bucket_name()).upload(
        rel,
        data,
        {"content-type": content_type, "upsert": "true"},
    )
    return public_url_for_rel(rel)


def public_url_for_rel(rel_path: str) -> str:
    """Return the Supabase public URL for *rel_path* in the storage bucket."""
    supabase_url = os.environ["SUPABASE_URL"].rstrip("/")
    bucket = _bucket_name()
    rel = rel_path.lstrip("/")
    return f"{supabase_url}/storage/v1/object/public/{bucket}/{rel}"


def patient_rel_path(patient_id: int, filename: str) -> str:
    """Return the relative storage path for a per-patient file."""
    return f"patients/{patient_id}/{filename}"


def slice_url_pattern(patient_id: int, imaging_id: int) -> dict:
    """Return URL pattern dict for a patient/imaging slice set.

    Only ``{z}`` is a template variable — all other parts are concrete.

    Returns:
        {
            "mri":  "https://...patients/{id}/slices/{iid}/mri_z{z}.jpg",
            "mask": "https://...patients/{id}/slices/{iid}/mask_z{z}.png",
        }
    """
    base = public_url_for_rel(f"patients/{patient_id}/slices/{imaging_id}")
    return {
        "mri": f"{base}/mri_z{{z}}.jpg",
        "mask": f"{base}/mask_z{{z}}.png",
    }
```

- [ ] **Step 4: Run tests — expect pass**

```bash
pytest tests/unit/test_upload_storage.py -v
```

Expected: 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/upload_storage.py tests/unit/test_upload_storage.py
git commit -m "feat: rewrite upload_storage.py as Supabase Storage client"
```

---

## Task 3: Update upload endpoint in `imaging.py`

**Files:**
- Modify: `src/api/routers/patients/imaging.py`

This task:
- Rewrites the `/upload` endpoint to stream bytes to Supabase
- Removes all nibabel functions (`_extract_aligned_preview`, `_extract_slice_jpeg`, `_extract_mask_png`, `_nifti_depth`)
- Removes `/slice` and `/mask` GET endpoints
- Removes local file deletion from the DELETE endpoint
- Updates `_imaging_to_response` to read `volume_depth` from `segmentation_result`

- [ ] **Step 1: Replace the upload endpoint and remove nibabel code**

In `src/api/routers/patients/imaging.py`, replace the entire file with:

```python
"""Patient imaging operations."""
import asyncio
import logging
import uuid
from pathlib import Path

from fastapi import APIRouter, HTTPException, Depends, File, Form, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from src.models import get_db, Patient, Imaging, ImageGroup
from src.tools.medical_img_segmentation_tool import (
    _call_segmentation_mcp,
    _rewrite_for_mcp,
    _MODALITY_PARAM,
)
from src.utils.upload_storage import upload_bytes, public_url_for_rel, patient_rel_path
from pydantic import BaseModel, model_validator

from ...models import ImagingResponse, ImageGroupResponse, ImageGroupCreate, ImagingCreate
from src.api.routers.patients.segmentation_worker import _run_segmentation_background

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Patients"])

# Strong reference set to prevent asyncio background tasks from being garbage-collected
_background_tasks: set[asyncio.Task] = set()


class SegmentAsyncRequest(BaseModel):
    """Body for the non-blocking segment-async endpoint."""
    user_id: str | None = None
    session_id: int | None = None

    @model_validator(mode="after")
    def require_at_least_one(self) -> "SegmentAsyncRequest":
        if self.user_id is None and self.session_id is None:
            raise ValueError("At least one of user_id or session_id must be provided")
        return self


def _imaging_to_response(i: Imaging) -> ImagingResponse:
    """Convert Imaging ORM to ImagingResponse. volume_depth comes from segmentation result."""
    seg = i.segmentation_result
    volume_depth: int | None = None
    if seg and isinstance(seg.get("input", {}).get("shape_zyx"), list):
        shape = seg["input"]["shape_zyx"]
        if shape:
            volume_depth = int(shape[0])
    return ImagingResponse(
        id=i.id,
        patient_id=i.patient_id,
        title=i.title,
        image_type=i.image_type,
        original_url=i.original_url,
        preview_url=i.preview_url,
        group_id=i.group_id,
        segmentation_result=seg,
        slice_index=i.slice_index,
        aligned_preview_url=None,
        volume_depth=volume_depth,
        created_at=i.created_at.isoformat(),
    )


@router.get("/api/patients/{patient_id}/imaging", response_model=list[ImagingResponse])
async def list_patient_imaging(patient_id: int, db: AsyncSession = Depends(get_db)):
    """List all imaging records for a patient."""
    result = await db.execute(select(Patient).where(Patient.id == patient_id))
    if result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Patient not found")

    imaging_result = await db.execute(
        select(Imaging)
        .where(Imaging.patient_id == patient_id)
        .order_by(Imaging.created_at.desc())
    )
    return [_imaging_to_response(i) for i in imaging_result.scalars().all()]


@router.post("/api/patients/{patient_id}/imaging", response_model=ImagingResponse)
async def create_imaging_record(
    patient_id: int,
    imaging: ImagingCreate,
    db: AsyncSession = Depends(get_db),
):
    """Create an imaging record with pre-supplied URLs (no file upload)."""
    result = await db.execute(select(Patient).where(Patient.id == patient_id))
    if result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Patient not found")

    new_imaging = Imaging(
        patient_id=patient_id,
        title=imaging.title,
        image_type=imaging.image_type,
        original_url=imaging.original_url,
        preview_url=imaging.preview_url,
        group_id=imaging.group_id,
    )
    db.add(new_imaging)
    await db.commit()
    await db.refresh(new_imaging)
    return _imaging_to_response(new_imaging)


@router.post("/api/patients/{patient_id}/imaging/upload", response_model=ImagingResponse)
async def upload_imaging_files(
    patient_id: int,
    preview: UploadFile = File(..., description="Preview image (JPG/PNG)"),
    volume: UploadFile = File(..., description="Original volume (.nii.gz)"),
    title: str = Form(...),
    image_type: str = Form(...),
    group_id: int | None = Form(None),
    db: AsyncSession = Depends(get_db),
):
    """Upload preview JPG and .nii.gz NIfTI to Supabase Storage and create DB row."""
    result = await db.execute(select(Patient).where(Patient.id == patient_id))
    if result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Patient not found")

    uid = uuid.uuid4().hex[:8]
    base = f"{image_type.lower()}_{uid}"

    # Validate and name preview file
    prev_name = (preview.filename or "").lower()
    if prev_name.endswith((".jpg", ".jpeg")):
        preview_filename = f"{base}_preview.jpg"
        preview_content_type = "image/jpeg"
    elif prev_name.endswith(".png"):
        preview_filename = f"{base}_preview.png"
        preview_content_type = "image/png"
    else:
        raise HTTPException(status_code=400, detail="Preview must be .jpg, .jpeg, or .png")

    # Validate and name volume file
    vol_name = (volume.filename or "").lower()
    if vol_name.endswith(".nii.gz"):
        volume_filename = f"{base}.nii.gz"
    elif vol_name.endswith(".nii"):
        volume_filename = f"{base}.nii"
    else:
        raise HTTPException(status_code=400, detail="Volume must be .nii.gz or .nii")

    # Read and upload both files to Supabase Storage
    try:
        preview_bytes = await preview.read()
        preview_url = upload_bytes(
            patient_rel_path(patient_id, preview_filename),
            preview_bytes,
            preview_content_type,
        )

        volume_bytes = await volume.read()
        volume_url = upload_bytes(
            patient_rel_path(patient_id, volume_filename),
            volume_bytes,
            "application/gzip",
        )
    except Exception as exc:
        logger.exception("Failed to upload imaging files for patient %s", patient_id)
        raise HTTPException(status_code=500, detail=f"Upload to storage failed: {exc}") from exc

    new_imaging = Imaging(
        patient_id=patient_id,
        title=title,
        image_type=image_type,
        original_url=volume_url,
        preview_url=preview_url,
        group_id=group_id,
    )
    db.add(new_imaging)
    await db.commit()
    await db.refresh(new_imaging)
    return _imaging_to_response(new_imaging)


@router.delete("/api/patients/{patient_id}/imaging/{imaging_id}")
async def delete_imaging_record(
    patient_id: int,
    imaging_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Delete an imaging record (DB row only; Supabase objects are retained)."""
    result = await db.execute(
        select(Imaging)
        .where(Imaging.id == imaging_id)
        .where(Imaging.patient_id == patient_id)
    )
    imaging = result.scalar_one_or_none()
    if not imaging:
        raise HTTPException(status_code=404, detail="Imaging record not found")

    await db.delete(imaging)
    await db.commit()
    return {"message": "Imaging record deleted successfully"}


@router.post("/api/patients/{patient_id}/image-groups", response_model=ImageGroupResponse)
async def create_image_group(
    patient_id: int,
    group: ImageGroupCreate,
    db: AsyncSession = Depends(get_db),
):
    """Create an image group for a patient."""
    result = await db.execute(select(Patient).where(Patient.id == patient_id))
    if result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Patient not found")

    new_group = ImageGroup(patient_id=patient_id, name=group.name)
    db.add(new_group)
    await db.commit()
    await db.refresh(new_group)
    return ImageGroupResponse(
        id=new_group.id,
        patient_id=new_group.patient_id,
        name=new_group.name,
        created_at=new_group.created_at.isoformat(),
    )


@router.get("/api/patients/{patient_id}/image-groups", response_model=list[ImageGroupResponse])
async def list_image_groups(patient_id: int, db: AsyncSession = Depends(get_db)):
    """List all image groups for a patient."""
    result = await db.execute(select(Patient).where(Patient.id == patient_id))
    if result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Patient not found")

    groups_result = await db.execute(
        select(ImageGroup)
        .where(ImageGroup.patient_id == patient_id)
        .order_by(ImageGroup.created_at.desc())
    )
    return [
        ImageGroupResponse(
            id=g.id,
            patient_id=g.patient_id,
            name=g.name,
            created_at=g.created_at.isoformat(),
        )
        for g in groups_result.scalars().all()
    ]


@router.post(
    "/api/patients/{patient_id}/imaging/{imaging_id}/segment",
    response_model=ImagingResponse,
)
async def segment_imaging(
    patient_id: int,
    imaging_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Run BraTS segmentation synchronously via MCP and persist result."""
    result = await db.execute(
        select(Imaging)
        .where(Imaging.id == imaging_id)
        .where(Imaging.patient_id == patient_id)
    )
    imaging_record = result.scalar_one_or_none()
    if not imaging_record:
        raise HTTPException(status_code=404, detail="Imaging record not found")

    if imaging_record.image_type not in _MODALITY_PARAM:
        raise HTTPException(
            status_code=400,
            detail=f"Image type '{imaging_record.image_type}' not supported for segmentation",
        )

    slice_idx = imaging_record.slice_index if imaging_record.slice_index is not None else -1

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
    modality_urls[imaging_record.image_type] = _rewrite_for_mcp(imaging_record.original_url)

    try:
        segmentation_payload = await _call_segmentation_mcp(
            modality_urls=modality_urls,
            patient_id=str(patient_id),
            imaging_id=str(imaging_id),
            slice_index=slice_idx,
        )
    except Exception as exc:
        logger.exception("Segmentation MCP call failed for imaging %d", imaging_id)
        raise HTTPException(status_code=502, detail=f"Segmentation service error: {exc}")

    imaging_record.segmentation_result = segmentation_payload
    if imaging_record.slice_index is None:
        mcp_slice = segmentation_payload.get("input", {}).get("slice_index")
        if mcp_slice is not None:
            imaging_record.slice_index = mcp_slice

    await db.commit()
    await db.refresh(imaging_record)
    return _imaging_to_response(imaging_record)


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
    """Start BraTS segmentation as a background task and return immediately."""
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

    task = asyncio.create_task(
        _run_segmentation_background(
            patient_id=patient_id,
            imaging_id=imaging_id,
            session_id=body.session_id,
            user_id=body.user_id,
        )
    )
    _background_tasks.add(task)
    task.add_done_callback(_background_tasks.discard)
    return {"status": "queued", "imaging_id": imaging_id}
```

- [ ] **Step 2: Run existing tests to confirm no regressions**

```bash
pytest tests/ -v -k "not integration" 2>&1 | tail -20
```

Expected: existing tests pass (none directly test nibabel endpoints).

- [ ] **Step 3: Commit**

```bash
git add src/api/routers/patients/imaging.py
git commit -m "feat(imaging): stream upload to Supabase; remove nibabel slice/mask endpoints"
```

---

## Task 4: Update `segmentation_worker.py`

**Files:**
- Modify: `src/api/routers/patients/segmentation_worker.py`

Remove local file operations (`_extract_aligned_preview`, `local_path_from_public_url`, `public_url_for_rel`). Pass `imaging_id` to `_call_segmentation_mcp`.

- [ ] **Step 1: Apply changes**

Replace `src/api/routers/patients/segmentation_worker.py` with:

```python
"""Background worker for BraTS MRI segmentation.

Two execution paths:
  Path 1 (user_id provided): Manual UI trigger → WS notification on completion.
  Path 2 (session_id provided): Agent-initiated → agent posts clinical interpretation.
"""

import asyncio
import logging

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

logger = logging.getLogger(__name__)


async def _run_segmentation_background(
    patient_id: int,
    imaging_id: int,
    session_id: int | None = None,
    user_id: str | None = None,
) -> None:
    """Run BraTS segmentation in the background and notify on completion."""
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
                modality_urls[imaging_record.image_type] = _rewrite_for_mcp(
                    imaging_record.original_url
                )

            slice_idx = imaging_record.slice_index if imaging_record.slice_index is not None else -1

            patient_result = await db.execute(select(Patient).where(Patient.id == patient_id))
            patient_obj = patient_result.scalar_one_or_none()
            patient_name = patient_obj.name if patient_obj else f"Patient {patient_id}"

        # ── Step 2: Run MCP (outside DB session) ─────────────────────────────
        segmentation_payload = await _call_segmentation_mcp(
            modality_urls=modality_urls,
            patient_id=str(patient_id),
            imaging_id=str(imaging_id),
            slice_index=slice_idx,
        )

        # ── Step 3: Persist result ────────────────────────────────────────────
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

            await db.commit()

        # ── Step 4: Notify ────────────────────────────────────────────────────
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
        segmentation_payload.get("best_slice", {}).get("overlay_url")
        or segmentation_payload.get("artifacts", {}).get("overlay_image", {}).get("url", "")
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


async def _trigger_agent_report(
    patient_id: int,
    patient_name: str,
    session_id: int,
    segmentation_payload: dict,
) -> None:
    """Create a trigger message and dispatch the agent to interpret segmentation results."""
    from src.api.routers.chat.messages import _run_agent_background
    from src.api.routers.chat import broadcast as chat_broadcast  # noqa: F401

    overlay_url = (
        segmentation_payload.get("best_slice", {}).get("overlay_url")
        or segmentation_payload.get("artifacts", {}).get("overlay_image", {}).get("url", "")
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
        trigger_msg = ChatMessage(
            session_id=session_id,
            role="user",
            content=trigger_content,
            status="completed",
        )
        db.add(trigger_msg)
        await db.commit()

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
```

- [ ] **Step 2: Commit**

```bash
git add src/api/routers/patients/segmentation_worker.py
git commit -m "feat(segmentation): remove local file ops; pass imaging_id to MCP"
```

---

## Task 5: Remove StaticFiles mount from `server.py`

**Files:**
- Modify: `src/api/server.py`

- [ ] **Step 1: Remove StaticFiles import and mount**

In `src/api/server.py`:

Remove the import:
```python
from src.utils.upload_storage import upload_root
```

Remove the line:
```python
app.mount("/uploads", StaticFiles(directory=str(upload_root())), name="uploads")
```

Also remove `StaticFiles` from the `fastapi.staticfiles` import (or the whole import line if it's only used there).

- [ ] **Step 2: Verify server starts**

```bash
uvicorn src.api.server:app --reload --port 8000 2>&1 | head -10
```

Expected: server starts without errors about `upload_root` or `StaticFiles`.

Kill with `Ctrl-C`.

- [ ] **Step 3: Commit**

```bash
git add src/api/server.py
git commit -m "feat(server): remove /uploads StaticFiles mount (images now on Supabase)"
```

---

## Task 6: Update `_call_segmentation_mcp` to pass `imaging_id`

**Files:**
- Modify: `src/tools/medical_img_segmentation_tool.py`

- [ ] **Step 1: Add `imaging_id` parameter to `_call_segmentation_mcp`**

In `src/tools/medical_img_segmentation_tool.py`, change the `_call_segmentation_mcp` signature and body:

```python
async def _call_segmentation_mcp(
    modality_urls: dict[str, str],
    patient_id: str = "remote",
    imaging_id: str = "0",
    slice_index: int = -1,
    fold: int = 3,
    alpha: float = 0.45,
) -> dict[str, Any]:
    """Call the MCP segmentation tool with per-modality URLs."""
    arguments: dict[str, Any] = {
        "patient_id": patient_id,
        "imaging_id": imaging_id,
        "slice_index": slice_index,
        "fold": fold,
        "alpha": alpha,
    }
    for mod, param in _MODALITY_PARAM.items():
        if mod in modality_urls:
            arguments[param] = modality_urls[mod]

    url = _mcp_url()
    async with streamablehttp_client(url, timeout=600, sse_read_timeout=600) as (read_stream, write_stream, _):
        async with ClientSession(read_stream, write_stream) as session:
            await session.initialize()
            tool_result = await session.call_tool("segment_brats_from_link", arguments=arguments)

            if getattr(tool_result, "structuredContent", None):
                return tool_result.structuredContent

            if getattr(tool_result, "content", None):
                for content in tool_result.content:
                    text = getattr(content, "text", None)
                    if text:
                        try:
                            return json.loads(text)
                        except Exception:
                            return {"status": "unknown", "raw_text": text}

            return {"status": "unknown", "raw_result": str(tool_result)}
```

- [ ] **Step 2: Commit**

```bash
git add src/tools/medical_img_segmentation_tool.py
git commit -m "feat(segmentation-tool): pass imaging_id to MCP for correct storage paths"
```

---

## Task 7: Update `mcp_server.py` — add imaging_id, per-slice generation, best slice

**Files:**
- Modify: `segmentation-mcp/mcp_server.py`

This is the largest MCP change. Key additions:
1. Add `imaging_id: str = "0"` parameter
2. Fix env var: `SUPABASE_KEY` → `SUPABASE_SERVICE_ROLE_KEY`
3. Fix storage paths to use `patients/{patient_id}/slices/{imaging_id}/`
4. Generate per-slice MRI JPEGs and mask PNGs for all Z
5. Compute best slice (max non-zero voxels)
6. Add `slice_url_pattern` and `best_slice` to result

- [ ] **Step 1: Fix env var name and add imaging_id parameter**

In `segmentation-mcp/mcp_server.py`, change:

```python
# OLD:
_SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")
```

to:

```python
_SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
```

Add `imaging_id: str = "0"` as a parameter to `segment_brats_from_link` after `patient_id`:

```python
@mcp.tool()
def segment_brats_from_link(
    patient_id: str = "remote",
    imaging_id: str = "0",
    flair_url: str | None = None,
    t1_url: str | None = None,
    t1ce_url: str | None = None,
    t2_url: str | None = None,
    slice_index: int = -1,
    fold: int = 3,
    alpha: float = 0.45,
) -> dict[str, Any]:
```

- [ ] **Step 2: Add per-slice generation after `full_pred` is computed**

After the line `full_pred[z0 : z0 + dz, y0 : y0 + dy, x0 : x0 + dx] = pred`, add:

```python
        # ── Per-slice images ──────────────────────────────────────────────────
        slices_prefix = f"patients/{patient_id}/slices/{imaging_id}"

        for z in range(depth):
            # MRI slice: grayscale JPEG
            mri_u8 = _normalize_slice_u8(anchor_vol[z, :, :])
            mri_rgb = np.stack([mri_u8, mri_u8, mri_u8], axis=-1)
            mri_pil = Image.fromarray(mri_rgb, mode="RGB").resize((512, 512), Image.LANCZOS)
            mri_z_path = td_path / f"mri_z{z}.jpg"
            mri_pil.save(str(mri_z_path), "JPEG", quality=85)
            _upload_to_supabase(supabase, mri_z_path, f"{slices_prefix}/mri_z{z}.jpg")

            # Mask slice: RGBA PNG with transparent background
            label_z = full_pred[z, :, :]
            mask_rgba = np.zeros((*label_z.shape, 4), dtype=np.uint8)
            for cls, color in color_map.items():
                m = label_z == cls
                if np.any(m):
                    mask_rgba[m, :3] = color.astype(np.uint8)
                    mask_rgba[m, 3] = 255
            mask_pil = Image.fromarray(mask_rgba, mode="RGBA").resize((512, 512), Image.NEAREST)
            mask_z_path = td_path / f"mask_z{z}.png"
            mask_pil.save(str(mask_z_path))
            _upload_to_supabase(supabase, mask_z_path, f"{slices_prefix}/mask_z{z}.png")

        # ── Best slice ────────────────────────────────────────────────────────
        slice_voxels = np.count_nonzero(full_pred, axis=(1, 2))
        best_z = int(np.argmax(slice_voxels))
        best_voxel_count = int(slice_voxels[best_z])
        total_voxels = height * width
        coverage_pct = round(float(best_voxel_count) / total_voxels * 100, 2)
        best_classes = [int(c) for c in np.unique(full_pred[best_z]) if c != 0]

        # Render best slice overlay (MRI + mask blend)
        best_base_u8 = _normalize_slice_u8(anchor_vol[best_z, :, :])
        best_base = np.stack([best_base_u8, best_base_u8, best_base_u8], axis=-1).astype(np.float32)
        best_overlay = best_base.copy()
        best_label = full_pred[best_z, :, :]
        for cls, color in color_map.items():
            m = best_label == cls
            if np.any(m):
                best_overlay[m] = (1.0 - alpha) * best_overlay[m] + alpha * color
        best_slice_pil = Image.fromarray(
            best_overlay.clip(0, 255).astype(np.uint8), mode="RGB"
        ).resize((512, 512), Image.LANCZOS)
        best_slice_path = td_path / "best_slice.jpg"
        best_slice_pil.save(str(best_slice_path), "JPEG", quality=90)
        best_slice_url = _upload_to_supabase(supabase, best_slice_path, f"{slices_prefix}/best_slice.jpg")
```

- [ ] **Step 3: Update result dict to include `slice_url_pattern` and `best_slice`**

The Supabase public URL base is `{_SUPABASE_URL}/storage/v1/object/public/{_SUPABASE_BUCKET}`.

Replace the `result = { ... }` block with:

```python
        supabase_base = f"{_SUPABASE_URL.rstrip('/')}/storage/v1/object/public/{_SUPABASE_BUCKET}"

        result = {
            "patient_id": patient_id,
            "input": {
                "modalities_provided": modalities_used,
                "modalities_zero_filled": [m for m in _MODALITY_ORDER if m not in provided],
                "shape_zyx": [depth, height, width],
                "slice_index": slice_z,
            },
            "model": {
                "architecture": "AttCo_BraTS",
                "checkpoint": str(checkpoint_path),
                "device": str(device),
                "num_classes": 4,
                "label_ids": {
                    "0": "background",
                    "1": "tumor-class-1",
                    "2": "tumor-class-2",
                    "3": "tumor-class-3",
                },
            },
            "preprocess": {
                "normalization": "standardize_nonzeros per modality",
                "crop": {
                    "start_zyx": [z0, y0, x0],
                    "size_dhw": [dz, dy, dx],
                },
            },
            "prediction": {
                "full_pred_shape_zyx": [depth, height, width],
                "slice_pred_shape_yx": [height, width],
                "pred_classes_in_slice": [int(v) for v in np.unique(label_slice)],
            },
            "slice_url_pattern": {
                "mri": f"{supabase_base}/{slices_prefix}/mri_z{{z}}.jpg",
                "mask": f"{supabase_base}/{slices_prefix}/mask_z{{z}}.png",
            },
            "best_slice": {
                "overlay_url": best_slice_url,
                "slice_index": best_z,
                "tumour_voxels": best_voxel_count,
                "coverage_pct": coverage_pct,
                "tumour_classes_present": best_classes,
            },
            "artifacts": {
                "overlay_image": {"url": overlay_url, "format": "jpg"},
                "predmask_image": {"url": predmask_url, "format": "png"},
                "pred_mask_3d": {"url": pred_nii_url, "format": "nii.gz"},
            },
            "status": "success",
        }
```

Note: also update the upload paths for the existing artifacts to use `patients/{patient_id}/` prefix:

```python
        # Upload existing artifacts to patients/{patient_id}/ prefix
        patient_prefix = f"patients/{patient_id}"
        overlay_url = _upload_to_supabase(supabase, overlay_path, f"{patient_prefix}/{prefix}_overlay.jpg")
        predmask_url = _upload_to_supabase(supabase, predmask_path, f"{patient_prefix}/{prefix}_predmask.png")
        pred_nii_url = _upload_to_supabase(supabase, pred_nii_path, f"{patient_prefix}/{prefix}_predmask3d.nii.gz")
```

- [ ] **Step 4: Commit**

```bash
git add segmentation-mcp/mcp_server.py
git commit -m "feat(mcp): add imaging_id; generate per-slice images; compute best_slice; fix storage paths"
```

---

## Task 8: Rewrite `mri_best_slice_tool.py` as pure DB read

**Files:**
- Modify: `src/tools/mri_best_slice_tool.py`
- Create: `tests/unit/test_mri_best_slice_tool.py`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/test_mri_best_slice_tool.py`:

```python
"""Tests for the pure-DB-read get_best_segmentation_slice tool."""
import json
from unittest.mock import MagicMock, patch


def _make_imaging(seg_result: dict | None):
    img = MagicMock()
    img.segmentation_result = seg_result
    return img


def test_returns_best_slice_from_db():
    seg = {
        "status": "success",
        "best_slice": {
            "overlay_url": "https://supabase.co/storage/v1/object/public/medical_images/patients/1/slices/5/best_slice.jpg",
            "slice_index": 51,
            "tumour_voxels": 2430,
            "coverage_pct": 4.2,
            "tumour_classes_present": [1, 2],
        },
    }

    mock_db = MagicMock()
    mock_db.__enter__ = MagicMock(return_value=mock_db)
    mock_db.__exit__ = MagicMock(return_value=False)
    mock_db.query.return_value.filter.return_value.first.return_value = _make_imaging(seg)

    with patch("src.tools.mri_best_slice_tool.SessionLocal", return_value=mock_db):
        from src.tools.mri_best_slice_tool import get_best_segmentation_slice
        result = json.loads(get_best_segmentation_slice(patient_id=1))

    assert result["status"] == "success"
    assert result["slice_index"] == 51
    assert result["coverage_pct"] == 4.2
    assert "Necrotic Core" in result["tumour_classes_present"]
    assert "best_slice.jpg" in result["overlay_url"]
    assert "z=51" in result["overlay_markdown"]


def test_returns_error_when_no_segmentation():
    mock_db = MagicMock()
    mock_db.__enter__ = MagicMock(return_value=mock_db)
    mock_db.__exit__ = MagicMock(return_value=False)
    mock_db.query.return_value.filter.return_value.first.return_value = None

    with patch("src.tools.mri_best_slice_tool.SessionLocal", return_value=mock_db):
        from src.tools.mri_best_slice_tool import get_best_segmentation_slice
        result = json.loads(get_best_segmentation_slice(patient_id=99))

    assert result["status"] == "error"
    assert "No segmentation" in result["error"]


def test_returns_error_when_no_best_slice_key():
    seg = {"status": "success"}  # missing best_slice
    mock_db = MagicMock()
    mock_db.__enter__ = MagicMock(return_value=mock_db)
    mock_db.__exit__ = MagicMock(return_value=False)
    mock_db.query.return_value.filter.return_value.first.return_value = _make_imaging(seg)

    with patch("src.tools.mri_best_slice_tool.SessionLocal", return_value=mock_db):
        from src.tools.mri_best_slice_tool import get_best_segmentation_slice
        result = json.loads(get_best_segmentation_slice(patient_id=1))

    assert result["status"] == "error"
    assert "best_slice" in result["error"]
```

- [ ] **Step 2: Run test — expect failure**

```bash
pytest tests/unit/test_mri_best_slice_tool.py -v
```

Expected: FAIL — current implementation uses nibabel, not DB read.

- [ ] **Step 3: Rewrite `src/tools/mri_best_slice_tool.py`**

```python
"""Tool to return the best segmentation slice from stored segmentation metadata."""

import json

from src.tools.registry import ToolRegistry

_CLASS_LABELS = {
    1: "Necrotic Core (TC)",
    2: "Oedema (ED)",
    3: "Enhancing Tumour (ET)",
    4: "Enhancing Tumour (ET)",
}


def get_best_segmentation_slice(patient_id: int) -> str:
    """Return the best segmentation slice from the stored MCP result in the DB.

    Reads ``segmentation_result.best_slice`` written by the MCP during segmentation.
    No file I/O or image processing — pure DB read.

    Args:
        patient_id: The patient's database ID.

    Returns:
        JSON string with overlay_markdown, overlay_url, slice_index, tumour_voxels,
        coverage_pct, and tumour_classes_present.
    """
    try:
        from src.models import SessionLocal, Imaging

        with SessionLocal() as db:
            rec = (
                db.query(Imaging)
                .filter(
                    Imaging.patient_id == patient_id,
                    Imaging.segmentation_result.isnot(None),
                )
                .first()
            )

        if rec is None:
            return json.dumps({
                "status": "error",
                "error": (
                    f"No segmentation result found for patient {patient_id}. "
                    "Run segment_patient_image first."
                ),
            })

        seg = rec.segmentation_result
        if seg.get("status") != "success":
            return json.dumps({"status": "error", "error": "Segmentation result is not successful."})

        best_slice = seg.get("best_slice")
        if not best_slice:
            return json.dumps({
                "status": "error",
                "error": (
                    "No best_slice key in segmentation result. "
                    "Re-run segmentation to generate per-slice images."
                ),
            })

        overlay_url = best_slice.get("overlay_url", "")
        slice_index = best_slice.get("slice_index")
        classes = best_slice.get("tumour_classes_present", [])
        classes_str = ", ".join(_CLASS_LABELS.get(c, f"Class {c}") for c in classes)

        return json.dumps({
            "status": "success",
            "slice_index": slice_index,
            "tumour_voxels": best_slice.get("tumour_voxels"),
            "coverage_pct": best_slice.get("coverage_pct"),
            "tumour_classes_present": classes_str,
            "overlay_url": overlay_url,
            "overlay_markdown": f"![Best Segmentation Slice — z={slice_index}]({overlay_url})",
        })

    except Exception as exc:
        return json.dumps({"status": "error", "error": str(exc)})


_registry = ToolRegistry()
_registry.register(
    get_best_segmentation_slice,
    scope="global",
    symbol="get_best_segmentation_slice",
    allow_overwrite=True,
)
```

- [ ] **Step 4: Run tests — expect pass**

```bash
pytest tests/unit/test_mri_best_slice_tool.py -v
```

Expected: 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/tools/mri_best_slice_tool.py tests/unit/test_mri_best_slice_tool.py
git commit -m "feat(tools): rewrite get_best_segmentation_slice as pure DB read"
```

---

## Task 9: Update `docker-compose.yml`

**Files:**
- Modify: `docker-compose.yml`

- [ ] **Step 1: Remove volume mount and add Supabase env vars**

In `docker-compose.yml`, update the `segmentation-mcp` service:

```yaml
  segmentation-mcp:
    build:
      context: .
      dockerfile: segmentation-mcp/Dockerfile.mcp
    container_name: medical-agent-segmentation-mcp
    ports:
      - "8010:8000"
    env_file:
      - .env
    environment:
      - MCP_TRANSPORT=streamable-http
      - HOST=0.0.0.0
      - PORT=8000
    restart: unless-stopped
```

Changes:
- Remove `PUBLIC_UPLOAD_BASE_URL` environment variable (no local uploads)
- Remove `extra_hosts` block (`host.docker.internal:host-gateway`)
- Remove `volumes` block (`./uploads:/app/uploads`)
- The Supabase vars (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET`) are loaded via `env_file: - .env`

- [ ] **Step 2: Commit**

```bash
git add docker-compose.yml
git commit -m "feat(docker): remove uploads volume mount from segmentation-mcp"
```

---

## Task 10: Update frontend slice viewer

**Files:**
- Modify: `web/lib/api.ts`
- Modify: `web/components/doctor/imaging-analysis-dialog.tsx`

- [ ] **Step 1: Remove `imagingSliceUrl` and `imagingMaskUrl` from `web/lib/api.ts`**

In `web/lib/api.ts`, delete lines 146–161 (the `imagingSliceUrl` and `imagingMaskUrl` functions):

```typescript
// DELETE these two functions:
export function imagingSliceUrl(
  patientId: number,
  imagingId: number,
  z: number,
  overlay: boolean
): string {
  return `${API_BASE_URL}/patients/${patientId}/imaging/${imagingId}/slice?z=${z}&overlay=${overlay}`;
}

export function imagingMaskUrl(
  patientId: number,
  imagingId: number,
  z: number
): string {
  return `${API_BASE_URL}/patients/${patientId}/imaging/${imagingId}/mask?z=${z}`;
}
```

- [ ] **Step 2: Update `imaging-analysis-dialog.tsx` to use Supabase slice URLs**

At the top of the file, remove `imagingSliceUrl, imagingMaskUrl` from the import:

```typescript
// Before:
import { imagingSliceUrl, imagingMaskUrl, runSegmentationAsync } from "@/lib/api";

// After:
import { runSegmentationAsync } from "@/lib/api";
```

Replace the URL derivation block (lines ~181–190):

```typescript
// Before:
const baseSliceUrl = volumeDepth > 0
  ? imagingSliceUrl(patientId, selectedImaging.id, sliceZ, false)
  : (selectedImaging.aligned_preview_url ?? selectedImaging.preview_url);

const imageUrl = viewMode === "preview"
  ? baseSliceUrl
  : imagingMaskUrl(patientId, segmentedImaging?.id ?? selectedImaging.id, sliceZ);

const showBaseLayer = (viewMode === "mask" || viewMode === "overlay") && !!segmentedImaging;
```

With:

```typescript
// Supabase slice URL pattern — stored in segmentation_result.slice_url_pattern after MCP run.
const slicePattern = segResult?.slice_url_pattern ?? null;

// MRI base layer: Supabase pre-generated slice when available, else static preview fallback.
const baseSliceUrl = slicePattern
  ? slicePattern.mri.replace("{z}", String(sliceZ))
  : (selectedImaging.aligned_preview_url ?? selectedImaging.preview_url);

// Mask overlay: Supabase transparent PNG slice (only valid after segmentation).
const maskUrl = slicePattern
  ? slicePattern.mask.replace("{z}", String(sliceZ))
  : null;

const imageUrl = viewMode === "preview"
  ? baseSliceUrl
  : (maskUrl ?? baseSliceUrl);

const showBaseLayer = (viewMode === "mask" || viewMode === "overlay") && !!segmentedImaging && !!maskUrl;
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd web && npx tsc --noEmit 2>&1 | head -20
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add web/lib/api.ts web/components/doctor/imaging-analysis-dialog.tsx
git commit -m "feat(frontend): use Supabase slice URLs from segmentation_result.slice_url_pattern"
```

---

## Spec Coverage Self-Check

| Spec requirement | Covered by |
|-----------------|------------|
| `upload_storage.py` rewritten as Supabase client | Task 2 |
| `server.py` StaticFiles mount removed | Task 5 |
| `mri_best_slice_tool.py` pure DB read | Task 8 |
| Upload endpoint streams to Supabase | Task 3 |
| `/slice?z=` and `/mask?z=` endpoints removed | Task 3 |
| `segmentation_worker.py` local file ops removed | Task 4 |
| `_call_segmentation_mcp` passes `imaging_id` | Task 6 |
| MCP: `imaging_id` parameter + correct storage paths | Task 7 |
| MCP: per-slice MRI JPEGs + mask PNGs generated | Task 7 |
| MCP: best slice computed + uploaded | Task 7 |
| MCP: `slice_url_pattern` + `best_slice` in result | Task 7 |
| `docker-compose.yml` volume removed | Task 9 |
| Frontend uses Supabase URLs directly | Task 10 |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET` env vars | Task 1 |
