"""Intake flow tests — new patient and returning patient (re-visit) scenarios.

Covers the three tools that form the intake pipeline:
  identify_patient (vault) → create_visit (tool) → complete_triage (tool)

Two end-to-end scenarios:
  1. New patient: first-time registration, visit created and linked to the
     intake chat session, high-confidence routing auto-assigns department.
  2. Returning patient (re-visit): existing patient found by name+DOB, a new
     visit is created for the same patient_id, triage routes again.
"""
import pytest
from unittest.mock import patch, MagicMock, AsyncMock, call


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_sync_session_mock(*execute_side_effects):
    """Return (mock_sessionlocal_cls, mock_db) for sync SessionLocal.

    execute_side_effects: positional MagicMock results, returned in order.
    """
    mock_db = MagicMock()
    mock_db.execute.side_effect = list(execute_side_effects)

    mock_cls = MagicMock()
    mock_cls.return_value.__enter__ = MagicMock(return_value=mock_db)
    mock_cls.return_value.__exit__ = MagicMock(return_value=False)
    return mock_cls, mock_db


def _scalar(value):
    """Return a MagicMock whose .scalar_one_or_none() returns value."""
    r = MagicMock()
    r.scalar_one_or_none.return_value = value
    return r


def _scalars_all(items):
    """Return a MagicMock whose .scalars().all() returns items."""
    r = MagicMock()
    r.scalars.return_value.all.return_value = items
    return r


def _scalar_val(value):
    """Return a MagicMock whose .scalar() (not scalar_one_or_none) returns value."""
    r = MagicMock()
    r.scalar.return_value = value
    return r


def _make_async_session_mock(*execute_side_effects):
    """Return (mock_asyncsessionlocal_cls, mock_db) for async AsyncSessionLocal."""
    mock_db = AsyncMock()
    mock_db.execute.side_effect = list(execute_side_effects)

    mock_ctx = AsyncMock()
    mock_ctx.__aenter__ = AsyncMock(return_value=mock_db)
    mock_ctx.__aexit__ = AsyncMock(return_value=False)

    mock_cls = MagicMock(return_value=mock_ctx)
    return mock_cls, mock_db


# ---------------------------------------------------------------------------
# Section 1: identify_patient (vault)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_identify_patient_creates_new_patient():
    """identify_patient returns (id, True) and creates a Patient row when not found."""
    answers = {
        "first_name": "Emma", "last_name": "Stone",
        "dob": "1995-03-20", "gender": "female",
    }
    new_patient = MagicMock()
    new_patient.id = 101

    mock_cls, mock_db = _make_async_session_mock(_scalar(None))  # lookup → not found
    mock_db.refresh.side_effect = AsyncMock(side_effect=lambda obj: setattr(obj, "id", 101))

    with patch("src.forms.vault.AsyncSessionLocal", mock_cls):
        from src.forms.vault import identify_patient
        patient_id, is_new = await identify_patient(answers)

    assert patient_id == 101
    assert is_new is True
    mock_db.add.assert_called_once()
    mock_db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_identify_patient_returns_existing_patient():
    """identify_patient returns (id, False) and does NOT insert when patient found."""
    answers = {
        "first_name": "Emma", "last_name": "Stone",
        "dob": "1995-03-20", "gender": "female",
    }
    existing = MagicMock()
    existing.id = 55

    mock_cls, mock_db = _make_async_session_mock(_scalar(existing))

    with patch("src.forms.vault.AsyncSessionLocal", mock_cls):
        from src.forms.vault import identify_patient
        patient_id, is_new = await identify_patient(answers)

    assert patient_id == 55
    assert is_new is False
    mock_db.add.assert_not_called()


@pytest.mark.asyncio
async def test_identify_patient_raises_on_missing_fields():
    """identify_patient raises ValueError when required fields are absent."""
    from src.forms.vault import identify_patient
    with pytest.raises(ValueError, match="missing required fields"):
        await identify_patient({"first_name": "Only"})


# ---------------------------------------------------------------------------
# Section 2: create_visit tool
# ---------------------------------------------------------------------------

