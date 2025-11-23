"""Tests for patient query tool."""

import pytest
from unittest.mock import MagicMock, patch
from datetime import datetime

from src.tools.builtin.patient_tool import query_patient_info
from src.config.database import Patient, MedicalRecord

class TestPatientTool:
    """Test suite for patient query tool."""
    
    @pytest.fixture
    def mock_session(self):
        """Mock database session."""
        with patch("src.tools.builtin.patient_tool.SessionLocal") as mock_session_local:
            session = MagicMock()
            mock_session_local.return_value = session
            yield session

    def test_query_by_id_found(self, mock_session):
        """Test querying patient by ID."""
        # Mock patient
        patient = Patient(
            id=1,
            name="John Doe",
            dob="1980-01-01",
            gender="Male",
            created_at=datetime.now()
        )
        
        # Mock records
        record = MedicalRecord(
            id=101,
            patient_id=1,
            record_type="text",
            content="Title: Checkup\n\nPatient is healthy.",
            summary="Routine checkup",
            created_at=datetime.now()
        )
        
        # Setup mock returns
        # First query is for patient by ID
        mock_session.execute.return_value.scalar_one_or_none.return_value = patient
        
        # Second query is for records
        mock_session.execute.return_value.scalars.return_value.all.return_value = [record]
        
        result = query_patient_info("1")
        
        assert "John Doe" in result
        assert "ID: 1" in result
        assert "Checkup" in result
        assert "No patient found" not in result

    def test_query_by_name_found(self, mock_session):
        """Test querying patient by Name."""
        patient = Patient(
            id=2,
            name="Jane Smith",
            dob="1990-05-15",
            gender="Female",
            created_at=datetime.now()
        )
        
        # Setup mock returns
        # First query (by ID) fails with ValueError, so it goes to except block
        # Second query (by Name) returns patient
        mock_session.execute.return_value.scalars.return_value.first.return_value = patient
        
        # Mock no records
        mock_session.execute.return_value.scalars.return_value.all.return_value = []
        
        result = query_patient_info("Jane")
        
        assert "Jane Smith" in result
        assert "ID: 2" in result
        assert "No records found" in result

    def test_patient_not_found(self, mock_session):
        """Test querying non-existent patient."""
        # Mock ID query returning None
        mock_session.execute.return_value.scalar_one_or_none.return_value = None
        
        result = query_patient_info("999")
        
        assert "No patient found" in result
        assert "999" in result

    def test_database_error(self, mock_session):
        """Test handling database errors."""
        mock_session.execute.side_effect = Exception("DB Connection Failed")
        
        result = query_patient_info("1")
        
        assert "Error querying patient info" in result
        assert "DB Connection Failed" in result
