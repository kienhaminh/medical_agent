# tests/test_agent_registry.py
"""Unit tests for agent_registry — must pass without any DB."""
import pytest

def test_get_agent_config_known_role():
    from src.agent.agent_registry import get_agent_config
    config = get_agent_config("reception_triage")
    assert config is not None
    assert config["role"] == "reception_triage"
    assert config["name"] == "Reception Triage"
    assert "system_prompt" in config
    assert len(config["system_prompt"]) > 100

def test_get_agent_config_unknown_role():
    from src.agent.agent_registry import get_agent_config
    assert get_agent_config("nonexistent_role") is None

def test_list_agents_returns_all_agents():
    from src.agent.agent_registry import list_agents
    agents = list_agents()
    roles = {a["role"] for a in agents}
    assert "reception_triage" in roles
    assert "doctor_assistant" in roles
    assert "clinical_text" in roles
    assert len(agents) == 6
