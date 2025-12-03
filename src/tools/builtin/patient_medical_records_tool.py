"""Patient medical records query tool for AI agent.

Allows the agent to query medical records from the database.
"""

import logging
import os
from typing import Optional
from sqlalchemy import select
from sqlalchemy.orm import Session
from langchain_openai import OpenAIEmbeddings

from src.config.database import SessionLocal, MedicalRecord
from src.tools.registry import ToolRegistry

logger = logging.getLogger(__name__)

def query_patient_medical_records(
    patient_id: int,
    query: Optional[str] = None,
    limit: int = 5,
) -> str:
    """Query medical records for a specific patient.

    Use this tool when you need to retrieve medical history, diagnoses, treatment notes,
    or other medical records for a patient. You must know the patient ID first - use
    the patient basic info tool if you need to find the patient ID.
    
    If a query string is provided, this tool will perform semantic search to find
    the most relevant medical records. Otherwise, it returns the most recent records.

    Args:
        patient_id: The patient's ID (required).
        query: Optional search query for semantic search (e.g. "diabetes treatment", "recent lab results").
        limit: Maximum number of records to return (default: 5, max: 10).

    Returns:
        A formatted string containing the patient's medical records.
    """
    logger.info("Patient medical records tool invoked for patient_id=%s with query='%s', limit=%d", 
                patient_id, query, limit)
    
    # Limit the maximum number of records
    limit = min(limit, 10)
    
    session: Session = SessionLocal()
    try:
        records = []
        relevant_records = []
        query_vector = None
        
        # 1. Try to find semantically relevant records if we have a query
        if query and len(query) > 3:
            try:
                # Check if API key is available
                if os.getenv("OPENAI_API_KEY"):
                    embeddings_model = OpenAIEmbeddings(model="text-embedding-3-small", dimensions=768)
                    query_vector = embeddings_model.embed_query(query)
                    
                    logger.info("Attempting vector search for medical records with query: '%s'", query)
                    rel_stmt = (
                        select(MedicalRecord)
                        .where(MedicalRecord.patient_id == patient_id)
                        .order_by(MedicalRecord.embedding.cosine_distance(query_vector))
                        .limit(limit)
                    )
                    relevant_records = session.execute(rel_stmt).scalars().all()
                    logger.debug("Fetched %d relevant records using vector search", len(relevant_records))
                else:
                    logger.warning("Skipping vector search: OPENAI_API_KEY not set")
            except Exception as e:
                logger.warning("Failed to fetch relevant records: %s", e)

        # 2. Get recent records (if no vector search was performed)
        if not relevant_records:
            stmt = (
                select(MedicalRecord)
                .where(MedicalRecord.patient_id == patient_id)
                .order_by(MedicalRecord.created_at.desc())
                .limit(limit)
            )
            recent_records = session.execute(stmt).scalars().all()
            records = recent_records
        else:
            # If we have relevant records from vector search, use those
            records = relevant_records
        
        logger.debug("Fetched total %d records for patient_id=%s", len(records), patient_id)

        # Format response
        response = [f"Medical Records for Patient ID {patient_id}:"]
        
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
                
                # Add content for each record
                if r.content:
                    # For text records, show the content (truncated)
                    if r.record_type == "text":
                        content_display = r.content
                        # Truncate if longer than 200 characters
                        if len(content_display) > 200:
                            content_display = content_display[:200] + "... [truncated]"
                        response.append(f"    Content: {content_display}")
                    else:
                        # For image/pdf records, show as URL
                        response.append(f"    URL: {r.content}")

        result = "\n".join(response)
        logger.info("Patient medical records tool returning %d records for patient_id=%s", len(records), patient_id)
        return result
        
    except Exception as e:
        logger.exception("Error querying patient medical records: %s", e)
        return f"Error querying patient medical records: {str(e)}"
    finally:
        session.close()
        logger.debug("Patient medical records tool session closed")

# NOTE: This tool is auto-registered to the global registry
# It is a core/fixed tool available to all agents
_registry = ToolRegistry()
_registry.register(query_patient_medical_records, scope="global", symbol="query_patient_medical_records", allow_overwrite=True)
