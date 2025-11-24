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
from .routers import patients, agents, tools, chat

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifespan events (startup and shutdown)."""
    # Startup: Initialize database only
    await init_db()
    print("Database initialized")
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
        "model": llm_provider.model_name,
    }

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "src.api.server:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
    )
