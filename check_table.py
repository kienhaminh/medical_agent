import asyncio
import sys
import os
from sqlalchemy import text

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

from src.config.database import AsyncSessionLocal

async def main():
    async with AsyncSessionLocal() as db:
        print("Checking for image_groups table...")
        result = await db.execute(text("SELECT to_regclass('public.image_groups')"))
        table_exists = result.scalar()
        
        if table_exists:
            print("Table 'image_groups' EXISTS.")
        else:
            print("Table 'image_groups' DOES NOT EXIST.")

if __name__ == "__main__":
    asyncio.run(main())
