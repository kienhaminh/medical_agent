"""Patient medical imaging query tool for AI agent.

Allows the agent to query medical imaging records (X-rays, MRIs, CT scans, etc.) from the database.
"""

import logging
from typing import Optional
from sqlalchemy import select
from sqlalchemy.orm import Session

from src.config.database import SessionLocal, Imaging
from src.tools.registry import ToolRegistry

logger = logging.getLogger(__name__)

def query_patient_imaging(
    patient_id: int,
    image_type: Optional[str] = None,
    group_id: Optional[int] = None,
    limit: int = 10,
) -> str:
    """Query medical imaging records for a specific patient.

    Use this tool when you need to retrieve medical imaging such as X-rays, MRIs,
    CT scans, ultrasounds, etc. for a patient. You must know the patient ID first -
    use the patient basic info tool if you need to find the patient ID.

    Args:
        patient_id: The patient's ID (required).
        image_type: Optional filter by image type (e.g. "x-ray", "mri", "ct", "ultrasound").
        group_id: Optional filter by image group ID to get images in a specific group.
        limit: Maximum number of imaging records to return (default: 10, max: 20).

    Returns:
        A formatted string containing the patient's medical imaging records with URLs.
    """
    logger.info("Patient imaging tool invoked for patient_id=%s with image_type='%s', group_id=%s, limit=%d",
                patient_id, image_type, group_id, limit)
    
    # Limit the maximum number of records
    limit = min(limit, 20)
    
    session: Session = SessionLocal()
    try:
        # Build query
        stmt = select(Imaging).where(Imaging.patient_id == patient_id)

        # Filter by group_id if specified
        if group_id is not None:
            stmt = stmt.where(Imaging.group_id == group_id)

        # Filter by image type if specified
        if image_type:
            stmt = stmt.where(Imaging.image_type.ilike(f"%{image_type}%"))

        # Order by most recent and limit
        stmt = stmt.order_by(Imaging.created_at.desc()).limit(limit)
        
        imaging_records = session.execute(stmt).scalars().all()
        logger.debug("Fetched %d imaging records for patient_id=%s", len(imaging_records), patient_id)
        
        # Format response
        if group_id is not None:
            response = [f"Medical Imaging for Patient ID {patient_id} in Group {group_id}:"]
        else:
            response = [f"Medical Imaging for Patient ID {patient_id}:"]

        if not imaging_records:
            if group_id is not None:
                response.append(f"  No imaging records found in group {group_id}.")
            elif image_type:
                response.append(f"  No {image_type} imaging records found.")
            else:
                response.append("  No imaging records found.")
        else:
            for img in imaging_records:
                created_str = img.created_at.strftime("%Y-%m-%d")
                group_info = f" [Group: {img.group_id}]" if img.group_id else ""
                response.append(f"  - [{created_str}] {img.image_type.upper()}: {img.title}{group_info}")
                # Add URLs for each imaging record
                response.append(f"    Preview: {img.preview_url}")
                response.append(f"    Original: {img.original_url}")

        result = "\n".join(response)
        logger.info("Patient imaging tool returning %d imaging records for patient_id=%s", 
                   len(imaging_records), patient_id)
        return result
        
    except Exception as e:
        logger.exception("Error querying patient imaging: %s", e)
        return f"Error querying patient imaging: {str(e)}"
    finally:
        session.close()
        logger.debug("Patient imaging tool session closed")

# NOTE: This tool is auto-registered to the global registry
# It is a core/fixed tool available to all agents
_registry = ToolRegistry()
_registry.register(query_patient_imaging, scope="global", symbol="query_patient_imaging", allow_overwrite=True)
