"""FastAPI server for AI Agent chat interface."""

import os
import json
import yaml
from pathlib import Path
from typing import Optional, Dict
from fastapi import FastAPI, HTTPException, Depends, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import AsyncSession
import shutil

from ..agent.core import Agent
from ..agent.langgraph_agent import LangGraphAgent
from ..llm.kimi import KimiProvider
from ..config.settings import load_config
from ..memory import Mem0MemoryManager
from ..tools.registry import ToolRegistry
from ..config.database import get_db, Patient, MedicalRecord, ToolConfig, init_db, SessionLocal, CustomTool
from sqlalchemy import select

# Import builtin tools to trigger auto-registration
from ..tools.builtin import get_current_datetime, get_location, get_current_weather, create_new_tool

# Load environment variables
load_dotenv()

# Ensure uploads directory exists
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

app = FastAPI(
    title="AI Agent API",
    description="Chat API powered by Kimi (Moonshot AI)",
    version="1.0.0",
)

@app.on_event("startup")
async def startup_event():
    """Initialize database and load custom tools."""
    await init_db()
    load_custom_tools()

def load_custom_tools():
    """Load custom tools from database."""
    session = SessionLocal()
    try:
        # Check if table exists first (might fail if init_db hasn't finished or is async)
        # But init_db is awaited above.
        tools = session.query(CustomTool).filter(CustomTool.enabled == True).all()
        for tool in tools:
            try:
                local_scope = {}
                exec(tool.code, {}, local_scope)
                
                func = local_scope.get(tool.name)
                if func and callable(func):
                    try:
                        tool_registry.register(func)
                        print(f"Loaded custom tool: {tool.name}")
                    except ValueError:
                        # Already registered (maybe builtin or reloaded)
                        pass
                else:
                    print(f"Could not find callable '{tool.name}' in custom tool code")
            except Exception as e:
                print(f"Failed to load custom tool {tool.name}: {e}")
    except Exception as e:
        print(f"Failed to query custom tools: {e}")
    finally:
        session.close()

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

# Load memory configuration
def load_memory_config() -> Optional[Dict]:
    """Load memory configuration from YAML file."""
    config_path = Path(__file__).parent.parent.parent / "config" / "memory.yaml"
    if config_path.exists():
        with open(config_path, "r") as f:
            return yaml.safe_load(f)
    return None


# Initialize memory manager
memory_manager = None
memory_config = load_memory_config()

if memory_config and memory_config.get("memory", {}).get("enabled", False):
    try:
        long_term_config = memory_config["memory"]["long_term"]["mem0"]
        memory_manager = Mem0MemoryManager(config=long_term_config)
        print("Memory manager initialized successfully")
    except Exception as e:
        print(f"Warning: Failed to initialize memory manager: {e}")

# Feature flag: Use LangGraph agent with OpenAI
USE_LANGGRAPH = os.getenv("USE_LANGGRAPH", "false").lower() == "true"

# Initialize ToolRegistry (Singleton)
tool_registry = ToolRegistry()

# Initialize LLM provider (Enforce Kimi)
config = load_config()
provider_name = "Moonshot Kimi"

llm_provider = KimiProvider(
    api_key=config.kimi_api_key,
    model="kimi-k2-thinking", # Enforce k2 thinking model
    temperature=0.3,
)

# Bind tools
langchain_tools = tool_registry.get_langchain_tools()
if langchain_tools:
    llm_provider.bind_tools(langchain_tools)

# Override provider name if using LangGraph
if USE_LANGGRAPH:
    provider_name += " (LangGraph)"

# User-specific agents
user_agents: Dict = {}


class PatientCreate(BaseModel):
    name: str
    dob: str
    gender: str

class PatientResponse(BaseModel):
    id: int
    name: str
    dob: str
    gender: str
    created_at: str

class ToolToggleRequest(BaseModel):
    enabled: bool

class ChatRequest(BaseModel):
    """Chat request model."""

    message: str
    user_id: Optional[str] = "default"
    stream: Optional[bool] = False
    patient_id: Optional[int] = None
    record_id: Optional[int] = None


class ChatResponse(BaseModel):
    """Chat response model."""

    content: str
    timestamp: str
    user_id: str
    memories_used: Optional[int] = 0

class TextRecordCreate(BaseModel):
    title: str
    content: str
    description: Optional[str] = None

