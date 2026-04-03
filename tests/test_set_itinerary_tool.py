"""Unit tests for set_itinerary tool."""
from unittest.mock import MagicMock, patch
from datetime import datetime


def _make_session_mock(*execute_results):
    mock_db = MagicMock()
    mock_db.execute.side_effect = list(execute_results)
    mock_cls = MagicMock()
    mock_cls.return_value.__enter__ = MagicMock(return_value=mock_db)
    mock_cls.return_value.__exit__ = MagicMock(return_value=False)
    return mock_cls, mock_db


def _scalar(val):
    r = MagicMock()
    r.scalar_one_or_none.return_value = val
    return r


def _scalars_all(items):
    r = MagicMock()
    r.scalars.return_value.all.return_value = items
    return r


def test_set_itinerary_unknown_visit_returns_error():
    mock_cls, _ = _make_session_mock(_scalar(None))
    with patch("src.tools.set_itinerary_tool.SessionLocal", mock_cls):
        from src.tools.set_itinerary_tool import set_itinerary
        result = set_itinerary(visit_id=9999, steps=[])
    assert "not found" in result.lower()


def test_set_itinerary_creates_registration_step_and_agent_steps():
    mock_visit = MagicMock()
    mock_visit.id = 1
    mock_visit.visit_id = "VIS-20260403-001"

    mock_cls, mock_db = _make_session_mock(
        _scalar(mock_visit),    # visit lookup
        _scalars_all([]),       # clear existing steps
    )

    steps = [
        {"order": 1, "department": "ent", "label": "ENT Department",
         "description": "Ear exam", "room": "Room 204"},
        {"order": 2, "department": None, "label": "Blood Test Lab",
         "description": "CBC panel", "room": "Lab A"},
    ]

    with patch("src.tools.set_itinerary_tool.SessionLocal", mock_cls):
        from src.tools.set_itinerary_tool import set_itinerary
        result = set_itinerary(visit_id=1, steps=steps)

    # Registration step + 2 agent steps = 3 adds
    assert mock_db.add.call_count == 3
    assert "Itinerary set" in result
    assert "/track/VIS-20260403-001" in result


def test_set_itinerary_registration_step_is_done():
    mock_visit = MagicMock()
    mock_visit.id = 1
    mock_visit.visit_id = "VIS-20260403-001"

    mock_cls, mock_db = _make_session_mock(
        _scalar(mock_visit),
        _scalars_all([]),
    )

    with patch("src.tools.set_itinerary_tool.SessionLocal", mock_cls):
        from src.tools.set_itinerary_tool import set_itinerary
        set_itinerary(visit_id=1, steps=[
            {"order": 1, "department": "ent", "label": "ENT", "description": "exam"}
        ])

    # First add call = Registration step (step_order=1, status=done)
    reg_step = mock_db.add.call_args_list[0][0][0]
    assert reg_step.status == "done"
    assert reg_step.step_order == 1
    assert "Registration" in reg_step.label

    # Second add call = first agent step (step_order=2, status=active)
    first_step = mock_db.add.call_args_list[1][0][0]
    assert first_step.status == "active"
    assert first_step.step_order == 2


def test_set_itinerary_registered_in_tool_registry():
    from src.tools.registry import ToolRegistry
    import src.tools.set_itinerary_tool  # noqa: trigger registration
    reg = ToolRegistry()
    names = [t.name for t in reg.list_tools()]
    assert "set_itinerary" in names
