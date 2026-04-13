"""Tool to extract and display the most informative segmentation slice for a patient's MRI."""

import json
import uuid
from pathlib import Path

from src.tools.registry import ToolRegistry
from src.utils.upload_storage import (
    local_path_from_public_url,
    normalize_docker_urls,
    patient_imaging_dir,
    public_url_for_rel,
)


def get_best_segmentation_slice(patient_id: int) -> str:
    """Find and render the axial slice with the largest tumour region from the 3D segmentation mask.

    Scans all slices of the 3D prediction mask, picks the one with the most
    non-zero voxels (broadest tumour coverage), and returns a JPEG overlay
    (grayscale MRI + coloured tumour mask) ready to embed in the conversation.

    Args:
        patient_id: The patient's database ID.

    Returns:
        JSON string with overlay_markdown (ready to paste verbatim), slice_index,
        tumour_voxels, coverage_pct, and tumour_classes_present.
    """
    try:
        import nibabel as nib
        import numpy as np
        from src.models import SessionLocal, Imaging
        from src.api.routers.patients.imaging import _extract_slice_jpeg

        with SessionLocal() as db:
            # Find the imaging record that holds a successful segmentation result.
            rec = (
                db.query(Imaging)
                .filter(
                    Imaging.patient_id == patient_id,
                    Imaging.segmentation_result.isnot(None),
                )
                .first()
            )
            if rec is None:
                return json.dumps({
                    "status": "error",
                    "error": f"No segmentation result found for patient {patient_id}. Run segment_patient_image first.",
                })

            seg = normalize_docker_urls(rec.segmentation_result)
            if seg.get("status") != "success":
                return json.dumps({
                    "status": "error",
                    "error": "Segmentation result is not successful.",
                })

            mask_url = seg.get("artifacts", {}).get("pred_mask_3d", {}).get("url", "")
            if not mask_url:
                return json.dumps({
                    "status": "error",
                    "error": "3D mask not found in segmentation result.",
                })

            mask_path = local_path_from_public_url(mask_url.split("?")[0])
            if not mask_path or not mask_path.is_file():
                return json.dumps({
                    "status": "error",
                    "error": f"3D mask file not found on disk: {mask_url}",
                })

            # Load mask (z, y, x) and find the slice with the most non-zero voxels.
            mask_img = nib.load(str(mask_path))
            mask_data = np.asarray(mask_img.dataobj)  # shape (z, y, x)
            slice_voxels = np.count_nonzero(mask_data, axis=(1, 2))  # per-slice counts
            best_z = int(np.argmax(slice_voxels))
            best_voxel_count = int(slice_voxels[best_z])
            total_voxels = mask_data.shape[1] * mask_data.shape[2]
            coverage_pct = round(best_voxel_count / total_voxels * 100, 2)
            classes_present = [int(c) for c in np.unique(mask_data[best_z]) if c != 0]

            # Render overlay: use the MRI NIfTI from the same imaging record.
            nii_path = local_path_from_public_url(rec.original_url)
            if not nii_path or not nii_path.is_file():
                return json.dumps({
                    "status": "error",
                    "error": "MRI NIfTI volume not found on disk.",
                })

            jpeg_bytes = _extract_slice_jpeg(nii_path, best_z, mask_path)

            # Save to patient uploads directory.
            out_dir = patient_imaging_dir(patient_id)
            filename = f"best_slice_{uuid.uuid4().hex[:8]}.jpg"
            out_path = out_dir / filename
            out_path.write_bytes(jpeg_bytes)

            rel = f"patients/{patient_id}/{filename}"
            overlay_url = public_url_for_rel(rel)

            class_labels = {1: "Necrotic Core (TC)", 2: "Oedema (ED)", 3: "Enhancing Tumour (ET)"}
            classes_str = ", ".join(class_labels.get(c, f"Class {c}") for c in classes_present)

            return json.dumps({
                "status": "success",
                "slice_index": best_z,
                "tumour_voxels": best_voxel_count,
                "coverage_pct": coverage_pct,
                "tumour_classes_present": classes_str,
                "overlay_url": overlay_url,
                "overlay_markdown": f"![Best Segmentation Slice — z={best_z}]({overlay_url})",
            })

    except Exception as exc:
        return json.dumps({"status": "error", "error": str(exc)})


_registry = ToolRegistry()
_registry.register(
    get_best_segmentation_slice,
    scope="global",
    symbol="get_best_segmentation_slice",
    allow_overwrite=True,
)
