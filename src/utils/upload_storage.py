"""Local storage under `uploads/` with public URLs served at `/uploads/...`."""

from __future__ import annotations

import os
from pathlib import Path


def upload_root() -> Path:
    """Absolute path to upload root; directory is created if missing."""
    root = Path(os.getenv("UPLOAD_DIR", "uploads")).resolve()
    root.mkdir(parents=True, exist_ok=True)
    return root


def public_uploads_base() -> str:
    """Base URL for the `/uploads` static mount (no trailing slash)."""
    explicit = os.getenv("PUBLIC_UPLOAD_BASE_URL", "").strip()
    if explicit:
        return explicit.rstrip("/")
    backend = os.getenv("PYTHON_BACKEND_URL", "http://localhost:8000").rstrip("/")
    return f"{backend}/uploads"


def public_url_for_rel(rel_path: str) -> str:
    """Build public URL from path relative to upload root (forward slashes)."""
    rel = rel_path.strip().lstrip("/").replace("\\", "/")
    return f"{public_uploads_base()}/{rel}"


def patient_imaging_dir(patient_id: int) -> Path:
    d = upload_root() / "patients" / str(patient_id)
    d.mkdir(parents=True, exist_ok=True)
    return d


def relpath_from_public_url(url: str) -> str | None:
    """Extract `patients/1/foo.jpg` from a stored public URL, or None if not under /uploads/."""
    if not url or "/uploads/" not in url:
        return None
    return url.split("/uploads/", 1)[1].split("?", 1)[0].strip()


def local_path_from_public_url(url: str) -> Path | None:
    rel = relpath_from_public_url(url)
    if not rel or ".." in rel.split("/"):
        return None
    p = (upload_root() / rel).resolve()
    try:
        p.relative_to(upload_root())
    except ValueError:
        return None
    return p


def public_url_from_filesystem_path(path_str: str) -> str | None:
    """If `path_str` points inside upload root, return its public URL."""
    try:
        p = Path(path_str).expanduser().resolve()
        rel = p.relative_to(upload_root())
        return public_url_for_rel(str(rel).replace("\\", "/"))
    except (ValueError, OSError):
        return None