def test_create_visit_links_to_existing_session():
    """create_visit reuses the intake chat session from current_session_id_var."""
    from src.tools.form_request_registry import current_session_id_var

    mock_patient = MagicMock()
    mock_patient.id = 10
    mock_patient.name = "Emma Stone"

    mock_session = MagicMock()
    mock_session.id = 42

    mock_visit = MagicMock()
    mock_visit.visit_id = "VIS-20260403-001"
    mock_visit.id = 7

    mock_cls, mock_db = _make_sync_session_mock(
        _scalar(mock_patient),   # patient lookup
        _scalar(None),           # no existing INTAKE visit
        _scalar(None),           # no prior visit_id for today
        _scalar(mock_session),   # ChatSession lookup by current_session_id
    )

    def _fake_refresh(obj):
        obj.id = 7
        obj.visit_id = "VIS-20260403-001"

    mock_db.refresh.side_effect = _fake_refresh

    token = current_session_id_var.set(42)
    try:
        with patch("src.tools.create_visit_tool.SessionLocal", mock_cls):
            from src.tools.create_visit_tool import create_visit
            result = create_visit(patient_id=10)
    finally:
        current_session_id_var.reset(token)

    assert "Visit created successfully" in result
    # Confirm the added Visit uses the existing session id, not a new one
    added_visit = mock_db.add.call_args[0][0]
    assert added_visit.intake_session_id == 42


def test_create_visit_creates_new_session_when_no_context():
    """create_visit creates a fresh ChatSession when no current_session_id_var is set."""
    from src.tools.form_request_registry import current_session_id_var

    mock_patient = MagicMock()
    mock_patient.id = 20
    mock_patient.name = "New Patient"

    mock_cls, mock_db = _make_sync_session_mock(
        _scalar(mock_patient),  # patient lookup
        _scalar(None),          # no existing INTAKE visit
        _scalar(None),          # no prior visit_id for today
        # no ChatSession lookup — var is unset
    )

    new_session = MagicMock()
    new_session.id = 99

    call_count = [0]
    def _fake_refresh(obj):
        call_count[0] += 1
        if call_count[0] == 1:
            # First refresh is the new ChatSession
            obj.id = 99
        else:
            # Second refresh is the Visit
            obj.id = 8
            obj.visit_id = "VIS-20260403-002"

    mock_db.refresh.side_effect = _fake_refresh

    # Ensure var has no value
    token = current_session_id_var.set(None)
    try:
        with patch("src.tools.create_visit_tool.SessionLocal", mock_cls):
            from src.tools.create_visit_tool import create_visit
            result = create_visit(patient_id=20)
    finally:
        current_session_id_var.reset(token)

    assert "Visit created successfully" in result
    # A new ChatSession was added before the Visit
    assert mock_db.add.call_count == 2  # ChatSession + Visit
    assert mock_db.flush.called


def test_create_visit_rejects_duplicate_active_intake():
    """create_visit returns an error string if an INTAKE visit already exists."""
    mock_patient = MagicMock()
    mock_patient.id = 30
    mock_patient.name = "Duplicate"

    mock_existing_visit = MagicMock()
    mock_existing_visit.id = 3
    mock_existing_visit.visit_id = "VIS-20260403-003"

    mock_cls, _ = _make_sync_session_mock(
        _scalar(mock_patient),        # patient lookup
        _scalar(mock_existing_visit), # existing INTAKE visit found
    )

    with patch("src.tools.create_visit_tool.SessionLocal", mock_cls):
        from src.tools.create_visit_tool import create_visit
        result = create_visit(patient_id=30)

    assert "already has an active intake visit" in result
    assert "VIS-20260403-003" in result


def test_create_visit_unknown_patient_returns_error():
    """create_visit returns an error string for a non-existent patient_id."""
    mock_cls, _ = _make_sync_session_mock(
        _scalar(None),  # patient not found
    )

    with patch("src.tools.create_visit_tool.SessionLocal", mock_cls):
        from src.tools.create_visit_tool import create_visit
        result = create_visit(patient_id=9999)

    assert "not found" in result.lower()


# ---------------------------------------------------------------------------
# Section 3: complete_triage tool
# ---------------------------------------------------------------------------

def _make_dept(name, label):
    d = MagicMock()
    d.name = name
    d.label = label
    return d


