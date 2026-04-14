# Segmentation HTTP Service Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the FastMCP segmentation server with a plain FastAPI HTTP service exposing `POST /segment` and `GET /segment/{job_id}`, and update the main backend to call it.

**Architecture:** A new `segmentation-service/` directory holds `server.py` (HTTP layer, job store, endpoints) and `inference.py` (all ML logic extracted from `mcp_server.py`). The main backend's `segmentation_worker.py` replaces its MCP client with `requests` + `asyncio.to_thread()` polling. Models and checkpoints are reused from `segmentation-mcp/` — no duplication.

**Tech Stack:** Python 3.12, FastAPI, uvicorn, torch 2.7.0 (CPU), nibabel, Pillow, requests, supabase-py, pytest

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `segmentation-service/requirements.txt` | Python deps for the service |
| Create | `segmentation-service/inference.py` | All ML logic: download, preprocess, model, upload |
| Create | `segmentation-service/server.py` | FastAPI app, job store, two endpoints |
| Create | `segmentation-service/Dockerfile` | Python 3.12-slim container |
| Create | `segmentation-service/tests/__init__.py` | Makes tests a package |
| Create | `segmentation-service/tests/test_inference_helpers.py` | Unit tests for pure numpy helpers |
| Create | `segmentation-service/tests/test_server.py` | Endpoint tests |
| Modify | `docker-compose.yml` | Rename service, point to new Dockerfile |
| Modify | `src/api/routers/patients/segmentation_worker.py` | Replace MCP client with HTTP polling |
| Modify | `src/tools/medical_img_segmentation_tool.py` | Remove broken `_mcp_url()` call |

---

## Task 1: Create `segmentation-service/requirements.txt`

**Files:**
- Create: `segmentation-service/requirements.txt`
- Create: `segmentation-service/tests/__init__.py`

- [ ] **Step 1: Create requirements file**

```
fastapi
uvicorn[standard]
numpy
nibabel
pillow
requests
einops
supabase
pytest
httpx
```

Save to `segmentation-service/requirements.txt`.

- [ ] **Step 2: Create empty tests package**

Create `segmentation-service/tests/__init__.py` as an empty file.

- [ ] **Step 3: Commit**

```bash
git add segmentation-service/requirements.txt segmentation-service/tests/__init__.py
git commit -m "chore: scaffold segmentation-service directory"
```

---

## Task 2: Implement `inference.py` with tests (TDD)

**Files:**
- Create: `segmentation-service/tests/test_inference_helpers.py`
- Create: `segmentation-service/inference.py`

- [ ] **Step 1: Write failing tests for pure numpy helpers**

Create `segmentation-service/tests/test_inference_helpers.py`:

```python
"""Unit tests for pure numpy helper functions in inference.py."""
import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))
from inference import _standardize_nonzeros, _normalize_slice_u8, _crop_start_from_nonzero


def test_standardize_nonzeros_zero_array():
    arr = np.zeros((4, 4, 4), dtype=np.float32)
    result = _standardize_nonzeros(arr)
    assert result.shape == arr.shape
    assert result.dtype == np.float32
    np.testing.assert_array_equal(result, arr)


def test_standardize_nonzeros_normalizes_nonzero_voxels():
    arr = np.array([0.0, 0.0, 2.0, 4.0, 6.0], dtype=np.float32)
    result = _standardize_nonzeros(arr)
    nz = result[result != 0]
    assert abs(float(nz.mean())) < 1e-5
    assert abs(float(nz.std()) - 1.0) < 0.1


def test_normalize_slice_u8_zero_slice():
    arr = np.zeros((10, 10), dtype=np.float32)
    result = _normalize_slice_u8(arr)
    assert result.dtype == np.uint8
    assert result.shape == (10, 10)
    np.testing.assert_array_equal(result, np.zeros((10, 10), dtype=np.uint8))


def test_normalize_slice_u8_maps_to_0_255():
    arr = np.array([[0.0, 0.0], [50.0, 100.0]], dtype=np.float32)
    result = _normalize_slice_u8(arr)
    assert result.dtype == np.uint8
    assert result.min() >= 0
    assert result.max() <= 255


def test_crop_start_from_nonzero_empty_mask():
    mask = np.zeros((100, 100, 100), dtype=np.uint8)
    z0, y0, x0 = _crop_start_from_nonzero(mask, (64, 64, 64))
    # Falls back to centred crop
    assert z0 == (100 - 64) // 2
    assert y0 == (100 - 64) // 2
    assert x0 == (100 - 64) // 2


def test_crop_start_from_nonzero_centred_on_nonzero():
    mask = np.zeros((100, 100, 100), dtype=np.uint8)
    mask[50, 50, 50] = 1  # single nonzero voxel at centre
    z0, y0, x0 = _crop_start_from_nonzero(mask, (64, 64, 64))
    # Crop centroid should be close to (50,50,50)
    assert z0 <= 50 <= z0 + 64
    assert y0 <= 50 <= y0 + 64
    assert x0 <= 50 <= x0 + 64
```

