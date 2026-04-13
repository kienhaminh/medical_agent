import json
import os
import tempfile
from pathlib import Path
from typing import Any

import nibabel as nib
import numpy as np
import requests
import torch
from mcp.server.fastmcp import FastMCP
from PIL import Image
from supabase import create_client

_mcp_host = os.getenv("HOST", "0.0.0.0")
_mcp_port = int(os.getenv("PORT", "8000"))
mcp = FastMCP("medical_img_segmentation", host=_mcp_host, port=_mcp_port)

# Canonical channel order expected by the model.
_MODALITY_ORDER = ["flair", "t1", "t1ce", "t2"]

# Supabase storage configuration
_SUPABASE_URL = os.getenv("SUPABASE_URL", "")
_SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
_SUPABASE_BUCKET = os.getenv("SUPABASE_STORAGE_BUCKET", "medical_images")

_CONTENT_TYPES = {
    ".jpg": "image/jpeg",
    ".png": "image/png",
    ".gz": "application/gzip",
    ".json": "application/json",
}


def _supabase_client():
    if not _SUPABASE_URL or not _SUPABASE_KEY:
        raise RuntimeError("SUPABASE_URL and SUPABASE_KEY environment variables must be set.")
    return create_client(_SUPABASE_URL, _SUPABASE_KEY)


def _upload_to_supabase(client, local_path: Path, storage_path: str) -> str:
    """Upload a file to Supabase Storage and return its public URL."""
    suffix = "".join(local_path.suffixes)  # handles .nii.gz correctly
    content_type = _CONTENT_TYPES.get(local_path.suffix, "application/octet-stream")
    with open(local_path, "rb") as f:
        data = f.read()
    client.storage.from_(_SUPABASE_BUCKET).upload(
        storage_path,
        data,
        {"content-type": content_type, "upsert": True},
    )
    return client.storage.from_(_SUPABASE_BUCKET).get_public_url(storage_path)


def _load_nifti_zyx(nifti_path: Path) -> np.ndarray:
    img = nib.load(str(nifti_path))
    data_xyz = img.get_fdata(dtype=np.float32)
    return np.asarray(data_xyz).transpose(2, 1, 0)


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
        lo = float(nz.min())
        hi = float(nz.max())
    if hi - lo < 1e-8:
        return np.zeros(arr.shape, dtype=np.uint8)

    scaled = np.clip((arr - lo) / (hi - lo), 0.0, 1.0)
    return (scaled * 255.0).astype(np.uint8)


