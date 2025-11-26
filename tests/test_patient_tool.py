
import unittest
import sys
from unittest.mock import MagicMock, patch
from dotenv import load_dotenv

# Mock langchain_core to avoid dependency issues during testing
sys.modules["langchain_core"] = MagicMock()
sys.modules["langchain_core.tools"] = MagicMock()

load_dotenv()

from src.tools.builtin.patient_tool import query_patient_info
from src.config.database import Patient

class TestPatientTool(unittest.TestCase):

    @patch('src.tools.builtin.patient_tool.SessionLocal')
    def test_query_patient_info_by_id(self, mock_session_local):
        # Setup mock session and patient
        mock_session = MagicMock()
        mock_session_local.return_value = mock_session
        
        mock_patient = Patient(id=24, name="Christopher Jones", dob="1997-10-03", gender="female")
        
        # Mock execute result for ID search
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_patient
        mock_result.scalars.return_value.all.return_value = [] # No records/imaging
        
        mock_session.execute.return_value = mock_result

        # Test with direct ID string
        result = query_patient_info("24")
        self.assertIn("Patient Found: Christopher Jones (ID: 24)", result)

    @patch('src.tools.builtin.patient_tool.SessionLocal')
    def test_query_patient_info_by_embedded_id(self, mock_session_local):
        # Setup mock session and patient
        mock_session = MagicMock()
        mock_session_local.return_value = mock_session
        
        mock_patient = Patient(id=24, name="Christopher Jones", dob="1997-10-03", gender="female")
        
        # Mock execute result for ID search
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_patient
        mock_result.scalars.return_value.all.return_value = [] # No records/imaging
        
        mock_session.execute.return_value = mock_result

        # Test with embedded ID string
        result = query_patient_info("patient 24")
        self.assertIn("Patient Found: Christopher Jones (ID: 24)", result)

    @patch('src.tools.builtin.patient_tool.SessionLocal')
    def test_query_patient_info_by_name(self, mock_session_local):
        # Setup mock session and patient
        mock_session = MagicMock()
        mock_session_local.return_value = mock_session
        
        mock_patient = Patient(id=99, name="John Doe", dob="1980-01-01", gender="male")
        
        # Mock execute result
        # First call (ID search) returns None
        # Second call (Name search) returns Patient
        
        # We need to handle multiple execute calls.
        # 1. ID search (if regex matches) or Name search
        # "John Doe" won't match regex \b(\d+)\b, so it goes straight to name search.
        
        mock_result_name = MagicMock()
        mock_result_name.scalars.return_value.first.return_value = mock_patient
        mock_result_name.scalars.return_value.all.return_value = []
        
        mock_session.execute.return_value = mock_result_name

        result = query_patient_info("John Doe")
        self.assertIn("Patient Found: John Doe (ID: 99)", result)

    @patch('src.tools.builtin.patient_tool.SessionLocal')
    def test_query_patient_info_not_found(self, mock_session_local):
        mock_session = MagicMock()
        mock_session_local.return_value = mock_session
        
        # Mock execute to return None for everything
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_result.scalars.return_value.first.return_value = None
        
        mock_session.execute.return_value = mock_result

        result = query_patient_info("unknown")
        self.assertIn("No patient found matching query", result)

if __name__ == '__main__':
    unittest.main()
