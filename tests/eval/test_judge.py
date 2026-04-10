# tests/eval/test_judge.py
"""Tests for eval/judge.py — LLM-as-judge scoring."""
import json
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from eval.judge import _call_judge, _load_rubric, judge_ddx, judge_history, judge_soap


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_response(text: str):
    """Minimal mock of the Anthropic messages.create response."""
    content_block = MagicMock()
    content_block.text = text
    response = MagicMock()
    response.content = [content_block]
    return response


# ---------------------------------------------------------------------------
# _load_rubric
# ---------------------------------------------------------------------------

def test_load_rubric_ddx():
    text = _load_rubric("ddx")
    assert len(text) > 0
    assert "1" in text  # rubric has a score of 1


def test_load_rubric_history():
    assert len(_load_rubric("history")) > 0


def test_load_rubric_soap():
    assert len(_load_rubric("soap")) > 0


# ---------------------------------------------------------------------------
# _call_judge
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_call_judge_returns_parsed_json():
    valid_json = json.dumps({"clinical_accuracy": 4, "reasoning": "good"})
    mock_response = _make_response(f"Here is my score:\n{valid_json}")

    with patch("eval.judge._get_client") as mock_get_client:
        mock_client = AsyncMock()
        mock_client.messages.create = AsyncMock(return_value=mock_response)
        mock_get_client.return_value = mock_client

        result = await _call_judge("test prompt")

    assert result == {"clinical_accuracy": 4, "reasoning": "good"}


@pytest.mark.asyncio
async def test_call_judge_returns_empty_dict_on_no_json():
    mock_response = _make_response("I cannot score this.")

    with patch("eval.judge._get_client") as mock_get_client:
        mock_client = AsyncMock()
        mock_client.messages.create = AsyncMock(return_value=mock_response)
        mock_get_client.return_value = mock_client

        result = await _call_judge("test prompt")

    assert result == {}


@pytest.mark.asyncio
async def test_call_judge_returns_empty_dict_on_malformed_json():
    mock_response = _make_response("{ not valid json }")

    with patch("eval.judge._get_client") as mock_get_client:
        mock_client = AsyncMock()
        mock_client.messages.create = AsyncMock(return_value=mock_response)
        mock_get_client.return_value = mock_client

        result = await _call_judge("test prompt")

    assert result == {}


# ---------------------------------------------------------------------------
# judge_ddx
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_judge_ddx_prompt_includes_patient_summary_and_rubric():
    captured_prompt: list[str] = []

    async def capture(_prompt: str) -> dict:
        captured_prompt.append(_prompt)
        return {"clinical_accuracy": 5}

    with patch("eval.judge._call_judge", side_effect=capture):
        await judge_ddx("55yo male chest pain", "1. MI 2. Angina")

    assert len(captured_prompt) == 1
    prompt = captured_prompt[0]
    assert "55yo male chest pain" in prompt
    assert "1. MI 2. Angina" in prompt
    # Rubric content injected
    assert "1" in prompt  # rubric has scores


@pytest.mark.asyncio
async def test_judge_ddx_returns_dict():
    with patch("eval.judge._call_judge", new_callable=AsyncMock, return_value={"clinical_accuracy": 4}):
        result = await judge_ddx("patient", "ddx output")
    assert isinstance(result, dict)


# ---------------------------------------------------------------------------
# judge_history
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_judge_history_prompt_includes_history_output():
    captured: list[str] = []

    async def capture(p: str) -> dict:
        captured.append(p)
        return {}

    with patch("eval.judge._call_judge", side_effect=capture):
        await judge_history("patient context", "history text here")

    assert "history text here" in captured[0]
    assert "patient context" in captured[0]


# ---------------------------------------------------------------------------
# judge_soap
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_judge_soap_prompt_includes_soap_output():
    captured: list[str] = []

    async def capture(p: str) -> dict:
        captured.append(p)
        return {}

    with patch("eval.judge._call_judge", side_effect=capture):
        await judge_soap("patient context", "S: chief complaint\nO: vitals\nA: assessment\nP: plan")

    assert "S: chief complaint" in captured[0]
    assert "patient context" in captured[0]
