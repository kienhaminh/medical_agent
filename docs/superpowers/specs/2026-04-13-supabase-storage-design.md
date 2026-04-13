# Supabase Storage Integration — Design Spec

**Date:** 2026-04-13
**Status:** Approved
**Scope:** Replace local `uploads/` filesystem with Supabase Storage for all medical images. DB stays on local Docker Postgres (unchanged).

---

## Context

The medical_agent backend currently stores MRI images (NIfTI volumes, JPEG previews, segmentation masks) on the local filesystem under `uploads/`. Files are served via a FastAPI StaticFiles mount at `/uploads`. The segmentation MCP container mounts the same directory via Docker volume.

This design replaces the local filesystem with Supabase Storage, following a microservices principle: **the backend server never touches image bytes**. All binary processing (slice extraction, segmentation) happens inside the MCP. The backend handles only URLs and metadata.

---

## Supabase Project

- **Project:** `medical_agent`
- **Project ID:** `wdrbsbeowafbfpnourfm`
- **URL:** `https://wdrbsbeowafbfpnourfm.supabase.co`
- **Region:** ap-southeast-2 (Sydney)
- **Storage bucket:** `medical_images` (public, already exists)
- **pgvector:** Installed ✅
- **Schema:** All tables already migrated ✅

---

## Storage Bucket Layout

Bucket: `medical_images`

```
patients/{patient_id}/{filename}.nii.gz                      # Uploaded NIfTI volume
patients/{patient_id}/preview_{imaging_id}.jpg               # Static preview JPEG
patients/{patient_id}/slices/{imaging_id}/mri_z{n}.jpg       # Per-slice MRI grayscale JPEGs (MCP)
patients/{patient_id}/slices/{imaging_id}/mask_z{n}.png      # Per-slice mask transparent PNGs (MCP)
patients/{patient_id}/slices/{imaging_id}/best_slice.jpg     # Best segmentation slice overlay (MCP)
```

Public URL pattern:
```
https://wdrbsbeowafbfpnourfm.supabase.co/storage/v1/object/public/medical_images/{path}
```

---

## Architecture

### Principle: Backend is URL-only

The backend never reads or writes image bytes. It:
- Passes Supabase public URLs to the MCP
- Stores result URLs returned by the MCP in the DB
- Returns URLs to the frontend

All image processing (NIfTI parsing, nibabel, numpy, slice extraction) lives in the MCP.

### Upload Flow

```
Frontend → POST /patients/{id}/imaging (multipart)
         → Backend streams bytes directly to Supabase Storage
         → Stores Supabase URL in DB (imaging.file_url)
         → Calls MCP to generate preview slice
         → MCP downloads NIfTI from Supabase, extracts preview, uploads JPEG to Supabase
         → Backend stores preview URL in DB (imaging.preview_url)
```

### Segmentation Flow

```
Agent calls segment_patient_image(patient_id)
  → Backend fetches NIfTI Supabase URLs from DB
  → Passes URLs to segmentation MCP
  → MCP downloads NIfTI files from Supabase URLs
  → Runs segmentation, produces 3D mask
  → Generates all Z slices:
      - MRI grayscale JPEGs → uploads to Supabase (mri_z{n}.jpg)
      - Mask transparent PNGs → uploads to Supabase (mask_z{n}.png)
  → Computes best slice (max non-zero voxels)
  → Uploads best slice overlay JPEG → Supabase (best_slice.jpg)
  → Returns result JSON with slice_url_pattern + best_slice metadata
  → Backend stores result in imaging.segmentation_result JSONB
```

### Best Slice Flow

```
Agent calls get_best_segmentation_slice(patient_id)
  → Pure DB read: reads imaging.segmentation_result JSONB
  → Returns best_slice.overlay_url, slice_index, coverage_pct, tumour_classes_present
  → No image bytes, no file access
```

### Frontend Slice Viewer

```
Base layer:    {supabase_url}/storage/v1/object/public/medical_images/patients/{id}/slices/{imaging_id}/mri_z{z}.jpg
Mask overlay:  {supabase_url}/storage/v1/object/public/medical_images/patients/{id}/slices/{imaging_id}/mask_z{z}.png
```

Frontend constructs URLs directly from `slice_url_pattern` stored in `segmentation_result`. No backend slice proxy endpoints needed.

---

