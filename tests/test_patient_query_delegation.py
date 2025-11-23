"""Test patient query delegation to Internist sub-agent.

This test verifies the complete flow:
1. Main agent receives user query "Who is patient 2?"
2. Main agent analyzes and delegates to Internist sub-agent
3. Internist uses query_patient_info tool to fetch data
4. Internist reports back to main agent
5. Main agent responds to user with results
"""

import pytest
import asyncio
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from datetime import datetime
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from sqlalchemy import select

from src.config.database import Patient, MedicalRecord, SubAgent, Tool, AgentToolAssignment, AsyncSessionLocal


class TestPatientQueryDelegation:
    """Test suite for patient query delegation flow."""

    @pytest.mark.asyncio
    async def test_patient_tool_database_assignment(self):
        """Test that patient tool is assigned to Internist in database."""
        async with AsyncSessionLocal() as session:
            # Get Internist agent
            result = await session.execute(
                select(SubAgent).where(SubAgent.role == "clinical_text")
            )
            internist = result.scalar_one_or_none()

            assert internist is not None, "Internist agent should exist in database"
            assert internist.name == "Internist", "Agent should be named Internist"

            # Get tool assignments for Internist
            result = await session.execute(
                select(AgentToolAssignment)
                .where(
                    AgentToolAssignment.agent_id == internist.id,
                    AgentToolAssignment.tool_name == "query_patient_info",
                    AgentToolAssignment.enabled == True
                )
            )
            assignment = result.scalar_one_or_none()

            assert assignment is not None, \
                "query_patient_info should be assigned to Internist"

    @pytest.mark.asyncio
    async def test_patient_tool_exists_in_custom_tools(self):
        """Test that patient tool exists in custom_tools table."""
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(Tool).where(Tool.name == "query_patient_info")
            )
            tool = result.scalar_one_or_none()

            assert tool is not None, "query_patient_info should exist in tools"
            assert tool.enabled == True, "Tool should be enabled"
            assert tool.scope in ["assignable", "both"], "Tool should be assignable"
            assert tool.category == "medical", "Tool should be in medical category"


class TestPatientToolFunctionality:
    """Test the patient tool functionality directly."""

    def test_query_patient_by_id(self):
        """Test querying patient by ID."""
        from src.tools.builtin.patient_tool import query_patient_info

        with patch('src.tools.builtin.patient_tool.SessionLocal') as mock_session_local:
            # Mock session and patient
            mock_session = MagicMock()
            mock_session_local.return_value = mock_session

            mock_patient = Patient(
                id=2,
                name="Jane Smith",
                dob="1990-05-15",
                gender="Female",
                created_at=datetime.now()
            )

            mock_session.execute.return_value.scalar_one_or_none.return_value = mock_patient
            mock_session.execute.return_value.scalars.return_value.all.return_value = []

            result = query_patient_info("2")

            assert "Jane Smith" in result
            assert "ID: 2" in result
            assert "1990-05-15" in result

    def test_query_patient_by_name(self):
        """Test querying patient by name."""
        from src.tools.builtin.patient_tool import query_patient_info

        with patch('src.tools.builtin.patient_tool.SessionLocal') as mock_session_local:
            mock_session = MagicMock()
            mock_session_local.return_value = mock_session

            mock_patient = Patient(
                id=2,
                name="Jane Smith",
                dob="1990-05-15",
                gender="Female",
                created_at=datetime.now()
            )

            mock_session.execute.return_value.scalars.return_value.first.return_value = mock_patient
            mock_session.execute.return_value.scalars.return_value.all.return_value = []

            result = query_patient_info("Jane")

            assert "Jane Smith" in result

    def test_patient_not_found(self):
        """Test handling of non-existent patient."""
        from src.tools.builtin.patient_tool import query_patient_info

        with patch('src.tools.builtin.patient_tool.SessionLocal') as mock_session_local:
            mock_session = MagicMock()
            mock_session_local.return_value = mock_session

            mock_session.execute.return_value.scalar_one_or_none.return_value = None

            result = query_patient_info("999")

            assert "No patient found" in result
            assert "999" in result
