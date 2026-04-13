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
