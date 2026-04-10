# eval/patient_seeder.py
from datetime import date

from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from eval.api_client import EvalApiClient
from eval.case_loader import EvalCase
from src.models import MedicalRecord, Patient
from src.models.room import Room
from src.models.visit import Visit
from src.models.visit_step import VisitStep


class PatientSeeder:
    def __init__(self, db: AsyncSession, api_client: EvalApiClient) -> None:
        self._db = db
        self._api = api_client

    async def seed(self, case: EvalCase) -> int:
        """Seed patient + medical records. Returns patient_id."""
        today = date.today()
        dob = date(today.year - case.patient.age, 1, 1).isoformat()

        patient_data = await self._api.create_patient(
            name=case.patient.name,
            dob=dob,
            gender=case.patient.sex,
        )
        patient_id: int = patient_data["id"]

        for item in case.patient.medical_history:
            summary = item.name
            if item.dosage:
                summary = f"{item.name} - {item.dosage}"
            self._db.add(
                MedicalRecord(
                    patient_id=patient_id,
                    record_type=item.type,
                    content=summary,
                    summary=summary,
                )
            )

        for allergy in case.patient.allergies:
            self._db.add(
                MedicalRecord(
                    patient_id=patient_id,
                    record_type="allergy",
                    content=allergy,
                    summary=allergy,
                )
            )

        await self._db.commit()
        return patient_id

    async def teardown(self, patient_id: int) -> None:
        """Remove all seeded records and the patient row.

        Deletion order respects FK constraints:
          rooms.current_visit_id → NULL
          visit_steps → visits → medical_records → patients
        """
        result = await self._db.execute(
            select(Visit.id).where(Visit.patient_id == patient_id)
        )
        rows = result.fetchall()
        visit_ids = [row[0] for row in rows]

        if visit_ids:
            # Nullify rooms that reference these visits before deletion
            await self._db.execute(
                update(Room)
                .where(Room.current_visit_id.in_(visit_ids))
                .values(current_visit_id=None)
            )
            await self._db.execute(
                delete(VisitStep).where(VisitStep.visit_id.in_(visit_ids))
            )
            await self._db.execute(
                delete(Visit).where(Visit.patient_id == patient_id)
            )

        await self._db.execute(
            delete(MedicalRecord).where(MedicalRecord.patient_id == patient_id)
        )
        await self._db.execute(
            delete(Patient).where(Patient.id == patient_id)
        )
        await self._db.commit()
