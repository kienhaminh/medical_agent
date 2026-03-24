"""Tests for create_patient agent tool."""
import pytest
from unittest.mock import patch, MagicMock
from src.tools.builtin.create_patient_tool import create_patient


class TestCreatePatient:

    @patch("src.tools.builtin.create_patient_tool.SessionLocal")
    def test_create_patient_success(self, mock_session_cls):
        mock_db = MagicMock()
        mock_session_cls.return_value.__enter__ = MagicMock(return_value=mock_db)
        mock_session_cls.return_value.__exit__ = MagicMock(return_value=False)
        mock_db.add.side_effect = lambda p: setattr(p, 'id', 42)

        result = create_patient(name="Clara Nguyen", dob="1990-06-15", gender="female")
        assert "Clara Nguyen" in result
        assert mock_db.add.called
        assert mock_db.commit.called

    @patch("src.tools.builtin.create_patient_tool.SessionLocal")
    def test_create_patient_missing_name(self, mock_session_cls):
        result = create_patient(name="", dob="1990-06-15", gender="female")
        assert "Error" in result

    @patch("src.tools.builtin.create_patient_tool.SessionLocal")
    def test_create_patient_returns_id(self, mock_session_cls):
        mock_db = MagicMock()
        mock_session_cls.return_value.__enter__ = MagicMock(return_value=mock_db)
        mock_session_cls.return_value.__exit__ = MagicMock(return_value=False)
        mock_db.add.side_effect = lambda p: setattr(p, 'id', 99)

        result = create_patient(name="James Okafor", dob="1975-11-08", gender="male")
        assert "99" in result
