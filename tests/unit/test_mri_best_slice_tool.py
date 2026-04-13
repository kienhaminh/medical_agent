"""Tests for the pure-DB-read get_best_segmentation_slice tool."""
import json
from unittest.mock import MagicMock, patch


def _make_imaging(seg_result: dict | None):
    img = MagicMock()
    img.segmentation_result = seg_result
    return img


def _mock_db(imaging):
    mock_db = MagicMock()
    mock_db.__enter__ = MagicMock(return_value=mock_db)
    mock_db.__exit__ = MagicMock(return_value=False)
    mock_db.query.return_value.filter.return_value.first.return_value = imaging
    return mock_db


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

    with patch("src.models.SessionLocal", return_value=_mock_db(_make_imaging(seg))):
        from src.tools.mri_best_slice_tool import get_best_segmentation_slice
        result = json.loads(get_best_segmentation_slice(patient_id=1))

    assert result["status"] == "success"
    assert result["slice_index"] == 51
    assert result["coverage_pct"] == 4.2
    assert result["tumour_voxels"] == 2430
    assert "Necrotic Core" in result["tumour_classes_present"]
    assert "best_slice.jpg" in result["overlay_url"]
    assert "z=51" in result["overlay_markdown"]


def test_returns_error_when_no_segmentation():
    with patch("src.models.SessionLocal", return_value=_mock_db(None)):
        from src.tools.mri_best_slice_tool import get_best_segmentation_slice
        result = json.loads(get_best_segmentation_slice(patient_id=99))

    assert result["status"] == "error"
    assert "No segmentation" in result["error"]


def test_returns_error_when_no_best_slice_key():
    seg = {"status": "success"}  # missing best_slice

    with patch("src.models.SessionLocal", return_value=_mock_db(_make_imaging(seg))):
        from src.tools.mri_best_slice_tool import get_best_segmentation_slice
        result = json.loads(get_best_segmentation_slice(patient_id=1))

    assert result["status"] == "error"
    assert "best_slice" in result["error"]
