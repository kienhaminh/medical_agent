import os
import json
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ...config.database import get_db, Patient, MedicalRecord, ChatSession, ChatMessage
from ..models import (
    ChatRequest, ChatResponse, ChatSessionResponse, ChatMessageResponse
)
from ..dependencies import get_or_create_agent, memory_manager

router = APIRouter()

@router.post("/api/chat")
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

        # 1. Manage Chat Session
        session = None
        if request.session_id:
            result = await db.execute(select(ChatSession).where(ChatSession.id == request.session_id))
            session = result.scalar_one_or_none()
        
        if not session:
            # Create new session
            session = ChatSession(
                title=request.message[:50] + "..." if len(request.message) > 50 else request.message,
                # agent_id could be set if we knew which agent is handling it primarily
            )
            db.add(session)
            await db.commit()
            await db.refresh(session)

        # 2. Save User Message
        user_msg = ChatMessage(
            session_id=session.id,
            role="user",
            content=request.message
        )
        db.add(user_msg)
        await db.commit()

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
        
        # Load chat history if session exists
        chat_history = []
        if session:
            stmt = select(ChatMessage).where(ChatMessage.session_id == session.id).order_by(ChatMessage.created_at)
            result = await db.execute(stmt)
            existing_messages = result.scalars().all()
            
            # Convert database messages to chat history format
            # Exclude the current user message we just saved
            for msg in existing_messages:
                if msg.id != user_msg.id:  # Skip the message we just added
                    chat_history.append({
                        "role": msg.role,
                        "content": msg.content
                    })

        # If streaming is requested
        if request.stream:
            async def generate():
                full_response = ""
                try:
                    # Process message through agent with streaming (await to get async generator)
                    stream = await user_agent.process_message(
                        user_message=context_message.strip(),
                        stream=True,
                        chat_history=chat_history,
                    )

                    # Stream each chunk as Server-Sent Events (async iteration)
                    async for event in stream:
                        if isinstance(event, dict):
                            if event["type"] == "content":
                                # Map content to chunk for backward compatibility
                                chunk_content = event['content']
                                full_response += chunk_content # Accumulate
                                yield f"data: {json.dumps({'chunk': chunk_content})}\n\n"
                            elif event["type"] == "tool_call":
                                yield f"data: {json.dumps({'tool_call': event})}\n\n"
                            elif event["type"] == "tool_result":
                                yield f"data: {json.dumps({'tool_result': event})}\n\n"
                            elif event["type"] == "reasoning":
                                yield f"data: {json.dumps({'reasoning': event['content']})}\n\n"
                            elif event["type"] == "log":
                                yield f"data: {json.dumps({'log': event['content']})}\n\n"
                            elif event["type"] == "patient_references":
                                # Forward patient references to frontend
                                yield f"data: {json.dumps({'patient_references': event['patient_references']})}\n\n"
                        else:
                            # Fallback for string chunks if any
                            # LangGraphAgent yields full content in 'values' mode, so we update full_response
                            full_response = event
                            yield f"data: {json.dumps({'chunk': event})}\n\n"

                    # 3. Save Assistant Message (after streaming is done)
                    if full_response:
                        # Create a new session for saving the message to avoid "session closed" errors
                        # in the streaming response callback
                        from ...config.database import AsyncSessionLocal
                        async with AsyncSessionLocal() as local_db:
                            assistant_msg = ChatMessage(
                                session_id=session.id,
                                role="assistant",
                                content=full_response
                            )
                            local_db.add(assistant_msg)
                            await local_db.commit()

                    # Send session_id and done signal
                    yield f"data: {json.dumps({'session_id': session.id})}\n\n"
                    yield f"data: {json.dumps({'done': True})}\n\n"

                except Exception as e:
                    error_data = json.dumps({'error': str(e)})
                    yield f"data: {error_data}\n\n"

            return StreamingResponse(
                generate(),
                media_type="text/event-stream",
            )
        else:
            # Non-streaming response (await the async call)
            response = await user_agent.process_message(
                user_message=context_message.strip(),
                stream=False,
                chat_history=chat_history,
            )
            
            # 3. Save Assistant Message
            assistant_msg = ChatMessage(
                session_id=session.id,
                role="assistant",
                content=response
            )
            db.add(assistant_msg)
            await db.commit()

            return ChatResponse(
                content=response,
                timestamp="", # TODO: Add timestamp
                user_id=request.user_id,
                session_id=session.id
            )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/api/chat/sessions", response_model=list[ChatSessionResponse])
