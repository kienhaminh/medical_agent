"""Generate JPEG preview slices from MRI NIfTI files stored in Supabase.

For each sample group (sample_1, sample_2, sample_3) and each modality
(flair, t1, t1ce, t2), this script:
  1. Downloads the NIfTI file from Supabase storage (medical_images bucket)
  2. Extracts the mid-volume axial slice as a JPEG
  3. Uploads the JPEG preview back to Supabase under {sample}/preview_{modality}.jpg
  4. Prints the resulting public URLs (copy into seed.py)

Run:
    python -m scripts.db.seed.generate_mri_previews

Environment variables required:
    SUPABASE_URL
    SUPABASE_SERVICE_ROLE_KEY
    SUPABASE_STORAGE_BUCKET  (defaults to "medical_images")
"""
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

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
BUCKET = os.environ.get("SUPABASE_STORAGE_BUCKET", "medical_images")

SAMPLES = ["sample_1", "sample_2", "sample_3"]
MODALITIES = ["flair", "t1", "t1ce", "t2"]

# Public base URL for the bucket (no auth needed for public objects)
PUBLIC_BASE = f"{SUPABASE_URL}/storage/v1/object/public/{BUCKET}"


# ---------------------------------------------------------------------------
# Core helpers
# ---------------------------------------------------------------------------

def _download_nifti(url: str, dest: Path) -> bool:
    """Download a NIfTI file from Supabase into dest. Returns True on success."""
    logger.info("Downloading %s", url)
    try:
        resp = requests.get(url, timeout=120)
        resp.raise_for_status()
        dest.write_bytes(resp.content)
        return True
    except Exception as exc:
        logger.warning("Download failed (%s): %s", url, exc)
        return False


def _extract_mid_slice_jpeg(nii_path: Path, output_size: int = 512) -> bytes | None:
    """Extract the mid-volume axial slice from a NIfTI file as JPEG bytes.

    Uses the same orientation and normalisation as the segmentation MCP server:
      - Orientation: data[:, :, z].T  → shape (y, x)
      - Normalisation: non-zero pixels, percentile 1–99 clipping → uint8
      - Upscaled to output_size × output_size with LANCZOS interpolation
    """
    try:
        import nibabel as nib  # noqa: PLC0415

        img = nib.load(str(nii_path))
        data = np.asarray(img.dataobj, dtype=np.float32)  # (x, y, z)
        slice_z = data.shape[2] // 2

        # Match MCP orientation: data[:,:,z].T → (y, x)
        slice_yx = data[:, :, slice_z].T

        # Normalise on non-zero voxels (p1–p99)
        nz = slice_yx[slice_yx != 0]
        if nz.size == 0:
            normed = np.zeros(slice_yx.shape, dtype=np.uint8)
        else:
            lo, hi = float(np.percentile(nz, 1)), float(np.percentile(nz, 99))
            if hi - lo < 1e-8:
                lo, hi = float(nz.min()), float(nz.max())
            if hi - lo < 1e-8:
                normed = np.zeros(slice_yx.shape, dtype=np.uint8)
            else:
                normed = np.clip((slice_yx - lo) / (hi - lo) * 255, 0, 255).astype(np.uint8)

        pil_img = Image.fromarray(normed, mode="L").resize((output_size, output_size), Image.LANCZOS)
        buf = io.BytesIO()
        pil_img.convert("RGB").save(buf, "JPEG", quality=90)
        return buf.getvalue()
    except Exception:
        logger.exception("Failed to extract slice from %s", nii_path)
        return None


def _upload_preview(client, storage_path: str, jpeg_bytes: bytes) -> str:
    """Upload JPEG bytes to Supabase and return the public URL."""
    client.storage.from_(BUCKET).upload(
        storage_path,
        jpeg_bytes,
        {"content-type": "image/jpeg", "upsert": "true"},
    )
    return client.storage.from_(BUCKET).get_public_url(storage_path)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    if not SUPABASE_URL or not SUPABASE_KEY:
        logger.error(
            "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set. "
            "Source your .env file first:\n\n"
            "    export $(cat .env | grep -v '#' | xargs)\n"
        )
        sys.exit(1)

    client = create_client(SUPABASE_URL, SUPABASE_KEY)
    results: dict[str, dict[str, str]] = {}  # sample → modality → preview_url

    with tempfile.TemporaryDirectory(prefix="mri_previews_") as tmpdir:
        tmp = Path(tmpdir)

        for sample in SAMPLES:
            results[sample] = {}
            logger.info("=== Processing %s ===", sample)

            for modality in MODALITIES:
                volume_storage_path = f"{sample}_{modality}.nii.gz"
                volume_url = f"{PUBLIC_BASE}/{volume_storage_path}"
                nii_path = tmp / f"{sample}_{modality}.nii.gz"

                # Download NIfTI
                if not _download_nifti(volume_url, nii_path):
                    logger.warning("Skipping %s/%s — file not found in Supabase", sample, modality)
                    continue

                # Generate mid-slice JPEG
                jpeg_bytes = _extract_mid_slice_jpeg(nii_path)
                if jpeg_bytes is None:
                    logger.warning("Skipping %s/%s — slice extraction failed", sample, modality)
                    continue

                # Upload preview to Supabase: {sample}/preview_{modality}.jpg
                preview_storage_path = f"{sample}/preview_{modality}.jpg"
                preview_url = _upload_preview(client, preview_storage_path, jpeg_bytes)
                results[sample][modality] = preview_url
                logger.info("Uploaded preview → %s", preview_url)

                # Clean up NIfTI to save disk space
                nii_path.unlink(missing_ok=True)

    # ---------------------------------------------------------------------------
    # Print seed.py snippet
    # ---------------------------------------------------------------------------
    print("\n" + "=" * 70)
    print("Paste the following into scripts/db/seed/seed.py")
    print("=" * 70 + "\n")

    for sample in SAMPLES:
        modality_results = results.get(sample, {})
        if not modality_results:
            print(f"# {sample}: no files found — skipped")
            continue

        const_name = f"SAMPLE_{sample.split('_')[1]}_IMAGING"
        print(f"{const_name} = [")
        for modality in MODALITIES:
            preview_url = modality_results.get(modality)
            if not preview_url:
                continue
            volume_url = f"{PUBLIC_BASE}/{sample}_{modality}.nii.gz"
            title = f"MRI {sample.replace('_', ' ').title()} — {modality.upper()}"
            print(f"    {{")
            print(f'        "title": "{title}",')
            print(f'        "image_type": "{modality}",')
            print(f'        "preview_url": "{preview_url}",')
            print(f'        "original_url": "{volume_url}",')
            print(f"    }},")
        print("]\n")


if __name__ == "__main__":
    # Load .env if present (convenience for direct script execution)
    env_path = Path(__file__).resolve().parents[3] / ".env"
    if env_path.is_file():
        for line in env_path.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, _, value = line.partition("=")
                os.environ.setdefault(key.strip(), value.strip())

    main()