class RecordResponse(BaseModel):
    id: int
    patient_id: int
    record_type: str
    title: str
    description: Optional[str]
    content: Optional[str]
    file_url: Optional[str]
    file_type: Optional[str]
    created_at: str


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "message": "AI Agent API is running",
        "status": "ok",
        "provider": provider_name,
        "use_langgraph": USE_LANGGRAPH,
    }


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "provider": provider_name,
        "model": llm_provider.model_name,
        "use_langgraph": USE_LANGGRAPH,
    }


@app.post("/api/patients", response_model=PatientResponse)
async def create_patient(patient: PatientCreate, db: AsyncSession = Depends(get_db)):
    """Create a new patient."""
    new_patient = Patient(name=patient.name, dob=patient.dob, gender=patient.gender)
    db.add(new_patient)
    await db.commit()
    await db.refresh(new_patient)
    return PatientResponse(
        id=new_patient.id,
        name=new_patient.name,
        dob=new_patient.dob,
        gender=new_patient.gender,
        created_at=new_patient.created_at.isoformat()
    )

@app.get("/api/patients", response_model=list[PatientResponse])
async def list_patients(db: AsyncSession = Depends(get_db)):
    """List all patients."""
    result = await db.execute(select(Patient))
    patients = result.scalars().all()
    return [
        PatientResponse(
            id=p.id,
            name=p.name,
            dob=p.dob,
            gender=p.gender,
            created_at=p.created_at.isoformat()
        ) for p in patients
    ]

@app.get("/api/patients/{patient_id}", response_model=PatientResponse)
async def get_patient(patient_id: int, db: AsyncSession = Depends(get_db)):
    """Get patient details."""
    result = await db.execute(select(Patient).where(Patient.id == patient_id))
    patient = result.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    return PatientResponse(
        id=patient.id,
        name=patient.name,
        dob=patient.dob,
        gender=patient.gender,
        created_at=patient.created_at.isoformat()
    )

@app.get("/api/patients/{patient_id}/records", response_model=list[RecordResponse])
async def list_patient_records(patient_id: int, db: AsyncSession = Depends(get_db)):
    """List all records for a patient."""
    result = await db.execute(select(MedicalRecord).where(MedicalRecord.patient_id == patient_id).order_by(MedicalRecord.created_at.desc()))
    records = result.scalars().all()
    
    response = []
    for r in records:
        file_url = None
        title = "Untitled"
        file_type = None
        
        if r.record_type == "text":
            # Extract title from the first line of content if available
            first_line = r.content.split('\n', 1)[0] if r.content else ""
            if first_line.startswith("Title: "):
                title = first_line[len("Title: "):].strip()
            else:
                title = first_line.strip() or "Text Record"
            content_display = r.content # Keep full content for text records
            file_type = "text"
        elif r.record_type in ["image", "pdf"]:
            filename = os.path.basename(r.content)
            file_url = f"http://localhost:8000/uploads/{filename}"
            
            # Extract title from summary if available
            if r.summary and "Title: " in r.summary:
                try:
                    title_part = r.summary.split("Title: ")[1].split(" |")[0]
                    title = title_part.strip()
                except IndexError:
                    title = filename
            else:
                title = filename
            content_display = None # No content for file records
            file_type = r.record_type
            
        response.append(RecordResponse(
            id=r.id,
            patient_id=r.patient_id,
            record_type=r.record_type,
            title=title,
            description=r.summary,
            content=content_display,
            file_url=file_url,
            file_type=file_type,
            created_at=r.created_at.isoformat()
        ))
    return response

@app.post("/api/patients/{patient_id}/records", response_model=RecordResponse)
async def create_text_record(patient_id: int, record: TextRecordCreate, db: AsyncSession = Depends(get_db)):
    """Create a new text record."""
    # We'll store title as the first line of content or just prepend it
    full_content = f"Title: {record.title}\n\n{record.content}"
    
    new_record = MedicalRecord(
        patient_id=patient_id,
        record_type="text",
        content=full_content,
        summary=record.description
    )
    db.add(new_record)
    await db.commit()
    await db.refresh(new_record)
    
    return RecordResponse(
        id=new_record.id,
        patient_id=new_record.patient_id,
        record_type=new_record.record_type,
        title=record.title,
        description=new_record.summary,
        content=new_record.content,
        file_url=None,
        file_type="text",
        created_at=new_record.created_at.isoformat()
    )

