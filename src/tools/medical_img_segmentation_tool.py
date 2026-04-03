"""Agent tool to call external BraTS segmentation MCP server."""

import asyncio
import json
import os
from typing import Any

from mcp import ClientSession
from mcp.client.streamable_http import streamablehttp_client

from src.tools.registry import ToolRegistry


def _mcp_url() -> str:
    """Resolve MCP endpoint from environment."""
    # Docker compose maps segmentation MCP service to localhost:8010.
    return os.getenv("SEGMENTATION_MCP_URL", "http://localhost:8010/mcp")


async def _call_segmentation_mcp(
    image_url: str,
    patient_id: str = "remote",
    slice_index: int = -1,
    fold: int = 3,
    alpha: float = 0.45,
) -> dict[str, Any]:
    url = _mcp_url()
    async with streamablehttp_client(url) as (read_stream, write_stream, _):
        async with ClientSession(read_stream, write_stream) as session:
            await session.initialize()
            tool_result = await session.call_tool(
                "segment_brats_from_link",
                arguments={
                    "image_url": image_url,
                    "patient_id": patient_id,
                    "slice_index": slice_index,
                    "fold": fold,
                    "alpha": alpha,
                },
            )

            # Prefer structured payload if server provides it.
            if getattr(tool_result, "structuredContent", None):
                return tool_result.structuredContent

            # Fallback: parse first text content as JSON if possible.
            if getattr(tool_result, "content", None):
                for content in tool_result.content:
                    text = getattr(content, "text", None)
                    if text:
                        try:
                            return json.loads(text)
                        except Exception:
                            return {"status": "unknown", "raw_text": text}

            return {"status": "unknown", "raw_result": str(tool_result)}


def segment_image(
    image_url: str,
) -> str:
    """Run BraTS segmentation by delegating to MCP server.

    Args:
        image_url: URL to flair NIfTI file ending with `_flair.nii.gz`.

    Returns:
        JSON string containing segmentation result metadata and artifact URLs.
    """
    try:
        payload = asyncio.run(
            _call_segmentation_mcp(
                image_url=image_url,
            )
        )
        return json.dumps(payload, ensure_ascii=True)
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
    segment_image,
    scope="global",
    symbol="segment_image",
    allow_overwrite=True,
)

