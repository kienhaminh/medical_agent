"""Tool to return the best segmentation slice from stored segmentation metadata."""

import json

from src.tools.registry import ToolRegistry

_CLASS_LABELS = {
    1: "Necrotic Core (TC)",
    2: "Oedema (ED)",
    3: "Enhancing Tumour (ET)",
    4: "Enhancing Tumour (ET)",
}


def get_best_segmentation_slice(patient_id: int) -> str:
    """Return the best segmentation slice from the stored MCP result in the DB.

    Reads ``segmentation_result.best_slice`` written by the MCP during segmentation.
    No file I/O or image processing — pure DB read.

    Args:
        patient_id: The patient's database ID.

    Returns:
        JSON string with overlay_markdown, overlay_url, slice_index, tumour_voxels,
        coverage_pct, and tumour_classes_present.
    """
    try:
        from src.models import SessionLocal, Imaging

        with SessionLocal() as db:
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
                "error": (
                    f"No segmentation result found for patient {patient_id}. "
                    "Run segment_patient_image first."
                ),
            })

        seg = rec.segmentation_result
        if seg.get("status") != "success":
            return json.dumps({"status": "error", "error": "Segmentation result is not successful."})

        best_slice = seg.get("best_slice")
        if not best_slice:
            return json.dumps({
                "status": "error",
                "error": (
                    "No best_slice key in segmentation result. "
                    "Re-run segmentation to generate per-slice images."
                ),
            })

        overlay_url = best_slice.get("overlay_url", "")
        slice_index = best_slice.get("slice_index")
        classes = best_slice.get("tumour_classes_present", [])
        classes_str = ", ".join(_CLASS_LABELS.get(c, f"Class {c}") for c in classes)

        return json.dumps({
            "status": "success",
            "slice_index": slice_index,
            "tumour_voxels": best_slice.get("tumour_voxels"),
            "coverage_pct": best_slice.get("coverage_pct"),
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
