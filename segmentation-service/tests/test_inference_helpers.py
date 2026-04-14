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
