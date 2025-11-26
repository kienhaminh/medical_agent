"""Patient query tool for AI agent.

Allows the agent to query patient information and medical records from the database.
"""

import logging
from typing import Optional
from sqlalchemy import select
from sqlalchemy.orm import Session

from src.config.database import SessionLocal, Patient, MedicalRecord, Imaging
from src.tools.registry import ToolRegistry

logger = logging.getLogger(__name__)

def query_patient_info(query: str) -> str:
    """Query patient information, medical records, and medical imaging.

    Use this tool when you need to find information about a patient, their medical history,
    or their medical imaging (X-rays, MRIs, CT scans, etc.). You can search by Patient ID
    (integer) or Name (string).

    Args:
        query: The search query. Can be a Patient ID (e.g., "1") or a Name (e.g., "John Doe").

    Returns:
        A formatted string containing patient demographics, recent medical records (up to 5),
        and recent medical imaging (up to 10).
    """
    # IMPORTANT: Use synchronous engine for synchronous tools
    # We cannot use the async engine/session here because this function is called synchronously by LangChain
    # The SessionLocal uses the synchronous engine (psycopg2)
    
    logger.info("Patient tool invoked with query='%s'", query)
    session: Session = SessionLocal()
    try:
        patient: Optional[Patient] = None
        
        # Try to parse query as ID
        try:
            patient_id = int(query)
            stmt = select(Patient).where(Patient.id == patient_id)
            patient = session.execute(stmt).scalar_one_or_none()
            logger.debug("Parsed patient query as id=%s", patient_id)
        except ValueError:
            # Not an ID, search by name
            stmt = select(Patient).where(Patient.name.ilike(f"%{query}%"))
            patient = session.execute(stmt).scalars().first()
            logger.debug("Patient query treated as name search")
            
        if not patient:
            logger.info("No patient matched query='%s'", query)
            return f"No patient found matching query: '{query}'"
            
        # Get recent records
        stmt = (
            select(MedicalRecord)
            .where(MedicalRecord.patient_id == patient.id)
            .order_by(MedicalRecord.created_at.desc())
            .limit(5)
        )
        records = session.execute(stmt).scalars().all()
        logger.debug("Fetched %d recent records for patient_id=%s", len(records), patient.id)

        # Get recent imaging
        imaging_stmt = (
            select(Imaging)
            .where(Imaging.patient_id == patient.id)
            .order_by(Imaging.created_at.desc())
            .limit(10)
        )
        imaging_records = session.execute(imaging_stmt).scalars().all()
        logger.debug("Fetched %d imaging records for patient_id=%s", len(imaging_records), patient.id)
        
        # Format response
        response = [
            f"Patient Found: {patient.name} (ID: {patient.id})",
            f"DOB: {patient.dob}",
            f"Gender: {patient.gender}",
            "\nRecent Medical Records:"
        ]
        
        if not records:
            response.append("  No records found.")
        else:
            for r in records:
                # Get title from summary or content
                title = "Untitled"
                if r.summary and "Title: " in r.summary:
                    try:
                        title = r.summary.split("Title: ")[1].split(" |")[0]
                    except IndexError:
                        pass
                elif r.record_type == "text" and r.content:
                    first_line = r.content.split('\n', 1)[0]
                    if first_line.startswith("Title: "):
                        title = first_line[len("Title: "):]
                    else:
                        title = first_line[:30] + "..." if len(first_line) > 30 else first_line

                created_str = r.created_at.strftime("%Y-%m-%d")
                response.append(f"  - [{created_str}] {r.record_type.upper()}: {title}")

        # Add medical imaging section
        response.append("\nMedical Imaging:")
        if not imaging_records:
            response.append("  No imaging records found.")
        else:
            for img in imaging_records:
                created_str = img.created_at.strftime("%Y-%m-%d")
                response.append(f"  - [{created_str}] {img.image_type.upper()}: {img.title}")

        result = "\n".join(response)
        logger.info("Patient tool returning summary for patient_id=%s with %d imaging records", patient.id, len(imaging_records))
        return result
        
    except Exception as e:
        logger.exception("Error querying patient info: %s", e)
        return f"Error querying patient info: {str(e)}"
    finally:
        session.close()
        logger.debug("Patient tool session closed")

# NOTE: This tool is NOT auto-registered to the global registry
# It should only be available to sub-agents via database assignment
# The tool is loaded dynamically by load_custom_tools() from the database
_registry = ToolRegistry()
_registry.register(query_patient_info, scope="assignable", symbol="query_patient_info")
