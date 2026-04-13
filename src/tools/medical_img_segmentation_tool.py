"""Agent tool to run MRI segmentation via the medical_img_segmentation MCP server."""

import asyncio
import json
import os
from typing import Any
from urllib.parse import urlparse

from mcp import ClientSession
from mcp.client.streamable_http import streamablehttp_client

from src.tools.registry import ToolRegistry

# Canonical MCP modality param names → Imaging.image_type values.
_MODALITY_PARAM = {
    "flair": "flair_url",
    "t1": "t1_url",
    "t1ce": "t1ce_url",
    "t2": "t2_url",
}


def _mcp_url() -> str:
    """Resolve MCP endpoint from environment."""
    # Docker compose maps segmentation MCP service to localhost:8010.
    return os.getenv("SEGMENTATION_MCP_URL", "http://localhost:8010/mcp")


def _rewrite_for_mcp(url: str) -> str:
    """Rewrite an image URL so the MCP container can fetch it.

    When MCP runs in Docker, the host FastAPI server is reachable via
    MCP_IMAGE_BASE_URL (e.g. http://host.docker.internal:8000) rather
    than localhost:8000.
    """
    mcp_image_base = os.getenv("MCP_IMAGE_BASE_URL", "").rstrip("/")
    if not mcp_image_base:
        return url
    parsed = urlparse(url)
    host_base = f"{parsed.scheme}://{parsed.netloc}"
    return url.replace(host_base, mcp_image_base, 1)


async def _call_segmentation_mcp(
    modality_urls: dict[str, str],
    patient_id: str = "remote",
    imaging_id: str = "0",
    slice_index: int = -1,
    fold: int = 3,
    alpha: float = 0.45,
) -> dict[str, Any]:
    """Call the MCP segmentation tool with per-modality URLs.

    Args:
        modality_urls: Mapping of modality name → URL (only provided modalities).
                       E.g. {"flair": "http://...", "t1": "http://..."}
    """
    arguments: dict[str, Any] = {
        "patient_id": patient_id,
        "imaging_id": imaging_id,
        "slice_index": slice_index,
        "fold": fold,
        "alpha": alpha,
    }
    for mod, param in _MODALITY_PARAM.items():
        if mod in modality_urls:
            arguments[param] = modality_urls[mod]

    url = _mcp_url()
    # Segmentation on CPU can take several minutes; raise timeouts accordingly.
    async with streamablehttp_client(url, timeout=600, sse_read_timeout=600) as (read_stream, write_stream, _):
        async with ClientSession(read_stream, write_stream) as session:
            await session.initialize()
            tool_result = await session.call_tool("segment_brats_from_link", arguments=arguments)

            # Prefer structured payload if server provides it.
            if getattr(tool_result, "structuredContent", None):
                return tool_result.structuredContent

            # Fallback: parse first text content as JSON.
            if getattr(tool_result, "content", None):
                for content in tool_result.content:
                    text = getattr(content, "text", None)
                    if text:
                        try:
                            return json.loads(text)
                        except Exception:
                            return {"status": "unknown", "raw_text": text}

            return {"status": "unknown", "raw_result": str(tool_result)}


def segment_patient_image(patient_id: int, session_id: int | None = None) -> str:
    """Start MRI segmentation for a patient in the background.

    If a valid cached result exists, returns it immediately (no background task).
    Otherwise, fires a background asyncio task and returns status=queued.

    Args:
        patient_id: The patient's database ID.
        session_id: The active chat session ID. When provided, the agent will post
                    a clinical interpretation to this session when segmentation completes.

    Returns:
        JSON string. Either cached results (status=success, already_segmented=true)
        or {status: "queued"} when the background task has been dispatched.
    """
    from src.models import SessionLocal, Imaging
    from src.api.routers.patients.segmentation_worker import _run_segmentation_background

    try:
        with SessionLocal() as db:
            all_records = db.query(Imaging).filter(
                Imaging.patient_id == patient_id,
            ).order_by(Imaging.id).all()

            if not all_records:
                return json.dumps(
                    {"status": "error", "error": f"No MRI imaging records found for patient {patient_id}"},
                    ensure_ascii=True,
                )

            # Use the most recent imaging group; fall back to all records if ungrouped.
            grouped = [r for r in all_records if r.group_id is not None]
            if grouped:
                latest_group_id = max(r.group_id for r in grouped)
                imaging_records = [r for r in grouped if r.group_id == latest_group_id]
            else:
                imaging_records = all_records

            # Check for a cached segmentation result.
            intended_modalities = {
                img.image_type for img in imaging_records if img.image_type in _MODALITY_PARAM
            }
            cached_payload = None
            for rec in imaging_records:
                seg = rec.segmentation_result
                if not seg or seg.get("status") != "success":
                    continue
                cached_modalities = set(seg.get("input", {}).get("modalities_provided", []))
                if intended_modalities <= cached_modalities:
                    cached_payload = seg
                    break

            if cached_payload is not None:
                # Return cached result immediately — no background task needed.
                _output_base = os.getenv("PUBLIC_UPLOAD_BASE_URL", "http://localhost:8000/uploads").rstrip("/")
                for artifact in cached_payload.get("artifacts", {}).values():
                    if isinstance(artifact, dict) and "path" in artifact:
                        artifact["url"] = f"{_output_base}/{artifact['path'].rsplit('/', 1)[-1]}"

                overlay_url = cached_payload.get("artifacts", {}).get("overlay_image", {}).get("url", "")
                predmask_url = cached_payload.get("artifacts", {}).get("predmask_image", {}).get("url", "")
                tumour_classes = cached_payload.get("prediction", {}).get("pred_classes_in_slice", [])
                modalities_used = cached_payload.get("input", {}).get("modalities_provided", sorted(intended_modalities))

                return json.dumps(
                    {
                        "status": cached_payload.get("status", "unknown"),
                        "already_segmented": True,
                        "modalities_used": modalities_used,
                        "overlay_url": overlay_url,
                        "overlay_markdown": f"![MRI Segmentation Overlay]({overlay_url})",
                        "predmask_url": predmask_url,
                        "predmask_markdown": f"![Segmentation Mask]({predmask_url})" if predmask_url else "",
                        "tumour_classes": tumour_classes,
                    },
                    ensure_ascii=True,
                )

            # No cache — dispatch background task and return immediately.
            primary_imaging_id = imaging_records[0].id

        # Schedule the background coroutine on the running event loop.
        # The tool is called from within the async LangGraph agent, so a loop is always running.
        loop = asyncio.get_running_loop()
        loop.create_task(
            _run_segmentation_background(
                patient_id=patient_id,
                imaging_id=primary_imaging_id,
                session_id=session_id,
            )
        )

        return json.dumps(
            {
                "status": "queued",
                "message": (
                    f"BraTS segmentation has been started in the background for patient {patient_id}. "
                    "This typically takes 3–5 minutes. "
                    + (
                        "I will post the clinical interpretation directly in this conversation when it is ready."
                        if session_id
                        else "You will receive a notification when it is complete."
                    )
                ),
            },
            ensure_ascii=True,
        )

    except Exception as exc:
        return json.dumps(
            {
                "status": "error",
                "error": str(exc),
                "mcp_url": _mcp_url(),
            },
            ensure_ascii=True,
        )


_registry = ToolRegistry()
_registry.register(
    segment_patient_image,
    scope="global",
    symbol="segment_patient_image",
    allow_overwrite=True,
)