def test_complete_triage_high_confidence_auto_routes():
    """confidence >= 0.70 sets status=in_department and assigns queue position."""
    mock_visit = MagicMock()
    mock_visit.id = 1
    mock_visit.visit_id = "VIS-20260403-001"
    mock_visit.status = "intake"
    mock_visit.chief_complaint = None
    mock_visit.intake_notes = None

    depts = [
        _make_dept("gastroenterology", "Gastroenterology"),
        _make_dept("cardiology", "Cardiology"),
    ]

    mock_cls, mock_db = _make_sync_session_mock(
        _scalar(mock_visit),     # visit lookup
        _scalars_all(depts),     # departments
        _scalar_val(0),          # max queue_position = 0 → assign 1
    )

    with patch("src.tools.complete_triage_tool.SessionLocal", mock_cls):
        from src.tools.complete_triage_tool import complete_triage
        result = complete_triage(
            id=1,
            chief_complaint="Persistent stomach pain after meals",
            intake_notes="3-week history, pain worse after eating, no fever",
            routing_suggestion=["gastroenterology"],
            confidence=0.85,
        )

    assert "Auto-routed" in result
    assert mock_visit.status == "in_department"
    assert mock_visit.current_department == "gastroenterology"
    assert mock_visit.queue_position == 1


def test_complete_triage_low_confidence_sends_to_review():
    """confidence < 0.70 sets status=pending_review for doctor triage."""
    mock_visit = MagicMock()
    mock_visit.id = 2
    mock_visit.visit_id = "VIS-20260403-002"
    mock_visit.status = "intake"

    depts = [_make_dept("internal_medicine", "Internal Medicine")]

    mock_cls, mock_db = _make_sync_session_mock(
        _scalar(mock_visit),
        _scalars_all(depts),
    )

    with patch("src.tools.complete_triage_tool.SessionLocal", mock_cls):
        from src.tools.complete_triage_tool import complete_triage
        result = complete_triage(
            id=2,
            chief_complaint="Fatigue and weight loss",
            intake_notes="Non-specific symptoms, unclear origin",
            routing_suggestion=["internal_medicine"],
            confidence=0.50,
        )

    assert "doctor for review" in result
    assert mock_visit.status == "pending_review"


def test_complete_triage_normalizes_department_label():
    """complete_triage maps label 'Gastroenterology' to name key 'gastroenterology'."""
    mock_visit = MagicMock()
    mock_visit.id = 3
    mock_visit.status = "intake"

    depts = [_make_dept("gastroenterology", "Gastroenterology")]

    mock_cls, _ = _make_sync_session_mock(
        _scalar(mock_visit),
        _scalars_all(depts),
        _scalar_val(2),  # existing queue depth = 2 → assign 3
    )

    with patch("src.tools.complete_triage_tool.SessionLocal", mock_cls):
        from src.tools.complete_triage_tool import complete_triage
        result = complete_triage(
            id=3,
            chief_complaint="Bloating",
            intake_notes="GI symptoms",
            routing_suggestion=["Gastroenterology"],  # label, not key
            confidence=0.90,
        )

    assert mock_visit.current_department == "gastroenterology"
    assert mock_visit.queue_position == 3


def test_complete_triage_unknown_visit_returns_error():
    """complete_triage returns an error string for a non-existent visit id."""
    mock_cls, _ = _make_sync_session_mock(_scalar(None))

    with patch("src.tools.complete_triage_tool.SessionLocal", mock_cls):
        from src.tools.complete_triage_tool import complete_triage
        result = complete_triage(
            id=9999,
            chief_complaint="x",
            intake_notes="x",
            routing_suggestion=["cardiology"],
            confidence=0.9,
        )

    assert "not found" in result.lower()


def test_complete_triage_wrong_status_returns_error():
    """complete_triage returns an error if visit is not in intake status."""
    mock_visit = MagicMock()
    mock_visit.id = 5
    mock_visit.status = "in_department"

    mock_cls, _ = _make_sync_session_mock(_scalar(mock_visit))

    with patch("src.tools.complete_triage_tool.SessionLocal", mock_cls):
        from src.tools.complete_triage_tool import complete_triage
        result = complete_triage(
            id=5,
            chief_complaint="x",
            intake_notes="x",
            routing_suggestion=["cardiology"],
            confidence=0.9,
        )

    assert "not in intake status" in result.lower()


