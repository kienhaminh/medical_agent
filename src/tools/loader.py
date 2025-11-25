"""Dynamic tool loader for loading custom tools from database."""

import logging
from sqlalchemy import select
from src.config.database import Tool, AsyncSessionLocal
from src.tools.registry import ToolRegistry

logger = logging.getLogger(__name__)

async def load_custom_tools():
    """Load enabled custom tools from database and register them."""
    registry = ToolRegistry()
    
    try:
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(Tool)
            )
            tools = result.scalars().all()
            
            for tool_record in tools:
                if not tool_record.code:
                    continue
                    
                try:
                    # Create a global scope with necessary imports for tool execution
                    # This allows tools to use common imports like SessionLocal, typing, etc.
                    import typing
                    import sqlalchemy
                    import sqlalchemy.orm
                    from src.config.database import (
                        SessionLocal, 
                        AsyncSessionLocal as DbAsyncSessionLocal,
                        Patient, 
                        MedicalRecord,
                        SubAgent,
                        Tool as ToolModel
                    )
                    
                    global_scope = {
                        # Typing imports
                        # 'Optional': typing.Optional, # Removed to avoid inspection errors
                        # 'List': typing.List,
                        # 'Dict': typing.Dict,
                        # 'Any': typing.Any,
                        'typing': typing, # Add typing module instead
                        
                        # SQLAlchemy imports
                        'select': sqlalchemy.select,
                        'or_': sqlalchemy.or_,
                        'and_': sqlalchemy.and_,
                        'Session': sqlalchemy.orm.Session,
                        
                        # Database imports
                        'SessionLocal': SessionLocal,
                        'AsyncSessionLocal': DbAsyncSessionLocal,
                        'Patient': Patient,
                        'MedicalRecord': MedicalRecord,
                        'SubAgent': SubAgent,
                        'Tool': ToolModel,
                    }
                    
                    # Create a local scope for execution
                    local_scope = {}
                    
                    # Execute the tool code with proper global scope
                    # WARNING: Executing arbitrary code from DB is risky.
                    # Ensure DB access is restricted.
                    exec(tool_record.code, global_scope, local_scope)
                    
                    # Find the function that matches the tool name
                    # or fallback to the first callable found
                    tool_func = local_scope.get(tool_record.name)
                    
                    if not tool_func:
                        # Try to find any callable if name doesn't match
                        callables = [v for v in local_scope.values() if callable(v)]
                        if callables:
                            tool_func = callables[0]
                    
                    if tool_func:
                        # Register the tool with its scope and symbol from database
                        # ToolRegistry raises ValueError on duplicate, so we might need to handle that
                        try:
                            scope = tool_record.scope or "global"  # Default to global if not set
                            symbol = tool_record.symbol  # Use the unique symbol from database
                            registry.register(tool_func, scope=scope, symbol=symbol)
                            logger.info(f"Loaded custom tool: {tool_record.name} (symbol: {symbol}, scope: {scope})")
                        except ValueError:
                            # If already registered, maybe we want to update it?
                            # For now, just log warning
                            logger.warning(f"Tool {tool_record.name} (symbol: {tool_record.symbol}) already registered, skipping.")
                    else:
                        logger.warning(f"No callable found in code for tool: {tool_record.name}")
                        
                except Exception as e:
                    logger.error(f"Failed to load tool {tool_record.name}: {e}")
                    
    except Exception as e:
        logger.error(f"Failed to load custom tools from DB: {e}")
