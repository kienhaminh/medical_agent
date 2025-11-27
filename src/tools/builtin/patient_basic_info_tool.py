"""Patient basic information query tool for AI agent.

Allows the agent to query basic patient demographics from the database.
"""

import logging
import re
from typing import Optional, List
from sqlalchemy import select, and_
from sqlalchemy.orm import Session

from src.config.database import SessionLocal, Patient
from src.tools.registry import ToolRegistry

logger = logging.getLogger(__name__)

def query_patient_basic_info(
    query: Optional[str] = None,
    patient_id: Optional[int] = None,
    name: Optional[str] = None,
    dob: Optional[str] = None,
) -> str:
    """Query basic patient information (demographics).

    Use this tool when you need to find basic information about a patient such as
    their name, date of birth, gender, and ID. For medical records or imaging,
    use the dedicated tools.
    
    You can search by:
    - Patient ID (integer)
    - Name (string, partial match supported)
    - Date of Birth (string, exact match, format YYYY-MM-DD)
    - General query string (tries to match ID or Name)

    Args:
        query: General search query (e.g. "patient 24", "John Doe"). Optional.
        patient_id: Specific Patient ID (e.g. 1). Optional.
        name: Patient name (e.g. "John"). Optional.
        dob: Date of Birth (e.g. "1980-01-01"). Optional.

    Returns:
        A formatted string containing patient demographics (ID, name, DOB, gender).
        If multiple patients match, returns a list of matching patients to help refine the search.
    """
    logger.info("Patient basic info tool invoked with query='%s', patient_id=%s, name='%s', dob='%s'", 
                query, patient_id, name, dob)
    session: Session = SessionLocal()
    try:
        patients: List[Patient] = []
        found_ids = set()
        
        # 1. Build query based on specific parameters if provided
        conditions = []
        if patient_id is not None:
            conditions.append(Patient.id == patient_id)
        if name:
            conditions.append(Patient.name.ilike(f"%{name}%"))
        if dob:
            conditions.append(Patient.dob == dob)
            
        if conditions:
            stmt = select(Patient).where(and_(*conditions))
            db_patients = session.execute(stmt).scalars().all()
            for p in db_patients:
                if p.id not in found_ids:
                    patients.append(p)
                    found_ids.add(p.id)
            logger.debug("Found %d patients using specific parameters", len(patients))
            
        # 2. If no specific parameters, fall back to general query logic
        elif query:
            # A. Try to parse query as ID
            try:
                pid = int(query)
                stmt = select(Patient).where(Patient.id == pid)
                p = session.execute(stmt).scalar_one_or_none()
                if p and p.id not in found_ids:
                    patients.append(p)
                    found_ids.add(p.id)
                logger.debug("Parsed query as id=%s", pid)
            except ValueError:
                # Not a direct ID, check if it contains an ID (e.g., "patient 24")
                id_match = re.search(r'\b(\d+)\b', query)
                if id_match:
                    try:
                        pid = int(id_match.group(1))
                        stmt = select(Patient).where(Patient.id == pid)
                        p = session.execute(stmt).scalar_one_or_none()
                        if p and p.id not in found_ids:
                            patients.append(p)
                            found_ids.add(p.id)
                            logger.debug("Extracted patient ID %s from query '%s'", pid, query)
                    except Exception:
                        pass
                
                # B. Search by name
                stmt = select(Patient).where(Patient.name.ilike(f"%{query}%"))
                name_matches = session.execute(stmt).scalars().all()
                for p in name_matches:
                    if p.id not in found_ids:
                        patients.append(p)
                        found_ids.add(p.id)
                logger.debug("Query treated as name search, found %d matches", len(name_matches))

        if not patients:
            msg = f"No patient found matching query: '{query}'"
            if name or dob or patient_id:
                msg += f" (params: id={patient_id}, name={name}, dob={dob})"
            logger.info(msg)
            return msg
            
        # 3. Handle results
        if len(patients) > 1:
            # Return a list of matches
            response = ["Multiple patients found. Please refine your search:"]
            for p in patients[:10]:  # Limit to 10 to avoid huge outputs
                response.append(f"- ID: {p.id} | Name: {p.name} | DOB: {p.dob} | Gender: {p.gender}")
            if len(patients) > 10:
                response.append(f"... and {len(patients) - 10} more.")
            return "\n".join(response)
            
        # Single patient found - return basic details
        patient = patients[0]
        
        response = [
            f"Patient Found: {patient.name} (ID: {patient.id})",
            f"DOB: {patient.dob}",
            f"Gender: {patient.gender}",
        ]
        
        result = "\n".join(response)
        logger.info("Patient basic info tool returning info for patient_id=%s", patient.id)
        return result
        
    except Exception as e:
        logger.exception("Error querying patient basic info: %s", e)
        return f"Error querying patient basic info: {str(e)}"
    finally:
        session.close()
        logger.debug("Patient basic info tool session closed")

# NOTE: This tool is auto-registered to the global registry
# It is a core/fixed tool available to all agents
_registry = ToolRegistry()
_registry.register(query_patient_basic_info, scope="global", symbol="query_patient_basic_info", allow_overwrite=True)
