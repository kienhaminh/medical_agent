import asyncio
from src.config.database import init_db

if __name__ == "__main__":
    print("Initializing database...")
    asyncio.run(init_db())
    print("Database initialized.")
