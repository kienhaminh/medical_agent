"""Tests for find_patient agent tool."""
import pytest
from unittest.mock import patch, MagicMock
from src.tools.builtin.find_patient_tool import find_patient


class TestFindPatient:
    """Test patient search functionality."""

    @patch("src.tools.builtin.find_patient_tool.SessionLocal")
    def test_find_by_exact_name(self, mock_session_cls):
        mock_db = MagicMock()
        mock_session_cls.return_value.__enter__ = MagicMock(return_value=mock_db)
        mock_session_cls.return_value.__exit__ = MagicMock(return_value=False)

        mock_patient = MagicMock()
        mock_patient.id = 1
        mock_patient.name = "Clara Nguyen"
        mock_patient.dob = "1990-06-15"
        mock_patient.gender = "female"
        mock_db.execute.return_value.scalars.return_value.all.return_value = [mock_patient]

        result = find_patient(name="Clara Nguyen")
        assert "Clara Nguyen" in result
        assert "1990-06-15" in result

    @patch("src.tools.builtin.find_patient_tool.SessionLocal")
    def test_find_no_results(self, mock_session_cls):
        mock_db = MagicMock()
        mock_session_cls.return_value.__enter__ = MagicMock(return_value=mock_db)
        mock_session_cls.return_value.__exit__ = MagicMock(return_value=False)
        mock_db.execute.return_value.scalars.return_value.all.return_value = []

        result = find_patient(name="Nobody Here")
        assert "No patients found" in result

    @patch("src.tools.builtin.find_patient_tool.SessionLocal")
    def test_find_with_dob_filter(self, mock_session_cls):
        mock_db = MagicMock()
        mock_session_cls.return_value.__enter__ = MagicMock(return_value=mock_db)
        mock_session_cls.return_value.__exit__ = MagicMock(return_value=False)
        mock_db.execute.return_value.scalars.return_value.all.return_value = []

        find_patient(name="Clara", dob="1990-06-15")
        assert mock_db.execute.called