- [ ] **Step 2: Run tests — expect ImportError (inference.py doesn't exist yet)**

```bash
cd segmentation-service && python -m pytest tests/test_inference_helpers.py -v
```

Expected: `ModuleNotFoundError: No module named 'inference'`

- [ ] **Step 3: Create `segmentation-service/inference.py`**

```python
"""BraTS MRI segmentation inference logic."""
import json
import os
import tempfile
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import nibabel as nib
import numpy as np
import requests
import torch
from PIL import Image
from supabase import create_client

_MODALITY_ORDER = ["flair", "t1", "t1ce", "t2"]
_SUPABASE_URL = os.getenv("SUPABASE_URL", "")
_SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
_SUPABASE_BUCKET = os.getenv("SUPABASE_STORAGE_BUCKET", "medical_images")

_CONTENT_TYPES = {
    ".jpg": "image/jpeg",
    ".png": "image/png",
    ".gz": "application/gzip",
    ".json": "application/json",
}


@dataclass
class SegmentParams:
    patient_id: str
    flair_url: str | None
    t1_url: str | None
    t1ce_url: str | None
    t2_url: str | None
    slice_index: int
    fold: int
    alpha: float


def _supabase_client():
    if not _SUPABASE_URL or not _SUPABASE_KEY:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars must be set")
    return create_client(_SUPABASE_URL, _SUPABASE_KEY)


def _upload_to_supabase(client, local_path: Path, storage_path: str) -> str:
    content_type = _CONTENT_TYPES.get(local_path.suffix, "application/octet-stream")
    with open(local_path, "rb") as f:
        data = f.read()
    client.storage.from_(_SUPABASE_BUCKET).upload(
        storage_path, data, {"content-type": content_type, "upsert": True}
    )
    return client.storage.from_(_SUPABASE_BUCKET).get_public_url(storage_path)


def _load_nifti_zyx(path: Path) -> np.ndarray:
    img = nib.load(str(path))
    return np.asarray(img.get_fdata(dtype=np.float32)).transpose(2, 1, 0)


def _standardize_nonzeros(image: np.ndarray) -> np.ndarray:
    nz = image[image != 0]
    if nz.size == 0:
        return image.astype(np.float32, copy=False)
    return (image - nz.mean()) / (nz.std() + 1e-8)


def _normalize_slice_u8(slice_yx: np.ndarray, p_low: float = 1.0, p_high: float = 99.0) -> np.ndarray:
    arr = slice_yx.astype(np.float32, copy=False)
    nz = arr[arr != 0]
    if nz.size == 0:
        return np.zeros(arr.shape, dtype=np.uint8)
    lo = float(np.percentile(nz, p_low))
    hi = float(np.percentile(nz, p_high))
    if hi - lo < 1e-8:
        lo, hi = float(nz.min()), float(nz.max())
    if hi - lo < 1e-8:
        return np.zeros(arr.shape, dtype=np.uint8)
    return (np.clip((arr - lo) / (hi - lo), 0.0, 1.0) * 255.0).astype(np.uint8)


def _crop_start_from_nonzero(
    mask_zyx: np.ndarray, target_size: tuple[int, int, int]
) -> tuple[int, int, int]:
    d, h, w = mask_zyx.shape
    dz, dy, dx = target_size
    idx = np.where(mask_zyx != 0)
    if idx[0].size == 0:
        return (d - dz) // 2, (h - dy) // 2, (w - dx) // 2
    z_c = (idx[0].min() + idx[0].max()) // 2
    y_c = (idx[1].min() + idx[1].max()) // 2
    x_c = (idx[2].min() + idx[2].max()) // 2
    z0 = int(np.clip(z_c - dz // 2, 0, d - dz))
    y0 = int(np.clip(y_c - dy // 2, 0, h - dy))
    x0 = int(np.clip(x_c - dx // 2, 0, w - dx))
    return z0, y0, x0


def _download_file(url: str, out_path: Path) -> None:
    resp = requests.get(url, timeout=120)
    resp.raise_for_status()
    out_path.write_bytes(resp.content)


def _load_attco_model(checkpoint_path: Path, device: torch.device):
    from models.AttCo_BraTS import AttCo

    ckpt = torch.load(str(checkpoint_path), map_location="cpu", weights_only=False)
    state = ckpt.state_dict() if hasattr(ckpt, "state_dict") else ckpt
    model = AttCo(inChannel=2, outChannel=4, baseChannel=16)
    model.load_state_dict(state, strict=True)
    model.to(device)
    model.train(False)
    return model


def segment_brats(params: SegmentParams) -> dict[str, Any]:
    """Run BraTS segmentation and upload artifacts to Supabase. Returns result dict."""
    url_map = {
        "flair": params.flair_url,
        "t1": params.t1_url,
        "t1ce": params.t1ce_url,
        "t2": params.t2_url,
    }
    provided = {mod: url for mod, url in url_map.items() if url}

    supabase = _supabase_client()
    ckpt_dir = Path(__file__).parent / "checkpoint" / "BraTS2020" / "JointFusionNet3D_v11"
    ckpt_candidates = sorted(ckpt_dir.glob(f"Fold_{params.fold}_bs_4_*.pt"))
    if not ckpt_candidates:
        raise FileNotFoundError(f"No checkpoint for fold={params.fold} under {ckpt_dir}")
    checkpoint_path = ckpt_candidates[0]

    artifact_id = uuid.uuid4().hex[:12]
    slices_prefix = f"patients/{params.patient_id}/slices/{artifact_id}"

    with tempfile.TemporaryDirectory(prefix="brats-") as td:
        td_path = Path(td)

        # Download provided modalities
        modality_vols: dict[str, np.ndarray] = {}
        for mod, url in provided.items():
            local = td_path / f"{mod}.nii.gz"
            _download_file(url, local)
            modality_vols[mod] = _load_nifti_zyx(local)

        ref_shape = next(iter(modality_vols.values())).shape
        if any(v.shape != ref_shape for v in modality_vols.values()):
            raise ValueError("Shape mismatch among modalities")
        depth, height, width = ref_shape

        slice_z = depth // 2 if params.slice_index < 0 else params.slice_index
        if not (0 <= slice_z < depth):
            raise ValueError(f"slice_index {slice_z} out of range for depth={depth}")

        # Build 4-channel input; zero-fill missing modalities
        zero = np.zeros(ref_shape, dtype=np.float32)
        channels = [
            _standardize_nonzeros(modality_vols[mod]).astype(np.float32)
            if mod in modality_vols
            else zero
            for mod in _MODALITY_ORDER
        ]
        img_zyxc = np.stack(channels, axis=-1)

        anchor_mod = next(mod for mod in _MODALITY_ORDER if mod in modality_vols)
        anchor_vol = channels[_MODALITY_ORDER.index(anchor_mod)]

        # Crop and run model
        target_size = (128, 128, 128)
        z0, y0, x0 = _crop_start_from_nonzero(anchor_vol, target_size)
        dz, dy, dx = target_size
        crop_czyx = np.transpose(
            img_zyxc[z0 : z0 + dz, y0 : y0 + dy, x0 : x0 + dx, :], axes=[3, 0, 1, 2]
        )
        x_tensor = torch.tensor(crop_czyx, dtype=torch.float32).unsqueeze(0)
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        x_tensor = x_tensor.to(device)
        model = _load_attco_model(checkpoint_path, device)
        with torch.no_grad():
            pred = torch.argmax(model(x_tensor), dim=1)[0].cpu().numpy().astype(np.uint8)

        full_pred = np.zeros((depth, height, width), dtype=np.uint8)
        full_pred[z0 : z0 + dz, y0 : y0 + dy, x0 : x0 + dx] = pred
        label_slice = full_pred[slice_z]

        color_map = {
            1: np.array([255.0, 0.0, 0.0], dtype=np.float32),
            2: np.array([0.0, 255.0, 0.0], dtype=np.float32),
            3: np.array([0.0, 0.0, 255.0], dtype=np.float32),
        }

        # Upload per-slice MRI and mask images
        for z in range(depth):
            mri_u8 = _normalize_slice_u8(anchor_vol[z])
            mri_rgb = np.stack([mri_u8, mri_u8, mri_u8], axis=-1)
            mri_path = td_path / f"mri_z{z}.jpg"
            Image.fromarray(mri_rgb, mode="RGB").resize((512, 512), Image.LANCZOS).save(
                str(mri_path), "JPEG", quality=85
            )
            _upload_to_supabase(supabase, mri_path, f"{slices_prefix}/mri_z{z}.jpg")

            label_z = full_pred[z]
            mask_rgba_z = np.zeros((*label_z.shape, 4), dtype=np.uint8)
            for cls, color in color_map.items():
                m = label_z == cls
                if np.any(m):
                    mask_rgba_z[m, :3] = color.astype(np.uint8)
                    mask_rgba_z[m, 3] = 255
            mask_path = td_path / f"mask_z{z}.png"
            Image.fromarray(mask_rgba_z, mode="RGBA").resize((512, 512), Image.NEAREST).save(
                str(mask_path)
            )
            _upload_to_supabase(supabase, mask_path, f"{slices_prefix}/mask_z{z}.png")

        # Best slice
        slice_voxels = np.count_nonzero(full_pred, axis=(1, 2))
        best_z = int(np.argmax(slice_voxels))
        best_voxel_count = int(slice_voxels[best_z])
        coverage_pct = round(float(best_voxel_count) / (height * width) * 100, 2)
        best_classes = [int(c) for c in np.unique(full_pred[best_z]) if c != 0]

        best_base_u8 = _normalize_slice_u8(anchor_vol[best_z])
        best_overlay = np.stack([best_base_u8, best_base_u8, best_base_u8], axis=-1).astype(np.float32)
        for cls, color in color_map.items():
            m = full_pred[best_z] == cls
            if np.any(m):
                best_overlay[m] = (1.0 - params.alpha) * best_overlay[m] + params.alpha * color
        best_slice_path = td_path / "best_slice.jpg"
        Image.fromarray(best_overlay.clip(0, 255).astype(np.uint8), mode="RGB").resize(
            (512, 512), Image.LANCZOS
        ).save(str(best_slice_path), "JPEG", quality=90)
        best_slice_url = _upload_to_supabase(
            supabase, best_slice_path, f"{slices_prefix}/best_slice.jpg"
        )

        # Selected-slice overlay and predmask
        base_u8 = _normalize_slice_u8(anchor_vol[slice_z])
        overlay_arr = np.stack([base_u8, base_u8, base_u8], axis=-1).astype(np.float32)
        for cls, color in color_map.items():
            m = label_slice == cls
            if np.any(m):
                overlay_arr[m] = (1.0 - params.alpha) * overlay_arr[m] + params.alpha * color

        modalities_used = list(provided.keys())
        prefix = f"BraTS20_{params.patient_id}_{'_'.join(modalities_used)}_z{slice_z}"
        patient_prefix = f"patients/{params.patient_id}"

        predmask_path = td_path / f"{prefix}_predmask.png"
        overlay_path = td_path / f"{prefix}_overlay.jpg"
        pred_nii_path = td_path / f"{prefix}_predmask3d.nii.gz"
        json_path = td_path / f"{prefix}_output.json"

        mask_rgba = np.zeros((*label_slice.shape, 4), dtype=np.uint8)
        for cls, color in color_map.items():
            m = label_slice == cls
            if np.any(m):
                mask_rgba[m, :3] = color.astype(np.uint8)
                mask_rgba[m, 3] = 255
        Image.fromarray(mask_rgba, mode="RGBA").save(str(predmask_path))
        Image.fromarray(overlay_arr.clip(0, 255).astype(np.uint8)).save(str(overlay_path))
        nib.save(nib.Nifti1Image(full_pred, affine=np.eye(4)), str(pred_nii_path))

        overlay_url = _upload_to_supabase(
            supabase, overlay_path, f"{patient_prefix}/{prefix}_overlay.jpg"
        )
        predmask_url = _upload_to_supabase(
            supabase, predmask_path, f"{patient_prefix}/{prefix}_predmask.png"
        )
        pred_nii_url = _upload_to_supabase(
            supabase, pred_nii_path, f"{patient_prefix}/{prefix}_predmask3d.nii.gz"
        )

        result: dict[str, Any] = {
            "patient_id": params.patient_id,
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
                "crop": {"start_zyx": [z0, y0, x0], "size_dhw": [dz, dy, dx]},
            },
            "prediction": {
                "full_pred_shape_zyx": [depth, height, width],
                "slice_pred_shape_yx": [height, width],
                "pred_classes_in_slice": [int(v) for v in np.unique(label_slice)],
            },
            "slice_url_pattern": {
                "mri": (
                    f"{_SUPABASE_URL.rstrip('/')}/storage/v1/object/public"
                    f"/{_SUPABASE_BUCKET}/{slices_prefix}/mri_z{{z}}.jpg"
                ),
                "mask": (
                    f"{_SUPABASE_URL.rstrip('/')}/storage/v1/object/public"
                    f"/{_SUPABASE_BUCKET}/{slices_prefix}/mask_z{{z}}.png"
                ),
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

        json_path.write_text(json.dumps(result, indent=2), encoding="utf-8")
        json_url = _upload_to_supabase(
            supabase, json_path, f"{patient_prefix}/{prefix}_output.json"
        )
        result["artifacts"]["json_summary"] = {"url": json_url, "format": "json"}

    return result
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd segmentation-service && python -m pytest tests/test_inference_helpers.py -v
```

Expected output (all 6 tests pass):
```
PASSED tests/test_inference_helpers.py::test_standardize_nonzeros_zero_array
PASSED tests/test_inference_helpers.py::test_standardize_nonzeros_normalizes_nonzero_voxels
PASSED tests/test_inference_helpers.py::test_normalize_slice_u8_zero_slice
PASSED tests/test_inference_helpers.py::test_normalize_slice_u8_maps_to_0_255
PASSED tests/test_inference_helpers.py::test_crop_start_from_nonzero_empty_mask
PASSED tests/test_inference_helpers.py::test_crop_start_from_nonzero_centred_on_nonzero
```

- [ ] **Step 5: Commit**

```bash
git add segmentation-service/inference.py segmentation-service/tests/test_inference_helpers.py
git commit -m "feat: add segmentation inference module with helper tests"
```

---

## Task 3: Implement `server.py` with endpoint tests (TDD)

**Files:**
- Create: `segmentation-service/tests/test_server.py`
- Create: `segmentation-service/server.py`

- [ ] **Step 1: Write failing endpoint tests**

Create `segmentation-service/tests/test_server.py`:

```python
"""Endpoint tests for the segmentation HTTP service."""
import sys
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).parent.parent))

# All deps (fastapi, torch, numpy, etc.) are installed via requirements.txt.
# Import server normally; heavy inference is mocked inside individual tests.
import server
from server import app, _jobs, JobState, _run_inference
from fastapi.testclient import TestClient

client = TestClient(app)


def setup_function():
    _jobs.clear()


def test_submit_missing_all_modalities_returns_422():
    resp = client.post("/segment", json={"patient_id": "1"})
    assert resp.status_code == 422


def test_submit_valid_single_modality_returns_202():
    with patch("server.asyncio.create_task"):
        resp = client.post("/segment", json={
            "patient_id": "42",
            "flair_url": "http://example.com/flair.nii.gz",
        })
    assert resp.status_code == 202
    body = resp.json()
    assert "job_id" in body
    assert body["status"] == "queued"


def test_submit_creates_job_in_store():
    with patch("server.asyncio.create_task"):
        resp = client.post("/segment", json={
            "patient_id": "42",
            "t1_url": "http://example.com/t1.nii.gz",
        })
    job_id = resp.json()["job_id"]
    assert job_id in _jobs
    assert _jobs[job_id].status == "queued"


def test_get_status_unknown_job_returns_404():
    resp = client.get("/segment/nonexistent-job-id")
    assert resp.status_code == 404


def test_get_status_returns_queued_for_new_job():
    with patch("server.asyncio.create_task"):
        submit = client.post("/segment", json={
            "patient_id": "99",
            "t2_url": "http://example.com/t2.nii.gz",
        })
    job_id = submit.json()["job_id"]
    resp = client.get(f"/segment/{job_id}")
    assert resp.status_code == 200
    body = resp.json()
    assert body["job_id"] == job_id
    assert body["status"] == "queued"
    assert body["result"] is None
    assert body["error"] is None


def test_run_inference_sets_complete_on_success():
    job_id = "test-complete-123"
    _jobs[job_id] = JobState()
    fake_params = object()

    with patch("server.segment_brats", return_value={"status": "success"}) as mock_seg:
        _run_inference(job_id, fake_params)
        mock_seg.assert_called_once_with(fake_params)

    assert _jobs[job_id].status == "complete"
    assert _jobs[job_id].result == {"status": "success"}
    assert _jobs[job_id].error is None


def test_run_inference_sets_error_on_exception():
    job_id = "test-error-456"
    _jobs[job_id] = JobState()
    fake_params = object()

    with patch("server.segment_brats", side_effect=RuntimeError("model failed")):
        _run_inference(job_id, fake_params)

    assert _jobs[job_id].status == "error"
    assert "model failed" in _jobs[job_id].error
    assert _jobs[job_id].result is None
```

- [ ] **Step 2: Run tests — expect ImportError**

```bash
cd segmentation-service && python -m pytest tests/test_server.py -v
```

Expected: `ModuleNotFoundError: No module named 'server'`

- [ ] **Step 3: Create `segmentation-service/server.py`**

```python
"""BraTS segmentation HTTP service — FastAPI entry point."""
import asyncio
import logging
import uuid
from dataclasses import dataclass, field

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, model_validator

from inference import SegmentParams, segment_brats

logger = logging.getLogger(__name__)
app = FastAPI(title="BraTS Segmentation Service")


@dataclass
class JobState:
    status: str = "queued"
    result: dict | None = None
    error: str | None = None


_jobs: dict[str, JobState] = {}


class SegmentRequest(BaseModel):
    patient_id: str
    flair_url: str | None = None
    t1_url: str | None = None
    t1ce_url: str | None = None
    t2_url: str | None = None
    slice_index: int = -1
    fold: int = 3
    alpha: float = 0.45

    @model_validator(mode="after")
    def require_at_least_one_modality(self) -> "SegmentRequest":
        if not any([self.flair_url, self.t1_url, self.t1ce_url, self.t2_url]):
            raise ValueError("At least one modality URL must be provided")
        return self


@app.post("/segment", status_code=202)
async def submit_segment(body: SegmentRequest):
    job_id = str(uuid.uuid4())
    _jobs[job_id] = JobState()
    params = SegmentParams(
        patient_id=body.patient_id,
        flair_url=body.flair_url,
        t1_url=body.t1_url,
        t1ce_url=body.t1ce_url,
        t2_url=body.t2_url,
        slice_index=body.slice_index,
        fold=body.fold,
        alpha=body.alpha,
    )
    asyncio.create_task(asyncio.to_thread(_run_inference, job_id, params))
    return {"job_id": job_id, "status": "queued"}


@app.get("/segment/{job_id}")
async def get_segment_status(job_id: str):
    job = _jobs.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return {
        "job_id": job_id,
        "status": job.status,
        "result": job.result,
        "error": job.error,
    }


def _run_inference(job_id: str, params: SegmentParams) -> None:
    """Synchronous wrapper executed in a thread pool via asyncio.to_thread."""
    job = _jobs[job_id]
    try:
        job.status = "running"
        job.result = segment_brats(params)
        job.status = "complete"
    except Exception as exc:
        logger.exception("Inference failed for job %s", job_id)
        job.error = str(exc)
        job.status = "error"
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd segmentation-service && python -m pytest tests/test_server.py -v
```

Expected (all 7 tests pass):
```
PASSED tests/test_server.py::test_submit_missing_all_modalities_returns_422
PASSED tests/test_server.py::test_submit_valid_single_modality_returns_202
PASSED tests/test_server.py::test_submit_creates_job_in_store
PASSED tests/test_server.py::test_get_status_unknown_job_returns_404
PASSED tests/test_server.py::test_get_status_returns_queued_for_new_job
PASSED tests/test_server.py::test_run_inference_sets_complete_on_success
PASSED tests/test_server.py::test_run_inference_sets_error_on_exception
```

- [ ] **Step 5: Commit**

```bash
git add segmentation-service/server.py segmentation-service/tests/test_server.py
git commit -m "feat: add segmentation FastAPI server with endpoint tests"
```

---

## Task 4: Create `segmentation-service/Dockerfile`

**Files:**
- Create: `segmentation-service/Dockerfile`

- [ ] **Step 1: Write Dockerfile**

Create `segmentation-service/Dockerfile`:

```dockerfile
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# CPU-only PyTorch — separate layer for cache efficiency (~600 MB vs ~2 GB for CUDA)
RUN pip install --no-cache-dir torch==2.7.0 --index-url https://download.pytorch.org/whl/cpu

COPY segmentation-service/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Application code
COPY segmentation-service/server.py .
COPY segmentation-service/inference.py .

# Reuse models and checkpoints from segmentation-mcp — no duplication
COPY segmentation-mcp/models/ models/
COPY segmentation-mcp/checkpoint/BraTS2020 checkpoint/BraTS2020

# Supabase Storage — must be supplied at runtime
ENV SUPABASE_URL=
ENV SUPABASE_SERVICE_ROLE_KEY=
ENV SUPABASE_STORAGE_BUCKET=medical_images

EXPOSE 8000

# Single worker — job store is in-memory; multiple workers would have separate stores
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
```

- [ ] **Step 2: Build the image to verify it compiles correctly**

```bash
docker build -f segmentation-service/Dockerfile . -t segmentation-service:local
```

Expected: `Successfully built ...` with no errors. The PyTorch layer will take a few minutes on first build.

- [ ] **Step 3: Commit**

```bash
git add segmentation-service/Dockerfile
git commit -m "feat: add Dockerfile for segmentation HTTP service (Python 3.12)"
```

---

## Task 5: Update `docker-compose.yml`

**Files:**
- Modify: `docker-compose.yml`

- [ ] **Step 1: Replace the `segmentation-mcp` service block**

In `docker-compose.yml`, replace:

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

With:

```yaml
  segmentation:
    build:
      context: .
      dockerfile: segmentation-service/Dockerfile
    container_name: medical-agent-segmentation
    ports:
      - "8010:8000"
    env_file:
      - .env
    restart: unless-stopped
```

- [ ] **Step 2: Verify compose config parses correctly**

```bash
docker compose config --quiet
```

Expected: no output (no errors).

- [ ] **Step 3: Commit**

```bash
git add docker-compose.yml
git commit -m "chore: replace segmentation-mcp service with segmentation HTTP service"
```

---

## Task 6: Update `segmentation_worker.py`

**Files:**
- Modify: `src/api/routers/patients/segmentation_worker.py`

- [ ] **Step 1: Remove MCP imports and add `requests`**

At the top of `src/api/routers/patients/segmentation_worker.py`, remove lines 18–19:

```python
from mcp import ClientSession
from mcp.client.streamable_http import streamablehttp_client
```

Add in their place:

```python
import requests
```

- [ ] **Step 2: Replace the MCP call block (lines 82–112) with HTTP polling**

Find and replace the entire Step 2 block. The old block starts at `# ── Step 2: Run MCP (outside DB session)` and ends before `# ── Step 3: Persist result`. Replace it with:

```python
        # ── Step 2: Run segmentation service (outside DB session) ──────────
        seg_url = os.getenv("SEGMENTATION_URL", "http://localhost:8010")
        request_body: dict = {
            "patient_id": str(patient_id),
            "slice_index": slice_idx,
            "fold": 3,
            "alpha": 0.45,
        }
        for mod, param in _MODALITY_PARAM.items():
            if mod in modality_urls:
                request_body[param] = modality_urls[mod]

        # Submit job — returns immediately with a job_id
        submit_resp = await asyncio.to_thread(
            lambda: requests.post(f"{seg_url}/segment", json=request_body, timeout=30)
        )
        submit_resp.raise_for_status()
        job_id = submit_resp.json()["job_id"]

        # Poll until complete (10 s interval, 10 min max)
        segmentation_payload: dict = {}
        for _ in range(60):
            await asyncio.sleep(10)
            poll_resp = await asyncio.to_thread(
                lambda: requests.get(f"{seg_url}/segment/{job_id}", timeout=30)
            )
            poll_resp.raise_for_status()
            data = poll_resp.json()
            if data["status"] == "complete":
                segmentation_payload = data["result"]
                break
            if data["status"] == "error":
                raise RuntimeError(f"Segmentation service error: {data['error']}")
        else:
            raise TimeoutError(f"Segmentation job {job_id} timed out after 10 minutes")

```

- [ ] **Step 3: Verify the file is valid Python**

```bash
python -c "import ast; ast.parse(open('src/api/routers/patients/segmentation_worker.py').read()); print('OK')"
```

Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add src/api/routers/patients/segmentation_worker.py
git commit -m "feat: replace MCP client in segmentation_worker with HTTP polling"
```

---

## Task 7: Fix `medical_img_segmentation_tool.py`

**Files:**
- Modify: `src/tools/medical_img_segmentation_tool.py`

- [ ] **Step 1: Remove the broken `_mcp_url()` call**

In `src/tools/medical_img_segmentation_tool.py`, find the `except Exception` block near line 121. Replace:

```python
        return json.dumps(
            {
                "status": "error",
                "error": str(exc),
                "mcp_url": _mcp_url(),
            },
            ensure_ascii=True,
        )
```

With:

```python
        return json.dumps(
            {"status": "error", "error": str(exc)},
            ensure_ascii=True,
        )
```

- [ ] **Step 2: Verify the file is valid Python**

```bash
python -c "import ast; ast.parse(open('src/tools/medical_img_segmentation_tool.py').read()); print('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add src/tools/medical_img_segmentation_tool.py
git commit -m "fix: remove broken _mcp_url() call from segmentation tool error handler"
```

---

## Task 8: Smoke-test the running service

**Goal:** Verify the container starts, the endpoints respond, and the compose config is correct.

- [ ] **Step 1: Start the segmentation service**

```bash
docker compose up segmentation --build -d
```

- [ ] **Step 2: Wait ~10 seconds, then check the service is healthy**

```bash
docker compose ps segmentation
```

Expected: `State: running`

- [ ] **Step 3: Hit the health endpoint (FastAPI auto-generates docs)**

```bash
curl -s http://localhost:8010/docs | grep -o "BraTS Segmentation Service"
```

Expected: `BraTS Segmentation Service`

- [ ] **Step 4: Verify POST /segment returns 422 for missing modalities**

```bash
curl -s -X POST http://localhost:8010/segment \
  -H "Content-Type: application/json" \
  -d '{"patient_id": "test"}' | python -m json.tool
```

Expected: `422 Unprocessable Entity` response with validation error detail.

- [ ] **Step 5: Verify POST /segment returns 202 for valid input**

```bash
curl -s -X POST http://localhost:8010/segment \
  -H "Content-Type: application/json" \
  -d '{"patient_id": "test", "flair_url": "http://example.com/fake.nii.gz"}' | python -m json.tool
```

Expected: `{"job_id": "<uuid>", "status": "queued"}`

- [ ] **Step 6: Verify GET /segment/{job_id} returns status**

Replace `<JOB_ID>` with the value from the previous step:

```bash
curl -s http://localhost:8010/segment/<JOB_ID> | python -m json.tool
```

Expected: `{"job_id": "...", "status": "queued"|"running"|"error", "result": null, "error": ...}`

Note: the job will error because `http://example.com/fake.nii.gz` is not a real NIfTI file — that's expected. The point is to verify the polling endpoint works.

- [ ] **Step 7: Stop the service**

```bash
docker compose stop segmentation
```

- [ ] **Step 8: Commit final smoke-test confirmation**

No code changes — just confirm everything passed, then note it in git:

```bash
git commit --allow-empty -m "chore: smoke-test segmentation HTTP service — endpoints verified"
```

---

## Environment Variable Checklist

After completing all tasks, update your `.env` file:

```
# Remove:
SEGMENTATION_MCP_URL=http://localhost:8010/mcp

# Add:
SEGMENTATION_URL=http://localhost:8010
```

In production/CI environments, update the corresponding secrets/env configs.
