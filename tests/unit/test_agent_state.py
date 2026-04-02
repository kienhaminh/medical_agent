"""Unit tests for AgentState TypedDict."""

import operator
import typing
from typing import Annotated, List, Union, get_type_hints

import pytest

from src.agent.state import AgentState


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def make_state(**overrides) -> AgentState:
    """Return a minimal valid AgentState dict."""
    base: AgentState = {
        "messages": [],
        "patient_profile": {},
        "steps_taken": 0,
        "final_report": None,
    }
    base.update(overrides)
    return base


# ---------------------------------------------------------------------------
# Tests: basic initialization
# ---------------------------------------------------------------------------


class TestAgentStateInitialization:
    """Verify that AgentState can be created with all expected fields."""

    def test_default_state_has_required_keys(self):
        state = make_state()
        required_keys = {
            "messages",
            "patient_profile",
            "steps_taken",
            "final_report",
        }
        assert required_keys == set(state.keys())

    def test_messages_default_is_empty_list(self):
        state = make_state()
        assert state["messages"] == []

    def test_patient_profile_default_is_empty_dict(self):
        state = make_state()
        assert state["patient_profile"] == {}

    def test_steps_taken_default_is_zero(self):
        state = make_state()
        assert state["steps_taken"] == 0

    def test_final_report_default_is_none(self):
        state = make_state()
        assert state["final_report"] is None


# ---------------------------------------------------------------------------
# Tests: field types
# ---------------------------------------------------------------------------


class TestAgentStateFieldTypes:
    """Verify that fields accept and hold the correct Python types."""

    def test_messages_accepts_list_of_dicts(self):
        msg = {"role": "user", "content": "hello"}
        state = make_state(messages=[msg])
        assert isinstance(state["messages"], list)
        assert state["messages"][0] == msg

    def test_patient_profile_accepts_dict(self):
        profile = {"name": "Nguyen Van A", "dob": "1990-01-01"}
        state = make_state(patient_profile=profile)
        assert state["patient_profile"] == profile

    def test_steps_taken_accepts_int(self):
        state = make_state(steps_taken=5)
        assert isinstance(state["steps_taken"], int)
        assert state["steps_taken"] == 5

    def test_final_report_accepts_string(self):
        state = make_state(final_report="Patient is healthy.")
        assert isinstance(state["final_report"], str)

    def test_final_report_accepts_none(self):
        state = make_state(final_report=None)
        assert state["final_report"] is None


# ---------------------------------------------------------------------------
# Tests: messages field – operator.add annotation
# ---------------------------------------------------------------------------


class TestMessagesAnnotation:
    """Verify the Annotated[List[dict], operator.add] contract on messages."""

    def test_messages_annotation_uses_operator_add(self):
        hints = get_type_hints(AgentState, include_extras=True)
        messages_hint = hints["messages"]
        # Should be Annotated[...]
        assert typing.get_origin(messages_hint) is Annotated
        args = typing.get_args(messages_hint)
        # Second arg should be operator.add
        assert args[1] is operator.add

    def test_messages_annotation_inner_type_is_list(self):
        hints = get_type_hints(AgentState, include_extras=True)
        messages_hint = hints["messages"]
        args = typing.get_args(messages_hint)
        inner = args[0]
        assert typing.get_origin(inner) is list

    def test_operator_add_merges_two_message_lists(self):
        """operator.add is list concatenation – verify the intended semantics."""
        list_a = [{"role": "user", "content": "hi"}]
        list_b = [{"role": "assistant", "content": "hello"}]
        merged = operator.add(list_a, list_b)
        assert merged == list_a + list_b
        assert len(merged) == 2

    def test_messages_field_supports_appending(self):
        state = make_state(messages=[{"role": "user", "content": "first"}])
        new_message = {"role": "assistant", "content": "second"}
        # Simulate how LangGraph applies the reducer
        state["messages"] = operator.add(state["messages"], [new_message])
        assert len(state["messages"]) == 2
        assert state["messages"][-1] == new_message

    def test_messages_concatenation_preserves_order(self):
        msgs_a = [{"role": "user", "content": f"msg{i}"} for i in range(3)]
        msgs_b = [{"role": "assistant", "content": f"reply{i}"} for i in range(2)]
        result = operator.add(msgs_a, msgs_b)
        assert result == msgs_a + msgs_b


# ---------------------------------------------------------------------------
# Tests: mutability and state isolation
# ---------------------------------------------------------------------------


class TestAgentStateMutability:
    """Verify state dict mutations do not bleed between instances."""

    def test_two_states_are_independent(self):
        state1 = make_state(steps_taken=1)
        state2 = make_state(steps_taken=2)
        state1["steps_taken"] += 10
        assert state2["steps_taken"] == 2

    def test_messages_list_is_independent_per_state(self):
        state1 = make_state()
        state2 = make_state()
        state1["messages"].append({"role": "user", "content": "only in state1"})
        assert state2["messages"] == []

    def test_steps_taken_can_be_incremented(self):
        state = make_state(steps_taken=3)
        state["steps_taken"] += 1
        assert state["steps_taken"] == 4