# ---------------------------------------------------------------------------
# Section 4: Form-response endpoint — identify_patient template
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_form_response_identify_patient_new():
    """POST form-response with identify_patient template returns patient_not_found for new patient."""
    import asyncio
    from httpx import AsyncClient, ASGITransport
    from src.api.server import app
    from src.tools.form_request_registry import FormRequestRegistry

    reg = FormRequestRegistry()
    reg.reset()

    # Pre-register form so registry knows the template
    event = asyncio.Event()
    reg.register_form("form-new-001", event, "identify_patient")

    with patch("src.api.routers.chat.messages.identify_patient", new=AsyncMock(return_value=(201, True))):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post(
                "/api/chat/1/form-response",
                json={
                    "form_id": "form-new-001",
                    "answers": {
                        "first_name": "Lucas", "last_name": "Rivera",
                        "dob": "2000-07-04", "gender": "male",
                    },
                },
            )

    assert resp.status_code == 200
    assert event.is_set()
    result = reg.get_form_result("form-new-001")
    assert "patient_not_found" in result
    assert "patient_id=201" in result

    reg.reset()


@pytest.mark.asyncio
async def test_form_response_identify_patient_returning():
    """POST form-response with identify_patient template returns patient_found for existing patient."""
    import asyncio
    from httpx import AsyncClient, ASGITransport
    from src.api.server import app
    from src.tools.form_request_registry import FormRequestRegistry

    reg = FormRequestRegistry()
    reg.reset()

    event = asyncio.Event()
    reg.register_form("form-ret-001", event, "identify_patient")

    with patch("src.api.routers.chat.messages.identify_patient", new=AsyncMock(return_value=(55, False))):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post(
                "/api/chat/1/form-response",
                json={
                    "form_id": "form-ret-001",
                    "answers": {
                        "first_name": "Emma", "last_name": "Stone",
                        "dob": "1995-03-20", "gender": "female",
                    },
                },
            )

    assert resp.status_code == 200
    result = reg.get_form_result("form-ret-001")
    assert "patient_found" in result
    assert "patient_id=55" in result
    assert "returning patient" in result

    reg.reset()


# ---------------------------------------------------------------------------
# Section 5: Full intake flow scenarios
# ---------------------------------------------------------------------------

def _mock_create_visit_call(patient_id, session_id, visit_db_id, visit_str_id):
    """Build the mock chain needed to successfully call create_visit()."""
    mock_patient = MagicMock()
    mock_patient.id = patient_id
    mock_patient.name = "Test Patient"

    mock_session = MagicMock()
    mock_session.id = session_id

    mock_cls, mock_db = _make_sync_session_mock(
        _scalar(mock_patient),   # patient lookup
        _scalar(None),           # no existing INTAKE visit
        _scalar(None),           # no prior visit_id today
        _scalar(mock_session),   # ChatSession lookup
    )

    def _fake_refresh(obj):
        obj.id = visit_db_id
        obj.visit_id = visit_str_id

    mock_db.refresh.side_effect = _fake_refresh
    return mock_cls, mock_db


def _mock_complete_triage_call(visit_db_id, department):
    """Build the mock chain needed to successfully call complete_triage()."""
    mock_visit = MagicMock()
    mock_visit.id = visit_db_id
    mock_visit.status = "intake"
    mock_visit.visit_id = f"VIS-TEST-{visit_db_id:03d}"

    depts = [_make_dept(department, department.capitalize())]

    mock_cls, mock_db = _make_sync_session_mock(
        _scalar(mock_visit),
        _scalars_all(depts),
        _scalar_val(0),  # queue empty → position 1
    )
    return mock_cls, mock_db, mock_visit


