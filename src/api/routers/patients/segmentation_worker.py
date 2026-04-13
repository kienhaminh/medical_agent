"""Background worker for BraTS MRI segmentation.

Two execution paths:
  Path 1 (session_id=None, user_id provided): Manual UI trigger.
    On completion → sends imaging.segmentation WS notification to the triggering doctor.

  Path 2 (session_id provided): Agent-initiated.
    On completion → creates a trigger message in the chat session and dispatches
    the agent to post a clinical interpretation in the conversation.
"""

import asyncio
import logging
import time

from sqlalchemy import select

from src.models import AsyncSessionLocal, Patient
from src.models.imaging import Imaging
from src.models.chat import ChatMessage
from src.api.ws.connection_manager import manager
from src.api.ws.events import WSEvent, WSEventType
from src.tools.medical_img_segmentation_tool import (
    _call_segmentation_mcp,
    _rewrite_for_mcp,
    _MODALITY_PARAM,
)

logger = logging.getLogger(__name__)


async def _run_segmentation_background(
    patient_id: int,
    imaging_id: int,
    session_id: int | None = None,
    user_id: str | None = None,
) -> None:
    """Run BraTS segmentation in the background and notify on completion."""
    try:
        # ── Step 1: Mark record as running ──────────────────────────────────
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(Imaging)
                .where(Imaging.id == imaging_id)
                .where(Imaging.patient_id == patient_id)
            )
            imaging_record = result.scalar_one_or_none()
            if not imaging_record:
                logger.warning("Segmentation background: imaging %d not found", imaging_id)
                return

            imaging_record.segmentation_status = "running"
            await db.commit()

            if imaging_record.group_id is not None:
                group_result = await db.execute(
                    select(Imaging)
                    .where(Imaging.group_id == imaging_record.group_id)
                    .where(Imaging.patient_id == patient_id)
                )
            else:
                group_result = await db.execute(
                    select(Imaging).where(Imaging.patient_id == patient_id)
                )
            group_images = group_result.scalars().all()

            modality_urls = {
                img.image_type: _rewrite_for_mcp(img.original_url)
                for img in group_images
                if img.image_type in _MODALITY_PARAM
            }
            if imaging_record.image_type in _MODALITY_PARAM:
                modality_urls[imaging_record.image_type] = _rewrite_for_mcp(imaging_record.original_url)

            slice_idx = imaging_record.slice_index if imaging_record.slice_index is not None else -1

            patient_result = await db.execute(select(Patient).where(Patient.id == patient_id))
            patient_obj = patient_result.scalar_one_or_none()
            patient_name = patient_obj.name if patient_obj else f"Patient {patient_id}"

        # ── Step 2: Run MCP (outside DB session) ─────────────────────────────
        segmentation_payload = await _call_segmentation_mcp(
            modality_urls=modality_urls,
            patient_id=str(patient_id),
            slice_index=slice_idx,
        )

        # ── Step 3: Persist result ────────────────────────────────────────────
        ts = int(time.time())
        artifacts = segmentation_payload.get("artifacts", {})
        for key in ("overlay_image", "predmask_image", "json_summary"):
            artifact = artifacts.get(key, {})
            if "url" in artifact:
                artifact["url"] = f"{artifact['url']}?v={ts}"
        segmentation_payload["artifacts"] = artifacts

        async with AsyncSessionLocal() as db:
            result = await db.execute(select(Imaging).where(Imaging.id == imaging_id))
            imaging_record = result.scalar_one_or_none()
            if not imaging_record:
                return

            imaging_record.segmentation_result = segmentation_payload
            imaging_record.segmentation_status = "complete"

            if imaging_record.slice_index is None:
                mcp_slice = segmentation_payload.get("input", {}).get("slice_index")
                if mcp_slice is not None:
                    imaging_record.slice_index = mcp_slice

            await db.commit()

        # ── Step 4: Notify ────────────────────────────────────────────────────
        if session_id:
            await _trigger_agent_report(patient_id, patient_name, session_id, segmentation_payload)
        elif user_id:
            await _send_ws_notification(patient_id, patient_name, imaging_id, user_id, segmentation_payload)

    except Exception:
        logger.exception("Background segmentation failed for imaging %d", imaging_id)
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(Imaging).where(Imaging.id == imaging_id))
            imaging_record = result.scalar_one_or_none()
            if imaging_record:
                imaging_record.segmentation_status = "error"
                await db.commit()


async def _send_ws_notification(
    patient_id: int,
    patient_name: str,
    imaging_id: int,
    user_id: str,
    segmentation_payload: dict,
) -> None:
    """Send imaging.segmentation WS push notification to the triggering doctor."""
    overlay_url = (
        segmentation_payload.get("artifacts", {})
        .get("overlay_image", {})
        .get("url", "")
    )
    event = WSEvent(
        type=WSEventType.IMAGING_SEGMENTATION,
        payload={
            "patient_id": patient_id,
            "patient_name": patient_name,
            "imaging_id": imaging_id,
            "overlay_url": overlay_url,
        },
        target_type="user",
        target_id=user_id,
        severity="info",
    )
    await manager.send_to_user(user_id, event)
    logger.info("Sent segmentation WS notification to user=%s for patient=%d", user_id, patient_id)


async def _trigger_agent_report(
    patient_id: int,
    patient_name: str,
    session_id: int,
    segmentation_payload: dict,
) -> None:
    """Create a trigger message and dispatch the agent to interpret segmentation results."""
    from src.api.routers.chat.messages import _run_agent_background
    from src.api.routers.chat import broadcast as chat_broadcast  # noqa: F401 — module import

    overlay_url = (
        segmentation_payload.get("artifacts", {})
        .get("overlay_image", {})
        .get("url", "")
    )
    tumour_classes = segmentation_payload.get("prediction", {}).get("pred_classes_in_slice", [])
    modalities = segmentation_payload.get("input", {}).get("modalities_provided", [])

    trigger_content = (
        f"[System] BraTS segmentation for {patient_name} (patient_id={patient_id}) completed.\n"
        f"Modalities used: {', '.join(modalities)}\n"
        f"Tumour classes detected in best slice: {tumour_classes}\n"
        f"Overlay image: {overlay_url}\n\n"
        f"Please provide a concise clinical interpretation of these results, "
        f"including the overlay image using overlay_markdown format."
    )

    async with AsyncSessionLocal() as db:
        trigger_msg = ChatMessage(
            session_id=session_id,
            role="user",
            content=trigger_content,
            status="completed",
        )
        db.add(trigger_msg)
        await db.commit()

        assistant_msg = ChatMessage(
            session_id=session_id,
            role="assistant",
            content="",
            status="pending",
        )
        db.add(assistant_msg)
        await db.commit()
        await db.refresh(assistant_msg)
        assistant_msg_id = assistant_msg.id

    bg_task = asyncio.create_task(
        _run_agent_background(
            message_id=assistant_msg_id,
            session_id=session_id,
            user_id="system",
            user_message=trigger_content,
            patient_id=patient_id,
        )
    )
    chat_broadcast.register_task(assistant_msg_id, bg_task)
    logger.info(
        "Dispatched agent for segmentation report: session=%d message=%d",
        session_id,
        assistant_msg_id,
    )
