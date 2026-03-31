"""Unit tests for TeamConsultationHandler — mocks all LLM calls."""
import uuid
import pytest
from dataclasses import dataclass
from typing import Optional
from unittest.mock import AsyncMock, MagicMock, patch

from src.agent.team_consultation_handler import TeamConsultationHandler, SPECIALIST_ROSTER


# ──────────────────────────────────────────────
# _format_thread
# ──────────────────────────────────────────────

def _make_msg(sender_type, role, content, round_num=1):
    msg = MagicMock()
    msg.sender_type = sender_type
    msg.specialist_role = role
    msg.content = content
    msg.round = round_num
    return msg


def test_format_thread_empty():
    handler = TeamConsultationHandler(llm=MagicMock())
    assert handler._format_thread([]) == ""


def test_format_thread_specialist_messages():
    handler = TeamConsultationHandler(llm=MagicMock())
    msgs = [
        _make_msg("specialist", "cardiologist", "ECG normal."),
        _make_msg("specialist", "internist", "Vitals stable."),
    ]
    result = handler._format_thread(msgs)
    assert "[Cardiologist] ECG normal." in result
    assert "[Internist] Vitals stable." in result


def test_format_thread_chief_message():
    handler = TeamConsultationHandler(llm=MagicMock())
    msgs = [_make_msg("chief", None, "Please address anticoagulation risk.")]
    result = handler._format_thread(msgs)
    assert "[Chief Director] Please address anticoagulation risk." in result


# ──────────────────────────────────────────────
# _parse_stance
# ──────────────────────────────────────────────

def test_parse_stance_detects_agreement():
    handler = TeamConsultationHandler(llm=MagicMock())
    content = "I agree with cardiologist that the ECG is normal."
    agrees, challenges = handler._parse_stance(content, ["cardiologist", "internist"])
    assert "cardiologist" in agrees


def test_parse_stance_detects_challenge():
    handler = TeamConsultationHandler(llm=MagicMock())
    content = "I disagree with nephrologist on the fluid management approach."
    agrees, challenges = handler._parse_stance(content, ["nephrologist", "internist"])
    assert "nephrologist" in challenges


def test_parse_stance_empty_when_no_keywords():
    handler = TeamConsultationHandler(llm=MagicMock())
    agrees, challenges = handler._parse_stance("Patient needs monitoring.", ["internist"])
    assert agrees is None
    assert challenges is None


# ──────────────────────────────────────────────
# _select_team (mocked LLM)
# ──────────────────────────────────────────────

@pytest.mark.asyncio
async def test_select_team_returns_valid_roles():
    llm = AsyncMock()
    llm.ainvoke = AsyncMock(return_value=MagicMock(content="cardiologist, pulmonologist, internist"))
    handler = TeamConsultationHandler(llm=llm)
    team = await handler._select_team("Patient with chest pain and SOB.")
    assert "cardiologist" in team
    assert "internist" in team  # always included
    for role in team:
        assert role in SPECIALIST_ROSTER


@pytest.mark.asyncio
async def test_select_team_always_includes_internist():
    llm = AsyncMock()
    # LLM returns only one specialist without internist
    llm.ainvoke = AsyncMock(return_value=MagicMock(content="cardiologist"))
    handler = TeamConsultationHandler(llm=llm)
    team = await handler._select_team("Any case.")
    assert "internist" in team


@pytest.mark.asyncio
async def test_select_team_filters_invalid_roles():
    llm = AsyncMock()
    llm.ainvoke = AsyncMock(return_value=MagicMock(content="cardiologist, wizard, internist"))
    handler = TeamConsultationHandler(llm=llm)
    team = await handler._select_team("Any case.")
    assert "wizard" not in team


# ──────────────────────────────────────────────
# _write_brief (mocked LLM)
# ──────────────────────────────────────────────

@pytest.mark.asyncio
async def test_write_brief_returns_llm_content():
    llm = AsyncMock()
    llm.ainvoke = AsyncMock(return_value=MagicMock(content="Patient: 60yo M\nChief complaint: chest pain"))
    handler = TeamConsultationHandler(llm=llm)
    brief = await handler._write_brief("60yo male with chest pain.")
    assert "chest pain" in brief


# ──────────────────────────────────────────────
# _chief_review (mocked LLM)
# ──────────────────────────────────────────────

@pytest.mark.asyncio
async def test_chief_review_converged():
    llm = AsyncMock()
    llm.ainvoke = AsyncMock(return_value=MagicMock(content="CONVERGED: yes\nDIRECTIVE:"))
    handler = TeamConsultationHandler(llm=llm)
    msgs = [_make_msg("specialist", "cardiologist", "All good.")]
    directive = await handler._chief_review("brief", msgs, 1)
    assert directive.converged is True
    assert directive.message is None


@pytest.mark.asyncio
async def test_chief_review_not_converged_with_directive():
    llm = AsyncMock()
    llm.ainvoke = AsyncMock(return_value=MagicMock(
        content="CONVERGED: no\nDIRECTIVE: Cardiologist please address anticoagulation."
    ))
    handler = TeamConsultationHandler(llm=llm)
    msgs = [_make_msg("specialist", "cardiologist", "Uncertain about anticoagulation.")]
    directive = await handler._chief_review("brief", msgs, 1)
    assert directive.converged is False
    assert "anticoagulation" in directive.message


@pytest.mark.asyncio
async def test_chief_review_not_converged_no_directive():
    llm = AsyncMock()
    llm.ainvoke = AsyncMock(return_value=MagicMock(content="CONVERGED: no\nDIRECTIVE:"))
    handler = TeamConsultationHandler(llm=llm)
    directive = await handler._chief_review("brief", [], 1)
    assert directive.converged is False
    assert directive.message is None