@app.post("/api/patients/{patient_id}/records/upload", response_model=RecordResponse)
async def upload_record(
    patient_id: int,
    file: UploadFile = File(...),
    title: str = Form(...),
    description: str = Form(None),
    file_type: str = Form(None),
    db: AsyncSession = Depends(get_db)
):
    """Upload a file record (Image/PDF)."""
    # Generate unique filename
    import uuid
    file_ext = os.path.splitext(file.filename)[1]
    filename = f"{uuid.uuid4()}{file_ext}"
    file_path = UPLOAD_DIR / filename
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    # Determine record type
    record_type = "pdf" if file.content_type == "application/pdf" else "image"
    
    # Store metadata in summary for now since we lack fields
    # Format: "Title: {title} | Type: {file_type} | Desc: {description}"
    metadata_summary = f"Title: {title} | Type: {file_type} | Desc: {description or ''}"
    
    new_record = MedicalRecord(
        patient_id=patient_id,
        record_type=record_type,
        content=str(file_path), # Store path in content
        summary=metadata_summary
    )
    db.add(new_record)
    await db.commit()
    await db.refresh(new_record)
    
    return RecordResponse(
        id=new_record.id,
        patient_id=new_record.patient_id,
        record_type=new_record.record_type,
        title=title,
        description=description,
        content=None,
        file_url=f"http://localhost:8000/uploads/{filename}",
        file_type=file_type,
        created_at=new_record.created_at.isoformat()
    )

@app.delete("/api/records/{record_id}")
async def delete_record(record_id: int, db: AsyncSession = Depends(get_db)):
    """Delete a record."""
    result = await db.execute(select(MedicalRecord).where(MedicalRecord.id == record_id))
    record = result.scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    
    # If it's a file, delete it
    if record.record_type in ["image", "pdf"]:
        try:
            os.remove(record.content)
        except OSError:
            pass # File might not exist
            
    await db.delete(record)
    await db.commit()
    return {"status": "ok", "message": "Record deleted"}


@app.get("/api/tools")
async def list_tools():
    """List all tools and their status."""
    return tool_registry.list_tools()

@app.post("/api/tools/{name}/toggle")
async def toggle_tool(name: str, request: ToolToggleRequest):
    """Enable or disable a tool."""
    if request.enabled:
        tool_registry.enable_tool(name)
    else:
        tool_registry.disable_tool(name)
    return {"name": name, "enabled": tool_registry.is_tool_enabled(name)}


def get_or_create_agent(user_id: str):
    """Get or create agent for user based on feature flag."""
    if user_id not in user_agents:
        system_prompt = os.getenv(
            "SYSTEM_PROMPT",
            "You are a helpful AI assistant. Provide clear, accurate, and concise responses.",
        )

        if USE_LANGGRAPH:
            # Create LangGraph agent with OpenAI
            user_agents[user_id] = LangGraphAgent(
                llm_with_tools=llm_provider.llm,  # Pass the LangChain LLM
                system_prompt=system_prompt,
                memory_manager=memory_manager,
                user_id=user_id,
            )
        else:
            # Create legacy Agent with Gemini
            user_agents[user_id] = Agent(
                llm_provider=llm_provider,
                system_prompt=system_prompt,
                memory_manager=memory_manager,
                user_id=user_id,
            )

    return user_agents[user_id]


