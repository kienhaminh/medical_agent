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
