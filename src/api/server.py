"""FastAPI server for AI Agent chat interface."""

# Load environment variables FIRST, before any imports that need them
from dotenv import load_dotenv
load_dotenv()

import logging
from contextlib import asynccontextmanager

logger = logging.getLogger(__name__)
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from sqlalchemy import func, select

from ..config.database import init_db
from ..models.base import AsyncSessionLocal
from ..models.department import Department
from ..models.room import Room
from ..constants.department_seed_data import DEPARTMENT_SEED_DATA
from .dependencies import _OPENAI_MODEL, _KIMI_MODEL, _kimi_provider
from .routers import patients, agents, tools, chat, usage, skills, visits, departments, hospital, auth, orders, ws, case_threads, transcription, rooms
import src.tools  # Register tools
import src.skills.builtin  # Register skill search tools

# Import and discover skills on startup
from src.skills.registry import SkillRegistry
import os

# Load config for skill settings
from ..config.settings import load_config
config = load_config()

# Skill directories for filesystem discovery
SKILL_DIRS = {
    "core": os.path.join(os.path.dirname(os.path.dirname(__file__)), "skills"),
    "custom": config.skills.custom_dir,
    "external": config.skills.external_dir,
}

async def discover_skills_on_startup():
    """Discover and register all skills from filesystem on startup."""
    registry = SkillRegistry()
    total = 0

    for source_type, skills_dir in SKILL_DIRS.items():
        if os.path.exists(skills_dir):
            try:
                count = registry.discover_skills([skills_dir])
                logger.info("Discovered %d %s skills from %s", count, source_type, skills_dir)
                total += count
            except Exception as e:
                logger.warning("Failed to discover %s skills: %s", source_type, e)

    logger.info("Total skills registered: %d", total)
    return total

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifespan events (startup and shutdown)."""
    # Startup: Initialize database
    await init_db()
    logger.info("Database initialized")

    # Seed departments if empty
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(func.count(Department.id)))
        count = result.scalar() or 0
        if count == 0:
            for data in DEPARTMENT_SEED_DATA:
                session.add(Department(**data, is_open=True))
            await session.commit()
            logger.info(f"Seeded {len(DEPARTMENT_SEED_DATA)} departments")

    # Seed default users if empty
    from ..models.user import User
    from ..utils.auth import hash_password
    async with AsyncSessionLocal() as session:
        user_count = await session.execute(select(func.count(User.id)))
        if (user_count.scalar() or 0) == 0:
            default_users = [
                # Neurology matches seeded in-department visits (e.g. Ahmed Hassan) for demo queue.
                User(username="doctor", password_hash=hash_password("doctor123"), name="Dr. Sarah Chen", role="doctor", department="neurology"),
                User(username="admin", password_hash=hash_password("admin123"), name="System Admin", role="admin"),
            ]
            for user in default_users:
                session.add(user)
            await session.commit()
            logger.info("Seeded %d default users", len(default_users))

    # Seed rooms if none exist — one room per capacity slot per department
    async with AsyncSessionLocal() as session:
        room_count_result = await session.execute(select(func.count(Room.id)))
        if (room_count_result.scalar() or 0) == 0:
            all_depts_result = await session.execute(select(Department))
            depts = all_depts_result.scalars().all()
            room_counter = 100
            for dept in depts:
                for _ in range(dept.capacity):
                    room_counter += 1
                    session.add(Room(
                        room_number=str(room_counter),
                        department_name=dept.name,
                    ))
            await session.commit()
            logger.info("Seeded rooms for %d departments", len(depts))

    # Startup: Discover skills
    await discover_skills_on_startup()

    yield

app = FastAPI(
    title="Medical Agent API",
    description="AI-powered medical assistant with skill-based agent orchestration",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# Configure CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(patients.router)
app.include_router(agents.router)
app.include_router(tools.router)
app.include_router(chat.router)
app.include_router(usage.router)
app.include_router(skills.router)
app.include_router(visits.router)
app.include_router(departments.router)
app.include_router(rooms.router)
app.include_router(hospital.router)
app.include_router(auth.router)
app.include_router(orders.router)
app.include_router(ws.router)
app.include_router(case_threads.router)
app.include_router(transcription.router)

@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "message": "AI Agent API is running",
        "status": "ok",
        "providers": {"intake": _OPENAI_MODEL, "doctor": _KIMI_MODEL},
    }

@app.get("/health")
async def health():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "providers": {"intake": _OPENAI_MODEL, "doctor": _KIMI_MODEL},
        "model": _kimi_provider.model,
    }

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "src.api.server:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        reload_dirs=["src"],
        reload_excludes=["src/tools/medical_img_segmentation_tool.py"],
    )