@app.post("/api/chat")
async def chat(request: ChatRequest, db: AsyncSession = Depends(get_db)):
    """Chat endpoint with streaming support and patient context.

    Args:
        request: Chat request with message, user_id, and optional stream flag

    Returns:
        StreamingResponse for streaming, ChatResponse for non-streaming
    """
    try:
        if not request.message or not request.message.strip():
            raise HTTPException(status_code=400, detail="Message cannot be empty")

        # Get user-specific agent
        user_agent = get_or_create_agent(request.user_id)
        
        # Inject patient context if provided
        context_message = request.message
        if request.patient_id:
            # Fetch patient info
            result = await db.execute(select(Patient).where(Patient.id == request.patient_id))
            patient = result.scalar_one_or_none()
            if patient:
                context_message = f"Context: Patient {patient.name} (DOB: {patient.dob}, Gender: {patient.gender}).\n\n"
                
                if request.record_id:
                     # Fetch specific record
                     result = await db.execute(select(MedicalRecord).where(MedicalRecord.id == request.record_id))
                     record = result.scalar_one_or_none()
                     if record:
                         context_message += f"Focus Record: {record.record_type}\n"
                         if record.record_type == "text":
                             context_message += f"Content: {record.content}\n"
                         elif record.record_type == "image":
                             # For now, just mention it's an image. 
                             # Future: Pass image to vision model.
                             context_message += f"Image File: {os.path.basename(record.content)}\n"
                             context_message += f"Metadata: {record.summary}\n"
                         elif record.record_type == "pdf":
                             context_message += f"PDF File: {os.path.basename(record.content)}\n"
                             context_message += f"Metadata: {record.summary}\n"
                
                context_message += f"User Query: {request.message}"

        # If streaming is requested
        if request.stream:
            async def generate():
                try:
                    # Process message through agent with streaming
                    stream = user_agent.process_message(
                        user_message=context_message.strip(),
                        stream=True,
                    )

                    # Stream each chunk as Server-Sent Events
                    for event in stream:
                        if isinstance(event, dict):
                            if event["type"] == "content":
                                # Map content to chunk for backward compatibility
                                yield f"data: {json.dumps({'chunk': event['content']})}\n\n"
                            elif event["type"] == "tool_call":
                                yield f"data: {json.dumps({'tool_call': event})}\n\n"
                            elif event["type"] == "tool_result":
                                yield f"data: {json.dumps({'tool_result': event})}\n\n"
                            elif event["type"] == "reasoning":
                                yield f"data: {json.dumps({'reasoning': event['content']})}\n\n"
                        else:
                            # Fallback for string chunks if any
                            yield f"data: {json.dumps({'chunk': event})}\n\n"

                    # Send done signal
                    yield f"data: {json.dumps({'done': True})}\n\n"

                except Exception as e:
                    error_data = json.dumps({'error': str(e)})
                    yield f"data: {error_data}\n\n"

            return StreamingResponse(
                generate(),
                media_type="text/event-stream",
                headers={
                    "Cache-Control": "no-cache",
                    "Connection": "keep-alive",
                    "X-Accel-Buffering": "no",
                },
            )

        # Non-streaming response
        response = user_agent.process_message(
            user_message=context_message.strip(),
            stream=False,
        )

        from datetime import datetime

        return {
            "content": response,
            "timestamp": datetime.now().isoformat(),
            "user_id": request.user_id,
            "memories_used": 0,  # TODO: Track this
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing message: {str(e)}")


@app.delete("/api/chat/history")
async def clear_history(user_id: str = "default"):
    """Clear chat history for a user."""
    try:
        if user_id in user_agents:
            user_agents[user_id].context.clear()
            return {"message": f"Chat history cleared for user {user_id}", "status": "ok"}
        return {"message": "No history found", "status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error clearing history: {str(e)}")


@app.get("/api/memory/stats/{user_id}")
async def get_memory_stats(user_id: str):
    """Get memory statistics for a user."""
    try:
        if not memory_manager:
            raise HTTPException(status_code=503, detail="Memory system not enabled")

        stats = memory_manager.get_memory_stats(user_id)
        return stats

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting memory stats: {str(e)}")


@app.delete("/api/memory/{user_id}")
async def delete_user_memories(user_id: str):
    """Delete all memories for a user (GDPR right to erasure)."""
    try:
        if not memory_manager:
            raise HTTPException(status_code=503, detail="Memory system not enabled")

        success = memory_manager.delete_user_memories(user_id)

        if success:
            # Also clear user agent
            if user_id in user_agents:
                del user_agents[user_id]

            return {
                "message": f"All memories deleted for user {user_id}",
                "status": "ok",
            }
        else:
            raise HTTPException(status_code=500, detail="Failed to delete user memories")

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting memories: {str(e)}")


@app.get("/api/memory/export/{user_id}")
async def export_user_memories(user_id: str):
    """Export all memories for a user (GDPR right to data portability)."""
    try:
        if not memory_manager:
            raise HTTPException(status_code=503, detail="Memory system not enabled")

        memories = memory_manager.get_all_memories(user_id)

        from datetime import datetime

        return {
            "user_id": user_id,
            "export_date": datetime.now().isoformat(),
            "total_memories": len(memories),
            "memories": memories,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error exporting memories: {str(e)}")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "src.api.server:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
    )