@pytest.mark.asyncio
async def test_new_patient_full_intake_flow():
    """New patient: identify → create_visit links to session → complete_triage routes.

    Verifies the three-step chain in sequence, confirming each step
    passes the right IDs to the next.
    """
    from src.tools.form_request_registry import current_session_id_var

    # Step 1: identify_patient → new patient, patient_id=201
    mock_vault_cls, mock_vault_db = _make_async_session_mock(_scalar(None))
    mock_vault_db.refresh.side_effect = AsyncMock(
        side_effect=lambda obj: setattr(obj, "id", 201)
    )

    with patch("src.forms.vault.AsyncSessionLocal", mock_vault_cls):
        from src.forms.vault import identify_patient
        patient_id, is_new = await identify_patient({
            "first_name": "Jordan", "last_name": "Park",
            "dob": "1988-11-15", "gender": "male",
        })
    assert patient_id == 201
    assert is_new is True

    # Step 2: create_visit with current_session_id_var set to session 77
    cv_cls, cv_db = _mock_create_visit_call(
        patient_id=201, session_id=77, visit_db_id=12, visit_str_id="VIS-20260403-012"
    )
    token = current_session_id_var.set(77)
    try:
        with patch("src.tools.create_visit_tool.SessionLocal", cv_cls):
            from src.tools.create_visit_tool import create_visit
            cv_result = create_visit(patient_id=201)
    finally:
        current_session_id_var.reset(token)

    assert "Visit created successfully" in cv_result
    assert "VIS-20260403-012" in cv_result
    # Visit must be linked to session 77
    added_visit = cv_db.add.call_args[0][0]
    assert added_visit.intake_session_id == 77

    # Step 3: complete_triage auto-routes to gastroenterology
    ct_cls, _, ct_visit = _mock_complete_triage_call(
        visit_db_id=12, department="gastroenterology"
    )
    with patch("src.tools.complete_triage_tool.SessionLocal", ct_cls):
        from src.tools.complete_triage_tool import complete_triage
        ct_result = complete_triage(
            id=12,
            chief_complaint="Persistent stomach pain after meals",
            intake_notes="3-week history. Pain worse post-meal. No fever.",
            routing_suggestion=["gastroenterology"],
            confidence=0.88,
        )

    assert "Auto-routed" in ct_result
    assert ct_visit.status == "in_department"
    assert ct_visit.current_department == "gastroenterology"
    assert ct_visit.queue_position == 1


@pytest.mark.asyncio
async def test_returning_patient_creates_new_visit():
    """Returning patient: identify returns existing patient_id, new visit created.

    Verifies that a re-visit does NOT create a duplicate Patient and that
    complete_triage correctly routes the second visit independently.
    """
    from src.tools.form_request_registry import current_session_id_var

    # Step 1: identify_patient → existing patient (is_new=False)
    existing_patient = MagicMock()
    existing_patient.id = 55
    mock_vault_cls, mock_vault_db = _make_async_session_mock(_scalar(existing_patient))

    with patch("src.forms.vault.AsyncSessionLocal", mock_vault_cls):
        from src.forms.vault import identify_patient
        patient_id, is_new = await identify_patient({
            "first_name": "Emma", "last_name": "Stone",
            "dob": "1995-03-20", "gender": "female",
        })
    assert patient_id == 55
    assert is_new is False
    mock_vault_db.add.assert_not_called()  # no new Patient row

    # Step 2: create_visit for the re-visit — same patient_id, new visit
    cv_cls, cv_db = _mock_create_visit_call(
        patient_id=55, session_id=88, visit_db_id=20, visit_str_id="VIS-20260403-020"
    )
    token = current_session_id_var.set(88)
    try:
        with patch("src.tools.create_visit_tool.SessionLocal", cv_cls):
            from src.tools.create_visit_tool import create_visit
            cv_result = create_visit(patient_id=55)
    finally:
        current_session_id_var.reset(token)

    assert "Visit created successfully" in cv_result
    added_visit = cv_db.add.call_args[0][0]
    assert added_visit.patient_id == 55
    assert added_visit.intake_session_id == 88

    # Step 3: complete_triage routes re-visit to cardiology
    ct_cls, _, ct_visit = _mock_complete_triage_call(
        visit_db_id=20, department="cardiology"
    )
    with patch("src.tools.complete_triage_tool.SessionLocal", ct_cls):
        from src.tools.complete_triage_tool import complete_triage
        ct_result = complete_triage(
            id=20,
            chief_complaint="Chest tightness on exertion",
            intake_notes="Returning patient. New symptom onset 2 weeks ago.",
            routing_suggestion=["cardiology"],
            confidence=0.78,
        )

    assert "Auto-routed" in ct_result
    assert ct_visit.status == "in_department"
    assert ct_visit.current_department == "cardiology"
