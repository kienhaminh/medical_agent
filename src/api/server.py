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

# Plugin directory configuration
SKILL_DIRS = {
    "core": os.path.join(os.path.dirname(os.path.dirname(__file__)), "skills"),
    "custom": os.environ.get("CUSTOM_SKILLS_DIR", "./custom_skills"),
    "external": os.environ.get("EXTERNAL_SKILLS_DIR", "./external_skills"),
}

async def discover_skills_on_startup():
    """Discover and register all skills on startup.
    
    Discovers skills from:
    - Core skills (built-in)
    - Custom skills (user-defined)
    - External skills (third-party plugins)
    - Database (dynamic skills)
    """
    registry = SkillRegistry()
    total = 0
    
    # 1. Discover filesystem skills (core, custom, external)
    for source_type, skills_dir in SKILL_DIRS.items():
        if os.path.exists(skills_dir):
            try:
                count = registry.discover_skills([skills_dir])
                print(f"[SKILLS] Discovered {count} {source_type} skills from {skills_dir}")
                total += count
            except Exception as e:
                print(f"[WARN] Failed to discover {source_type} skills: {e}")
    
    # 2. Load skills from database
    try:
        db_count = await registry.load_from_database()
        print(f"[SKILLS] Loaded {db_count} skills from database")
        total += db_count
    except Exception as e:
        print(f"[WARN] Failed to load skills from database: {e}")
    
    print(f"[SKILLS] Total skills registered: {total}")
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
    title="AI Agent API",
    description="Chat API powered by Kimi (Moonshot AI)",
    version="1.0.0",
    lifespan=lifespan,
)

# Configure CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
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
