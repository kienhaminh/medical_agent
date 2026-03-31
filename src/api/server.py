"""FastAPI server for AI Agent chat interface."""

# Load environment variables FIRST, before any imports that need them
from dotenv import load_dotenv
load_dotenv()

import logging
from contextlib import asynccontextmanager

logger = logging.getLogger(__name__)
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from sqlalchemy import func, select

from ..config.database import init_db
from ..models.base import AsyncSessionLocal
from ..models.department import Department
from ..constants.department_seed_data import DEPARTMENT_SEED_DATA
from .dependencies import provider_name, llm_provider
from .routers import patients, agents, tools, chat, usage, skills, visits, departments, hospital, auth, orders, ws, case_threads
import src.tools.builtin  # Register builtin tools
import src.skills.builtin  # Register skill search tools

# Import and discover skills on startup
from src.skills.registry import SkillRegistry
import os

# Load config for skill settings
from ..config.settings import load_config
config = load_config()

# Plugin directory configuration (only used when db_only=false)
SKILL_DIRS = {
    "core": os.path.join(os.path.dirname(os.path.dirname(__file__)), "skills"),
    "custom": config.skills.custom_dir,
    "external": config.skills.external_dir,
}

async def discover_skills_on_startup():
    """Discover and register all skills on startup.
    
    Mode 1 - DB Only (recommended for production):
    - Only load skills from database
    - All skills managed via UI/API
    
    Mode 2 - Hybrid (development):
    - Load from filesystem (core/custom/external)
    - Also load from database
    """
    registry = SkillRegistry()
    total = 0
    
    # Check if DB-only mode is enabled
    db_only = config.skills.db_only
    
    if db_only:
        logger.info("Running in DB-ONLY mode (filesystem discovery disabled)")
        logger.info("Set skills.db_only=false in config to enable filesystem discovery")
    else:
        # 1. Discover filesystem skills (core, custom, external)
        logger.info("Running in HYBRID mode (filesystem + database)")
        for source_type, skills_dir in SKILL_DIRS.items():
            if os.path.exists(skills_dir):
                try:
                    count = registry.discover_skills([skills_dir])
                    logger.info("Discovered %d %s skills from %s", count, source_type, skills_dir)
                    total += count
                except Exception as e:
                    logger.warning("Failed to discover %s skills: %s", source_type, e)

    # 2. Load skills from database (always do this)
    try:
        db_count = await registry.load_from_database()
        logger.info("Loaded %d skills from database", db_count)
        total += db_count
    except Exception as e:
        logger.warning("Failed to load skills from database: %s", e)

    logger.info("Total skills registered: %d", total)
    if total == 0:
        logger.warning("No skills loaded! Run: python -m scripts.migrate_skills_to_db")
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
                User(username="doctor", password_hash=hash_password("doctor123"), name="Dr. Sarah Chen", role="doctor", department="internal_medicine"),
                User(username="nurse", password_hash=hash_password("nurse123"), name="Nurse James Park", role="nurse", department="emergency"),
                User(username="officer", password_hash=hash_password("officer123"), name="Admin Maria Lopez", role="officer"),
                User(username="admin", password_hash=hash_password("admin123"), name="System Admin", role="admin"),
            ]
            for user in default_users:
                session.add(user)
            await session.commit()
            logger.info("Seeded %d default users", len(default_users))

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

# Mount uploads directory for serving files
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# Include routers
app.include_router(patients.router)
app.include_router(agents.router)
app.include_router(tools.router)
app.include_router(chat.router)
app.include_router(usage.router)
app.include_router(skills.router)
app.include_router(visits.router)
app.include_router(departments.router)
app.include_router(hospital.router)
app.include_router(auth.router)
app.include_router(orders.router)
app.include_router(ws.router)
app.include_router(case_threads.router)

@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "message": "AI Agent API is running",
        "status": "ok",
        "provider": provider_name,
    }

@app.get("/health")
async def health():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "provider": provider_name,
        "model": llm_provider.model,
    }

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "src.api.server:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
    )
