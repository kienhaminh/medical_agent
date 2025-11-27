"""Patient reference detection utility.

Detects patient references in text and generates metadata for frontend linking.
"""

import logging
import re
from typing import List, Dict, Any, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config.database import Patient

logger = logging.getLogger(__name__)


class PatientReference:
    """Represents a detected patient reference in text."""

    def __init__(self, patient_id: int, patient_name: str, start_index: int, end_index: int):
        self.patient_id = patient_id
        self.patient_name = patient_name
        self.start_index = start_index
        self.end_index = end_index

    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization."""
        return {
            "patient_id": self.patient_id,
            "patient_name": self.patient_name,
            "start_index": self.start_index,
            "end_index": self.end_index
        }


class PatientDetector:
    """Detects patient references in text content."""

    def __init__(self, db_session: Optional[AsyncSession] = None):
        """Initialize patient detector.

        Args:
            db_session: Optional database session for patient lookup
        """
        self.db_session = db_session
        self._patient_cache: Dict[int, Patient] = {}

    async def _get_all_patients(self) -> List[Patient]:
        """Fetch all patients from database.

        Returns:
            List of all patients
        """
        if not self.db_session:
            return []

        try:
            result = await self.db_session.execute(select(Patient))
            patients = result.scalars().all()

            # Update cache
            for patient in patients:
                self._patient_cache[patient.id] = patient

            logger.debug(f"Loaded {len(patients)} patients for detection")
            return list(patients)
        except Exception as e:
            logger.error(f"Error fetching patients: {e}")
            return []

    def _find_name_occurrences(self, text: str, patient: Patient) -> List[tuple]:
        """Find all occurrences of a patient's name in text.

        Uses word boundaries to avoid partial matches.

        Args:
            text: Text to search
            patient: Patient to find

        Returns:
            List of (start_index, end_index) tuples
        """
        occurrences = []
        name = patient.name

        # Escape special regex characters in name
        escaped_name = re.escape(name)

        # Pattern with word boundaries
        pattern = r'\b' + escaped_name + r'\b'

        try:
            for match in re.finditer(pattern, text, re.IGNORECASE):
                occurrences.append((match.start(), match.end()))
        except Exception as e:
            logger.error(f"Error matching pattern for {name}: {e}")

        return occurrences

    def _find_patient_id_occurrences(self, text: str, patient: Patient) -> List[tuple]:
        """Find patient ID references in text.

        Patterns:
        - "Patient ID: 123"
        - "Patient #123"
        - "ID 123"

        Args:
            text: Text to search
            patient: Patient to find

        Returns:
            List of (start_index, end_index) tuples for the full match
        """
        occurrences = []
        patient_id = str(patient.id)

        # Patterns for patient ID references
        patterns = [
            rf'\bPatient ID[:\s]+{patient_id}\b',
            rf'\bPatient #{patient_id}\b',
            rf'\bID[:\s]+{patient_id}\b',
            rf'\bpatient {patient_id}\b',
        ]

        for pattern in patterns:
            try:
                for match in re.finditer(pattern, text, re.IGNORECASE):
                    occurrences.append((match.start(), match.end()))
            except Exception as e:
                logger.error(f"Error matching ID pattern {pattern}: {e}")

        return occurrences

    async def detect_in_text(
        self,
        text: str,
        context_patient_id: Optional[int] = None
    ) -> List[PatientReference]:
        """Detect all patient references in text.

        Args:
            text: Text content to analyze
            context_patient_id: Optional patient ID from context (will be detected first)

        Returns:
            List of PatientReference objects sorted by start_index
        """
        references = []

        # If we have a context patient, detect it first
        if context_patient_id and context_patient_id in self._patient_cache:
            patient = self._patient_cache[context_patient_id]
            occurrences = self._find_name_occurrences(text, patient)
            occurrences.extend(self._find_patient_id_occurrences(text, patient))

            for start, end in occurrences:
                references.append(PatientReference(
                    patient_id=patient.id,
                    patient_name=patient.name,
                    start_index=start,
                    end_index=end
                ))

        # Detect all other patients from database
        if self.db_session:
            patients = await self._get_all_patients()

            for patient in patients:
                # Skip if already processed as context patient
                if context_patient_id and patient.id == context_patient_id:
                    continue

                occurrences = self._find_name_occurrences(text, patient)
                occurrences.extend(self._find_patient_id_occurrences(text, patient))

                for start, end in occurrences:
                    references.append(PatientReference(
                        patient_id=patient.id,
                        patient_name=patient.name,
                        start_index=start,
                        end_index=end
                    ))

        # Sort by start_index and remove duplicates (prefer longer matches)
        references.sort(key=lambda r: (r.start_index, -(r.end_index - r.start_index)))

        # Remove overlapping references (keep first/longest)
        filtered_refs = []
        for ref in references:
            # Check if this reference overlaps with any already added
            overlaps = False
            for existing_ref in filtered_refs:
                if (ref.start_index >= existing_ref.start_index and
                    ref.start_index < existing_ref.end_index):
                    overlaps = True
                    break
                if (ref.end_index > existing_ref.start_index and
                    ref.end_index <= existing_ref.end_index):
                    overlaps = True
                    break

            if not overlaps:
                filtered_refs.append(ref)

        logger.info(f"Detected {len(filtered_refs)} patient references in text")
        return filtered_refs

    def detect_in_text_sync(
        self,
        text: str,
        patient_id: Optional[int] = None,
        patient_name: Optional[str] = None
    ) -> List[PatientReference]:
        """Synchronous version for simple name-based detection.

        Only detects the specified patient (no database lookup).

        Args:
            text: Text content to analyze
            patient_id: Patient ID
            patient_name: Patient name to detect

        Returns:
            List of PatientReference objects sorted by start_index
        """
        if not patient_id or not patient_name:
            return []

        references = []

        # Create a temporary Patient object for helper methods
        from ..config.database import Patient
        temp_patient = Patient(id=patient_id, name=patient_name)

        # Detect name occurrences
        name_occurrences = self._find_name_occurrences(text, temp_patient)
        for start, end in name_occurrences:
            references.append(PatientReference(
                patient_id=patient_id,
                patient_name=patient_name,
                start_index=start,
                end_index=end
            ))

        # Detect patient ID occurrences
        id_occurrences = self._find_patient_id_occurrences(text, temp_patient)
        for start, end in id_occurrences:
            references.append(PatientReference(
                patient_id=patient_id,
                patient_name=patient_name,
                start_index=start,
                end_index=end
            ))

        # Sort by start_index and remove overlaps
        references.sort(key=lambda r: (r.start_index, -(r.end_index - r.start_index)))

        # Remove overlapping references
        filtered_refs = []
        for ref in references:
            overlaps = False
            for existing_ref in filtered_refs:
                if (ref.start_index >= existing_ref.start_index and
                    ref.start_index < existing_ref.end_index):
                    overlaps = True
                    break
                if (ref.end_index > existing_ref.start_index and
                    ref.end_index <= existing_ref.end_index):
                    overlaps = True
                    break

            if not overlaps:
                filtered_refs.append(ref)

        return filtered_refs