async def get_chat_sessions(db: AsyncSession = Depends(get_db)):
    """Get all chat sessions."""
    try:
        stmt = select(ChatSession).order_by(ChatSession.updated_at.desc())
        result = await db.execute(stmt)
        sessions = result.scalars().all()

        response = []
        for session in sessions:
            # Get message count
            msg_stmt = select(ChatMessage).where(ChatMessage.session_id == session.id)
            msg_result = await db.execute(msg_stmt)
            messages = msg_result.scalars().all()

            # Get agent name if applicable
            agent_name = None
            # if session.agent_id:
            #     agent = await db.get(SubAgent, session.agent_id)
            #     if agent:
            #         agent_name = agent.name

            # Get preview from last message
            preview = None
            if messages:
                last_msg = messages[-1]
                preview = last_msg.content[:50] + "..." if len(last_msg.content) > 50 else last_msg.content

            response.append(ChatSessionResponse(
                id=session.id,
                title=session.title,
                agent_id=session.agent_id,
                agent_name=agent_name,
                message_count=len(messages),
                preview=preview,
                tags=[],  # TODO: Extract tags from content
                created_at=session.created_at.isoformat(),
                updated_at=session.updated_at.isoformat()
            ))

        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching chat sessions: {str(e)}")

@router.get("/api/chat/sessions/{session_id}/messages", response_model=list[ChatMessageResponse])
async def get_session_messages(session_id: int, db: AsyncSession = Depends(get_db)):
    """Get all messages for a specific chat session."""
    try:
        # Check session exists
        stmt = select(ChatSession).where(ChatSession.id == session_id)
        result = await db.execute(stmt)
        session = result.scalar_one_or_none()

        if not session:
            raise HTTPException(status_code=404, detail="Chat session not found")

        # Get messages
        msg_stmt = select(ChatMessage).where(ChatMessage.session_id == session_id).order_by(ChatMessage.created_at)
        msg_result = await db.execute(msg_stmt)
        messages = msg_result.scalars().all()

        return [
            ChatMessageResponse(
                id=msg.id,
                session_id=msg.session_id,
                role=msg.role,
                content=msg.content,
                tool_calls=msg.tool_calls,
                reasoning=msg.reasoning,
                created_at=msg.created_at.isoformat()
            )
            for msg in messages
        ]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching messages: {str(e)}")

@router.delete("/api/chat/sessions/{session_id}")
async def delete_chat_session(session_id: int, db: AsyncSession = Depends(get_db)):
    """Delete a specific chat session."""
    try:
        # Check session exists
        stmt = select(ChatSession).where(ChatSession.id == session_id)
        result = await db.execute(stmt)
        session = result.scalar_one_or_none()

        if not session:
            raise HTTPException(status_code=404, detail="Chat session not found")

        # Delete session (cascade delete should handle messages if configured, otherwise delete messages first)
        # Assuming cascade delete is configured or we delete messages manually
        msg_stmt = select(ChatMessage).where(ChatMessage.session_id == session_id)
        msg_result = await db.execute(msg_stmt)
        messages = msg_result.scalars().all()
        
        for msg in messages:
            await db.delete(msg)
            
        await db.delete(session)
        await db.commit()

        return {"message": "Chat session deleted successfully", "id": session_id}
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Error deleting chat session: {str(e)}")

@router.delete("/api/chat/history")
async def clear_history(user_id: str = "default"):
    """Clear chat history for a user."""
    try:
        # This clears the in-memory context of the agent
        # It does NOT clear the database chat sessions
        agent = get_or_create_agent(user_id)
        if hasattr(agent, 'context'):
             agent.context.clear()
             return {"message": f"Chat history cleared for user {user_id}", "status": "ok"}
        # If using LangGraphAgent, it might handle history differently (via Checkpointer)
        # For now, just return ok
        return {"message": "No history found or cleared", "status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error clearing history: {str(e)}")

@router.get("/api/memory/stats/{user_id}")
async def get_memory_stats(user_id: str):
    """Get memory statistics for a user."""
    try:
        if not memory_manager:
            raise HTTPException(status_code=503, detail="Memory system not enabled")

        stats = memory_manager.get_memory_stats(user_id)
        return stats

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting memory stats: {str(e)}")

@router.get("/api/memory/export/{user_id}")
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
