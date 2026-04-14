"""Generate per-z MRI slice JPEGs from NIfTI volumes stored in Supabase.

For every imaging record in the database, this script:
  1. Downloads the NIfTI (.nii.gz) volume from Supabase Storage
  2. Extracts every axial z-slice as a grayscale JPEG (same normalisation as the segmentation MCP)
  3. Uploads each slice to:
       medical_images/patients/{patient_id}/slices/{imaging_id}/mri_z{z}.jpg

Run:
    python -m scripts.db.seed.generate_mri_slices

Options (env vars):
    SUPABASE_URL               — required
    SUPABASE_SERVICE_ROLE_KEY  — required
    SUPABASE_STORAGE_BUCKET    — default: medical_images
    IMAGING_IDS                — comma-separated imaging IDs to process (default: all)
"""
import asyncio
import io
import logging
import os
import sys
import tempfile
from pathlib import Path

import numpy as np
import requests
from PIL import Image
from supabase import create_client

logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
logger = logging.getLogger(__name__)

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
BUCKET = os.environ.get("SUPABASE_STORAGE_BUCKET", "medical_images")
IMAGING_IDS_ENV = os.environ.get("IMAGING_IDS", "")  # e.g. "1,2,5"

SLICE_JPEG_QUALITY = 85
SLICE_OUTPUT_SIZE = 240  # matches segmentation MCP output


def _supabase_client():
    return create_client(SUPABASE_URL, SUPABASE_KEY)


def _normalize_slice_u8(slice_yx: np.ndarray, p_low: float = 1.0, p_high: float = 99.0) -> np.ndarray:
    """Normalise a 2-D slice to uint8 — identical to segmentation MCP."""
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
    scaled = np.clip((arr - lo) / (hi - lo), 0.0, 1.0)
    return (scaled * 255.0).astype(np.uint8)


def _download_nifti(url: str, dest: Path) -> bool:
    logger.info("  Downloading %s", url)
    try:
        resp = requests.get(url, timeout=180)
        resp.raise_for_status()
        dest.write_bytes(resp.content)
        return True
    except Exception as exc:
        logger.warning("  Download failed: %s", exc)
        return False


def _generate_slices(nii_path: Path) -> list[bytes]:
    """Return a list of JPEG bytes, one per z-slice (index 0 → depth-1)."""
    import nibabel as nib  # noqa: PLC0415

    img = nib.load(str(nii_path))
    data = np.asarray(img.dataobj, dtype=np.float32)  # (x, y, z)
    depth = data.shape[2]
    slices: list[bytes] = []
    for z in range(depth):
        slice_yx = data[:, :, z].T  # match MCP orientation
        u8 = _normalize_slice_u8(slice_yx)
        pil = Image.fromarray(u8, mode="L").resize(
            (SLICE_OUTPUT_SIZE, SLICE_OUTPUT_SIZE), Image.LANCZOS
        )
        buf = io.BytesIO()
        pil.convert("RGB").save(buf, "JPEG", quality=SLICE_JPEG_QUALITY)
        slices.append(buf.getvalue())
    return slices


def _upload_slice(client, storage_path: str, jpeg_bytes: bytes) -> None:
    client.storage.from_(BUCKET).upload(
        storage_path,
        jpeg_bytes,
        {"content-type": "image/jpeg", "upsert": "true"},
    )


def _process_imaging(client, patient_id: int, imaging_id: int, original_url: str, tmp: Path) -> bool:
    nii_path = tmp / f"p{patient_id}_img{imaging_id}.nii.gz"
    if not _download_nifti(original_url, nii_path):
        return False

    try:
        slices = _generate_slices(nii_path)
    except Exception as exc:
        logger.error("  Slice extraction failed: %s", exc)
        return False
    finally:
        nii_path.unlink(missing_ok=True)

    prefix = f"patients/{patient_id}/slices/{imaging_id}"
    logger.info("  Uploading %d slices → %s/mri_z*.jpg", len(slices), prefix)
    for z, jpeg_bytes in enumerate(slices):
        _upload_slice(client, f"{prefix}/mri_z{z}.jpg", jpeg_bytes)

    logger.info("  Done — %d slices uploaded", len(slices))
    return True


async def _fetch_imaging_records(filter_ids: list[int] | None) -> list[dict]:
    """Query the imaging table via SQLAlchemy (reuses app DB config)."""
    from sqlalchemy import select, text
    from src.models.base import AsyncSessionLocal
    from src.models.imaging import Imaging

    async with AsyncSessionLocal() as db:
        if filter_ids:
            result = await db.execute(
                select(Imaging).where(Imaging.id.in_(filter_ids))
            )
        else:
            result = await db.execute(select(Imaging))
        rows = result.scalars().all()
        return [
            {"id": r.id, "patient_id": r.patient_id, "original_url": r.original_url, "title": r.title}
            for r in rows
        ]


def main() -> None:
    if not SUPABASE_URL or not SUPABASE_KEY:
        logger.error(
            "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.\n"
            "    export $(cat .env | grep -v '#' | xargs)"
        )
        sys.exit(1)

    filter_ids: list[int] | None = None
    if IMAGING_IDS_ENV.strip():
        filter_ids = [int(x.strip()) for x in IMAGING_IDS_ENV.split(",") if x.strip()]
        logger.info("Processing imaging IDs: %s", filter_ids)

    records = asyncio.run(_fetch_imaging_records(filter_ids))
    if not records:
        logger.warning("No imaging records found — nothing to do.")
        return

    logger.info("Found %d imaging record(s) to process.", len(records))
    client = _supabase_client()

    with tempfile.TemporaryDirectory(prefix="mri_slices_") as tmpdir:
        tmp = Path(tmpdir)
        for rec in records:
            logger.info(
                "=== imaging_id=%d  patient_id=%d  %s ===",
                rec["id"], rec["patient_id"], rec["title"],
            )
            _process_imaging(client, rec["patient_id"], rec["id"], rec["original_url"], tmp)

    logger.info("All done.")


if __name__ == "__main__":
    env_path = Path(__file__).resolve().parents[3] / ".env"
    if env_path.is_file():
        for line in env_path.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, _, value = line.partition("=")
                os.environ.setdefault(key.strip(), value.strip())
    main()