def _crop_start_from_nonzero(mask_zyx: np.ndarray, target_size: tuple[int, int, int]) -> tuple[int, int, int]:
    d, h, w = mask_zyx.shape
    dz, dy, dx = target_size
    idx = np.where(mask_zyx != 0)
    if idx[0].size == 0:
        return (d - dz) // 2, (h - dy) // 2, (w - dx) // 2

    z_centroid = (idx[0].min() + idx[0].max()) // 2
    y_centroid = (idx[1].min() + idx[1].max()) // 2
    x_centroid = (idx[2].min() + idx[2].max()) // 2

    z0 = int(np.clip(z_centroid - dz // 2, 0, d - dz))
    y0 = int(np.clip(y_centroid - dy // 2, 0, h - dy))
    x0 = int(np.clip(x_centroid - dx // 2, 0, w - dx))
    return z0, y0, x0


def _download_file(url: str, out_path: Path) -> None:
    resp = requests.get(url, timeout=120)
    resp.raise_for_status()
    out_path.write_bytes(resp.content)


def _load_attco_model(checkpoint_path: Path, device: torch.device):
    from models.AttCo_BraTS import AttCo

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


@mcp.tool()
def segment_brats_from_link(
    patient_id: str = "remote",
    imaging_id: str = "0",
    flair_url: str | None = None,
    t1_url: str | None = None,
    t1ce_url: str | None = None,
    t2_url: str | None = None,
    slice_index: int = -1,
    fold: int = 3,
    alpha: float = 0.45,
) -> dict[str, Any]:
    """
    Segment BraTS MRI volume from per-modality NIfTI URLs.

    Pass one or more modality URLs (flair_url, t1_url, t1ce_url, t2_url).
    At least one must be provided. Missing modalities are zero-filled so the
    4-channel model always receives a full input tensor.

    The overlay image is rendered on the first available modality (flair preferred).
    Artifacts are uploaded to Supabase Storage and public URLs are returned.
    """
    url_map = {
        "flair": flair_url,
        "t1": t1_url,
        "t1ce": t1ce_url,
        "t2": t2_url,
    }
    provided = {mod: url for mod, url in url_map.items() if url}
    if not provided:
        raise ValueError("At least one modality URL must be provided (flair_url, t1_url, t1ce_url, or t2_url).")

    supabase = _supabase_client()

    repo_root = Path(__file__).resolve().parents[1]
    ckpt_dir = repo_root / "segmentation-mcp" / "checkpoint" / "BraTS2020" / "JointFusionNet3D_v11"
    ckpt_candidates = sorted(ckpt_dir.glob(f"Fold_{fold}_bs_4_*.pt"))
    if not ckpt_candidates:
        raise FileNotFoundError(f"No checkpoint found for fold={fold} under {ckpt_dir}")
    checkpoint_path = ckpt_candidates[0]

    with tempfile.TemporaryDirectory(prefix="brats-") as td:
        td_path = Path(td)

        # Download provided modalities.
        modality_vols: dict[str, np.ndarray] = {}
        for mod, url in provided.items():
            local_path = td_path / f"{mod}.nii.gz"
            _download_file(url, local_path)
            modality_vols[mod] = _load_nifti_zyx(local_path)

        ref_shape = next(iter(modality_vols.values())).shape
        if any(v.shape != ref_shape for v in modality_vols.values()):
            raise ValueError(f"Shape mismatch among modalities: {[v.shape for v in modality_vols.values()]}")
        depth, height, width = ref_shape

        if slice_index < 0:
            slice_z = depth // 2
        else:
            slice_z = slice_index
        if slice_z < 0 or slice_z >= depth:
            raise ValueError(f"slice_index out of range: {slice_z} for depth={depth}")

        # Build 4-channel volume in canonical order; zero-fill missing modalities.
        zero = np.zeros(ref_shape, dtype=np.float32)
        channels = []
        for mod in _MODALITY_ORDER:
            if mod in modality_vols:
                channels.append(_standardize_nonzeros(modality_vols[mod]).astype(np.float32))
            else:
                channels.append(zero)
        img_zyxc = np.stack(channels, axis=-1)

        # Use first available modality for spatial crop anchor and overlay base.
        anchor_mod = next(mod for mod in _MODALITY_ORDER if mod in modality_vols)
        anchor_vol = channels[_MODALITY_ORDER.index(anchor_mod)]

        target_size = (128, 128, 128)
        z0, y0, x0 = _crop_start_from_nonzero(anchor_vol, target_size)
        dz, dy, dx = target_size
        crop_zyxc = img_zyxc[z0 : z0 + dz, y0 : y0 + dy, x0 : x0 + dx, :]
        crop_czyx = np.transpose(crop_zyxc, axes=[3, 0, 1, 2])
        x_tensor = torch.tensor(crop_czyx, dtype=torch.float32).unsqueeze(0)

        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        x_tensor = x_tensor.to(device)
        model = _load_attco_model(checkpoint_path, device)

        with torch.no_grad():
            logits = model(x_tensor)
            pred = torch.argmax(logits, dim=1)[0].cpu().numpy().astype(np.uint8)

        full_pred = np.zeros((depth, height, width), dtype=np.uint8)
        full_pred[z0 : z0 + dz, y0 : y0 + dy, x0 : x0 + dx] = pred
        label_slice = full_pred[slice_z, :, :]

        color_map = {
            1: np.array([255.0, 0.0, 0.0], dtype=np.float32),
            2: np.array([0.0, 255.0, 0.0], dtype=np.float32),
            3: np.array([0.0, 0.0, 255.0], dtype=np.float32),
        }

        # ── Per-slice images ──────────────────────────────────────────────────
        slices_prefix = f"patients/{patient_id}/slices/{imaging_id}"

        for z in range(depth):
            # MRI slice: grayscale JPEG
            mri_u8 = _normalize_slice_u8(anchor_vol[z, :, :])
            mri_rgb = np.stack([mri_u8, mri_u8, mri_u8], axis=-1)
            mri_pil = Image.fromarray(mri_rgb, mode="RGB").resize((512, 512), Image.LANCZOS)
            mri_z_path = td_path / f"mri_z{z}.jpg"
            mri_pil.save(str(mri_z_path), "JPEG", quality=85)
            _upload_to_supabase(supabase, mri_z_path, f"{slices_prefix}/mri_z{z}.jpg")

            # Mask slice: RGBA PNG with transparent background
            label_z = full_pred[z, :, :]
            mask_rgba_z = np.zeros((*label_z.shape, 4), dtype=np.uint8)
            for cls, color in color_map.items():
                m = label_z == cls
                if np.any(m):
                    mask_rgba_z[m, :3] = color.astype(np.uint8)
                    mask_rgba_z[m, 3] = 255
            mask_pil = Image.fromarray(mask_rgba_z, mode="RGBA").resize((512, 512), Image.NEAREST)
            mask_z_path = td_path / f"mask_z{z}.png"
            mask_pil.save(str(mask_z_path))
            _upload_to_supabase(supabase, mask_z_path, f"{slices_prefix}/mask_z{z}.png")

        # ── Best slice ────────────────────────────────────────────────────────
        slice_voxels = np.count_nonzero(full_pred, axis=(1, 2))
        best_z = int(np.argmax(slice_voxels))
        best_voxel_count = int(slice_voxels[best_z])
        total_voxels = height * width
        coverage_pct = round(float(best_voxel_count) / total_voxels * 100, 2)
        best_classes = [int(c) for c in np.unique(full_pred[best_z]) if c != 0]

        # Render best slice overlay (MRI + mask blend)
        best_base_u8 = _normalize_slice_u8(anchor_vol[best_z, :, :])
        best_base = np.stack([best_base_u8, best_base_u8, best_base_u8], axis=-1).astype(np.float32)
        best_overlay = best_base.copy()
        best_label = full_pred[best_z, :, :]
        for cls, color in color_map.items():
            m = best_label == cls
            if np.any(m):
                best_overlay[m] = (1.0 - alpha) * best_overlay[m] + alpha * color
        best_slice_pil = Image.fromarray(
            best_overlay.clip(0, 255).astype(np.uint8), mode="RGB"
        ).resize((512, 512), Image.LANCZOS)
        best_slice_path = td_path / "best_slice.jpg"
        best_slice_pil.save(str(best_slice_path), "JPEG", quality=90)
        best_slice_url = _upload_to_supabase(supabase, best_slice_path, f"{slices_prefix}/best_slice.jpg")

        base_u8 = _normalize_slice_u8(anchor_vol[slice_z, :, :])
        base = np.stack([base_u8, base_u8, base_u8], axis=-1).astype(np.float32)
        overlay = base.copy()
        for cls, color in color_map.items():
            m = label_slice == cls
            if np.any(m):
                overlay[m] = (1.0 - alpha) * overlay[m] + alpha * color

        modalities_used = list(provided.keys())
        prefix = f"BraTS20_Training_{patient_id}_{'_'.join(modalities_used)}_z{slice_z}"

        # Write artifacts to temp dir, then upload to Supabase.
        predmask_path = td_path / f"{prefix}_predmask.png"
        overlay_path = td_path / f"{prefix}_overlay.jpg"
        pred_nii_path = td_path / f"{prefix}_predmask3d.nii.gz"
        json_path = td_path / f"{prefix}_output.json"

        # Build RGBA mask: transparent background, colored tumor classes only.
        mask_rgba = np.zeros((*label_slice.shape, 4), dtype=np.uint8)
        for cls, color in color_map.items():
            m = label_slice == cls
            if np.any(m):
                mask_rgba[m, :3] = color.astype(np.uint8)
                mask_rgba[m, 3] = 255
        Image.fromarray(mask_rgba, mode="RGBA").save(str(predmask_path))
        Image.fromarray(overlay.clip(0, 255).astype(np.uint8)).save(str(overlay_path))
        nib.save(nib.Nifti1Image(full_pred, affine=np.eye(4)), str(pred_nii_path))

        # Upload to Supabase Storage.
        patient_prefix = f"patients/{patient_id}"
        overlay_url = _upload_to_supabase(supabase, overlay_path, f"{patient_prefix}/{prefix}_overlay.jpg")
        predmask_url = _upload_to_supabase(supabase, predmask_path, f"{patient_prefix}/{prefix}_predmask.png")
        pred_nii_url = _upload_to_supabase(supabase, pred_nii_path, f"{patient_prefix}/{prefix}_predmask3d.nii.gz")

        result = {
            "patient_id": patient_id,
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
                "crop": {
                    "start_zyx": [z0, y0, x0],
                    "size_dhw": [dz, dy, dx],
                },
            },
            "prediction": {
                "full_pred_shape_zyx": [depth, height, width],
                "slice_pred_shape_yx": [height, width],
                "pred_classes_in_slice": [int(v) for v in np.unique(label_slice)],
            },
            "slice_url_pattern": {
                "mri": f"{_SUPABASE_URL.rstrip('/')}/storage/v1/object/public/{_SUPABASE_BUCKET}/{slices_prefix}/mri_z{{z}}.jpg",
                "mask": f"{_SUPABASE_URL.rstrip('/')}/storage/v1/object/public/{_SUPABASE_BUCKET}/{slices_prefix}/mask_z{{z}}.png",
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

        # Upload JSON summary last (includes artifact URLs).
        json_path.write_text(json.dumps(result, indent=2), encoding="utf-8")
        json_url = _upload_to_supabase(supabase, json_path, f"{patient_prefix}/{prefix}_output.json")
        result["artifacts"]["json_summary"] = {"url": json_url, "format": "json"}

    return result


if __name__ == "__main__":
    transport = os.getenv("MCP_TRANSPORT", "streamable-http")
    if transport == "stdio":
        mcp.run(transport="stdio")
    elif transport == "sse":
        mcp.run(transport="sse")
    else:
        mcp.run(transport="streamable-http")
