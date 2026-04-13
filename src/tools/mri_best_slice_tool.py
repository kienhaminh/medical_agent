"""Tool to extract and display the most informative segmentation slice for a patient's MRI.

NOTE: This tool previously relied on local NIfTI files and nibabel. After the
Supabase Storage migration, MRI volumes are stored remotely and are no longer
accessible as local paths. The tool currently returns the best-slice metadata
from the stored segmentation result without rendering a new overlay image.
"""

import json

from src.tools.registry import ToolRegistry


def get_best_segmentation_slice(patient_id: int) -> str:
    """Return metadata about the most-informative segmentation slice from the stored result.

    Reads the persisted segmentation_result JSON for the patient's most recent
    successful segmentation. Returns slice index, coverage, and the pre-rendered
    overlay URL that was stored by the MCP server.

    Args:
        patient_id: The patient's database ID.

    Returns:
        JSON string with overlay_markdown, slice_index, tumour_voxels (if available),
        coverage_pct (if available), and tumour_classes_present.
    """
    try:
        from src.models import SessionLocal, Imaging

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

            seg = rec.segmentation_result
            if seg.get("status") != "success":
                return json.dumps({
                    "status": "error",
                    "error": "Segmentation result is not successful.",
                })

            # Pull the pre-rendered overlay URL stored by the MCP server.
            overlay_url = (
                seg.get("artifacts", {}).get("overlay_image", {}).get("url", "")
            )
            slice_index = seg.get("input", {}).get("slice_index")
            pred_classes = seg.get("prediction", {}).get("pred_classes_in_slice", [])
            class_labels = {1: "Necrotic Core (TC)", 2: "Oedema (ED)", 3: "Enhancing Tumour (ET)"}
            classes_str = ", ".join(class_labels.get(c, f"Class {c}") for c in pred_classes)

            if not overlay_url:
                return json.dumps({
                    "status": "error",
                    "error": "No overlay image URL found in segmentation result.",
                })

            return json.dumps({
                "status": "success",
                "slice_index": slice_index,
                "tumour_classes_present": classes_str,
                "overlay_url": overlay_url,
                "overlay_markdown": f"![Best Segmentation Slice — z={slice_index}]({overlay_url})",
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
