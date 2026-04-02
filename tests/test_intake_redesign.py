"""Tests for the intake redesign — prompt, classification, model, vault."""


def test_intake_system_prompt_is_nonempty_string():
    from src.prompt.intake import INTAKE_SYSTEM_PROMPT
    assert isinstance(INTAKE_SYSTEM_PROMPT, str)
    assert len(INTAKE_SYSTEM_PROMPT) > 100
    assert "ask_user_input" in INTAKE_SYSTEM_PROMPT
