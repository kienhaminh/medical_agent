import asyncio
import sys
import os

# Add current directory to sys.path
sys.path.append(os.getcwd())

# Load .env manually
env_path = os.path.join(os.getcwd(), ".env")
if os.path.exists(env_path):
    with open(env_path, "r") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#"):
                key, value = line.split("=", 1)
                value = value.strip('"').strip("'")
                os.environ[key] = value

from src.config.database import AsyncSessionLocal, Patient, Imaging, ImageGroup, MedicalRecord
from sqlalchemy import select

async def main():
    async with AsyncSessionLocal() as db:
        patient_id = 29
        print(f"Fetching patient {patient_id}...")
        try:
            result = await db.execute(select(Patient).where(Patient.id == patient_id))
            patient = result.scalar_one_or_none()
            if not patient:
                print("Patient not found")
                return
            print(f"Patient found: {patient.name}")

            print("Fetching imaging...")
            imaging_result = await db.execute(
                select(Imaging)
                .where(Imaging.patient_id == patient_id)
                .order_by(Imaging.created_at.desc())
            )
            imaging_records = imaging_result.scalars().all()
            print(f"Imaging records: {len(imaging_records)}")
            
            # Try to construct ImagingResponse to see if it fails
            from src.api.models import ImagingResponse
            for img in imaging_records:
                try:
                    ImagingResponse(
                        id=img.id,
                        patient_id=img.patient_id,
                        title=img.title,
                        image_type=img.image_type,
                        original_url=img.original_url,
                        preview_url=img.preview_url,
                        created_at=img.created_at.isoformat()
                    )
                except Exception as e:
                    print(f"Error creating ImagingResponse for img {img.id}: {e}")
                    import traceback
                    traceback.print_exc()

            print("Fetching image groups...")
            groups_result = await db.execute(
                select(ImageGroup)
                .where(ImageGroup.patient_id == patient_id)
                .order_by(ImageGroup.created_at.desc())
            )
            image_groups = groups_result.scalars().all()
            print(f"Image groups: {len(image_groups)}")

        except Exception as e:
            print(f"Error: {e}")
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
