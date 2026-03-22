"""FastAPI server for AI Agent chat interface."""

# Load environment variables FIRST, before any imports that need them
from dotenv import load_dotenv
load_dotenv()

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from ..config.database import init_db
from .dependencies import provider_name, llm_provider
from .routers import patients, agents, tools, chat, usage, skills
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
        print("[SKILLS] Running in DB-ONLY mode (filesystem discovery disabled)")
        print("[SKILLS] Set skills.db_only=false in config to enable filesystem discovery")
    else:
        # 1. Discover filesystem skills (core, custom, external)
        print("[SKILLS] Running in HYBRID mode (filesystem + database)")
        for source_type, skills_dir in SKILL_DIRS.items():
            if os.path.exists(skills_dir):
                try:
                    count = registry.discover_skills([skills_dir])
                    print(f"[SKILLS] Discovered {count} {source_type} skills from {skills_dir}")
                    total += count
                except Exception as e:
                    print(f"[WARN] Failed to discover {source_type} skills: {e}")
    
    # 2. Load skills from database (always do this)
    try:
        db_count = await registry.load_from_database()
        print(f"[SKILLS] Loaded {db_count} skills from database")
        total += db_count
    except Exception as e:
        print(f"[WARN] Failed to load skills from database: {e}")
    
    print(f"[SKILLS] Total skills registered: {total}")
    if total == 0:
        print("[WARN] No skills loaded! Run: python -m scripts.migrate_skills_to_db")
    return total

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifespan events (startup and shutdown)."""
    # Startup: Initialize database
    await init_db()
    print("[STARTUP] Database initialized")
    
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