## Files Changed

### Backend

| File | Change |
|------|--------|
| `src/utils/upload_storage.py` | Rewritten as Supabase Storage client using `supabase-py`. Same public function signatures. |
| `src/api/server.py` | Remove `StaticFiles` mount for `/uploads` |
| `src/tools/mri_best_slice_tool.py` | Rewritten as pure DB read — no nibabel, no file I/O |
| `src/api/routers/patients/imaging.py` | Upload endpoint streams to Supabase; remove local NIfTI slice/mask endpoints |
| `docker-compose.yml` | Remove `./uploads:/app/uploads` volume from segmentation-mcp service |
| `.env.example` | Add `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET` |

### MCP

| File | Change |
|------|--------|
| `segmentation-mcp/` | Extended to: (1) generate all MRI + mask slices, (2) compute best slice, (3) upload all to Supabase, (4) return `slice_url_pattern` + `best_slice` in result |
| `segmentation-mcp/Dockerfile.mcp` | Add `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET` env vars |

### Frontend

| File | Change |
|------|--------|
| `web/components/doctor/imaging-analysis-dialog.tsx` | Use Supabase slice URLs from `segmentation_result.slice_url_pattern` instead of backend `/slice?z=` and `/mask?z=` endpoints |

---

## New Env Vars

```bash
# Backend (.env)
SUPABASE_URL=https://wdrbsbeowafbfpnourfm.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<from Supabase dashboard → Settings → API>
SUPABASE_STORAGE_BUCKET=medical_images

# Segmentation MCP (docker-compose.yml environment block)
SUPABASE_URL=https://wdrbsbeowafbfpnourfm.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<same key>
SUPABASE_STORAGE_BUCKET=medical_images
```

The service role key is used for all storage operations (upload, delete). The public bucket means reads require no auth — frontend fetches slice images directly from Supabase CDN URLs.

---

## Removed Code

- `upload_root()` — no local path concept
- `patient_imaging_dir()` returning a `Path` — replaced by rel-path string helper
- `local_path_from_public_url()` — no local paths
- `normalize_docker_urls()` — no docker internal URLs
- FastAPI `/uploads` StaticFiles mount
- Docker volume `./uploads:/app/uploads`
- Backend nibabel imports in `mri_best_slice_tool.py` and `imaging.py` slice extraction
- `/slice?z=` and `/mask?z=` endpoint handlers in `imaging.py`

---

## `upload_storage.py` New Interface

```python
# Upload bytes to Supabase Storage, returns public URL
def upload_bytes(rel_path: str, data: bytes, content_type: str) -> str: ...

# Get public URL for a stored object
def public_url_for_rel(rel_path: str) -> str: ...

# Build the rel path for a patient file
def patient_rel_path(patient_id: int, filename: str) -> str: ...

# Build the slice URL pattern dict for DB storage (only {z} is a template variable)
def slice_url_pattern(patient_id: int, imaging_id: int) -> dict: ...
# Returns: {"mri": "https://...mri_z{z}.jpg", "mask": "https://...mask_z{z}.png"}
```

---

## Segmentation Result Schema (updated)

```json
{
  "pred_mask_3d": "https://wdrbsbeowafbfpnourfm.supabase.co/storage/v1/object/public/medical_images/patients/125/pred_mask.nii.gz",
  "slice_url_pattern": {
    "mri": "https://wdrbsbeowafbfpnourfm.supabase.co/storage/v1/object/public/medical_images/patients/125/slices/456/mri_z{z}.jpg",
    "mask": "https://wdrbsbeowafbfpnourfm.supabase.co/storage/v1/object/public/medical_images/patients/125/slices/456/mask_z{z}.png"
  },
  "volume_depth": 155,
  "best_slice": {
    "overlay_url": "https://wdrbsbeowafbfpnourfm.supabase.co/storage/v1/object/public/medical_images/patients/125/slices/456/best_slice.jpg",
    "slice_index": 51,
    "coverage_pct": 4.2,
    "tumour_voxels": 2430,
    "tumour_classes_present": [1, 2, 4]
  }
}
```

---

## Out of Scope

- Supabase Auth (not replacing existing auth system)
- Supabase Postgres (DB stays on local Docker Postgres)
- RLS policies on storage (bucket is public; service role key used for writes)
- Image deletion / lifecycle management
