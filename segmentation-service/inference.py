"""MRI segmentation inference logic."""
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
        storage_path, data, {"content-type": content_type, "upsert": "true"}
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
    """Scale a 2-D float slice to uint8 [0, 255] using percentile clipping."""
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
    """Return the (z0, y0, x0) crop start centred on the bounding box of nonzero voxels.

    Falls back to a centred crop when the mask is all zeros.
    """
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
    from models.AttCo_MRI import AttCo

    ckpt_obj = torch.load(str(checkpoint_path), map_location="cpu", weights_only=False)
    if hasattr(ckpt_obj, "state_dict"):
        state = ckpt_obj.state_dict()
    elif isinstance(ckpt_obj, dict):
        state = ckpt_obj
    else:
        raise ValueError("Unsupported checkpoint object format")

    model = AttCo(inChannel=2, outChannel=4, baseChannel=16)
    model.load_state_dict(state, strict=True)
    model.to(device)
    model.train(False)
    return model


def segment_mri(params: SegmentParams) -> dict[str, Any]:
    """Run MRI segmentation and upload artifacts to Supabase. Returns result dict."""
    url_map = {
        "flair": params.flair_url,
        "t1": params.t1_url,
        "t1ce": params.t1ce_url,
        "t2": params.t2_url,
    }
    provided = {mod: url for mod, url in url_map.items() if url}

    if not provided:
        raise ValueError("At least one of flair_url, t1_url, t1ce_url, t2_url must be provided.")

    supabase = _supabase_client()
    # In the Docker container the Dockerfile copies segmentation-mcp/checkpoint/MRI2020
    # into the WORKDIR, so Path(__file__).parent / "checkpoint" resolves correctly.
    ckpt_dir = Path(__file__).parent / "checkpoint" / "MRI2020" / "JointFusionNet3D_v11"
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
        prefix = f"MRI_{params.patient_id}_{'_'.join(modalities_used)}_z{slice_z}"
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
                "architecture": "AttCo",
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
