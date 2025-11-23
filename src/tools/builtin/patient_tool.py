"""Patient query tool for AI agent.

Allows the agent to query patient information and medical records from the database.
"""

from typing import Optional
from sqlalchemy import select, or_
from sqlalchemy.orm import Session

from src.config.database import SessionLocal, Patient, MedicalRecord
from src.tools.registry import ToolRegistry

def query_patient_info(query: str) -> str:
    """Query patient information and medical records.
    
    Use this tool when you need to find information about a patient or their medical history.
    You can search by Patient ID (integer) or Name (string).
    
    Args:
        query: The search query. Can be a Patient ID (e.g., "1") or a Name (e.g., "John Doe").
    """
    session: Session = SessionLocal()
    try:
        patient: Optional[Patient] = None
        
        # Try to parse query as ID
        try:
            patient_id = int(query)
            patient = session.execute(
                select(Patient).where(Patient.id == patient_id)
            ).scalar_one_or_none()
        except ValueError:
            # Not an ID, search by name
            patient = session.execute(
                select(Patient).where(Patient.name.ilike(f"%{query}%"))
            ).scalars().first()
            
        if not patient:
            return f"No patient found matching query: '{query}'"
            
        # Get recent records
        records = session.execute(
            select(MedicalRecord)
            .where(MedicalRecord.patient_id == patient.id)
            .order_by(MedicalRecord.created_at.desc())
            .limit(5)
        ).scalars().all()
        
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
                
        return "\n".join(response)
        
    except Exception as e:
        return f"Error querying patient info: {str(e)}"
    finally:
        session.close()

# NOTE: This tool is NOT auto-registered to the global registry
# It should only be available to sub-agents via database assignment
# The tool is loaded dynamically by load_custom_tools() from the database
