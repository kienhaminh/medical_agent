from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
import logging
from ...config.database import get_db, Tool
from ..models import ToolResponse, ToolCreate, ToolUpdate, ToolTestRequest, ToolTestResponse

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/api/tools", response_model=list[ToolResponse])
async def list_tools(db: AsyncSession = Depends(get_db)):
    """List all tools and their status from database."""
    result = await db.execute(select(Tool).order_by(Tool.created_at.desc()))
    tools = result.scalars().all()

    return [
        ToolResponse(
            id=tool.id,
            name=tool.name,
            symbol=tool.symbol,
            description=tool.description,
            tool_type=tool.tool_type,
            code=tool.code,
            api_endpoint=tool.api_endpoint,
            api_request_payload=tool.api_request_payload,
            api_request_example=tool.api_request_example,
            api_response_payload=tool.api_response_payload,
            api_response_example=tool.api_response_example,
            enabled=tool.enabled,
            test_passed=tool.test_passed,
            scope=tool.scope,
            assigned_agent_id=tool.assigned_agent_id
        ) for tool in tools
    ]

@router.post("/api/tools", response_model=ToolResponse)
async def create_tool(tool_data: ToolCreate, db: AsyncSession = Depends(get_db)):
    """Create a new tool."""
    # Check if tool already exists
    result = await db.execute(select(Tool).where(Tool.name == tool_data.name))
    existing_tool = result.scalar_one_or_none()

    if existing_tool:
        raise HTTPException(status_code=400, detail=f"Tool '{tool_data.name}' already exists")

    # Check if symbol already exists
    result = await db.execute(select(Tool).where(Tool.symbol == tool_data.symbol))
    existing_symbol = result.scalar_one_or_none()

    if existing_symbol:
        raise HTTPException(status_code=400, detail=f"Tool symbol '{tool_data.symbol}' already exists")

    # Create new tool
    new_tool = Tool(
        name=tool_data.name,
        symbol=tool_data.symbol,
        description=tool_data.description,
        tool_type=tool_data.tool_type,
        code=tool_data.code,
        api_endpoint=tool_data.api_endpoint,
        api_request_payload=tool_data.api_request_payload,
        api_request_example=tool_data.api_request_example,
        api_response_payload=tool_data.api_response_payload,
        api_response_example=tool_data.api_response_example,
        enabled=tool_data.enabled,
        test_passed=tool_data.test_passed,
        scope=tool_data.scope
    )

    # Enforce: If enabled is True, test_passed must be True
    if new_tool.enabled and not new_tool.test_passed:
        raise HTTPException(status_code=400, detail="Tool cannot be enabled without passing test")

    db.add(new_tool)
    await db.commit()
    await db.refresh(new_tool)

    return ToolResponse(
        id=new_tool.id,
        name=new_tool.name,
        symbol=new_tool.symbol,
        description=new_tool.description,
        tool_type=new_tool.tool_type,
        code=new_tool.code,
        api_endpoint=new_tool.api_endpoint,
        api_request_payload=new_tool.api_request_payload,
        api_request_example=new_tool.api_request_example,
        api_response_payload=new_tool.api_response_payload,
        api_response_example=new_tool.api_response_example,
        enabled=new_tool.enabled,
        test_passed=new_tool.test_passed,
        scope=new_tool.scope,
        assigned_agent_id=new_tool.assigned_agent_id
    )

@router.put("/api/tools/{tool_id}", response_model=ToolResponse)
async def update_tool(tool_id: int, tool_data: ToolUpdate, db: AsyncSession = Depends(get_db)):
    """Update an existing tool."""
    result = await db.execute(select(Tool).where(Tool.id == tool_id))
    tool = result.scalar_one_or_none()

    if not tool:
        raise HTTPException(status_code=404, detail=f"Tool with id {tool_id} not found")

    # Update fields if provided
    if tool_data.description is not None:
        tool.description = tool_data.description
    if tool_data.tool_type is not None:
        tool.tool_type = tool_data.tool_type
    if tool_data.code is not None:
        tool.code = tool_data.code
    if tool_data.api_endpoint is not None:
        tool.api_endpoint = tool_data.api_endpoint
    if tool_data.api_request_payload is not None:
        tool.api_request_payload = tool_data.api_request_payload
    if tool_data.api_request_example is not None:
        tool.api_request_example = tool_data.api_request_example
    if tool_data.api_response_payload is not None:
        tool.api_response_payload = tool_data.api_response_payload
    if tool_data.api_response_example is not None:
        tool.api_response_example = tool_data.api_response_example
    if tool_data.test_passed is not None:
        tool.test_passed = tool_data.test_passed
    else:
        # If test_passed is not explicitly provided (e.g. just updating description), 
        # we might want to keep it or reset it depending on what changed.
        # For now, let's assume if code/api changes, we should reset test_passed.
        if tool_data.code is not None or tool_data.api_endpoint is not None:
             tool.test_passed = False

    if tool_data.enabled is not None:
        tool.enabled = tool_data.enabled
    
    # Enforce: If enabled is True (new or existing), test_passed must be True
    if tool.enabled and not tool.test_passed:
        # If user tried to enable it, error
        if tool_data.enabled is True:
             raise HTTPException(status_code=400, detail="Tool cannot be enabled without passing test")
        # If it was already enabled but test_passed became false (e.g. code change), disable it
        tool.enabled = False

    await db.commit()
    await db.refresh(tool)

    return ToolResponse(
        id=tool.id,
        name=tool.name,
        symbol=tool.symbol,
        description=tool.description,
        tool_type=tool.tool_type,
        code=tool.code,
        api_endpoint=tool.api_endpoint,
        api_request_payload=tool.api_request_payload,
        api_request_example=tool.api_request_example,
        api_response_payload=tool.api_response_payload,
        api_response_example=tool.api_response_example,
        enabled=tool.enabled,
        test_passed=tool.test_passed,
        scope=tool.scope,
        assigned_agent_id=tool.assigned_agent_id
    )

@router.delete("/api/tools/{tool_id}")
async def delete_tool(tool_id: int, db: AsyncSession = Depends(get_db)):
    """Delete a tool and its assignments."""
    result = await db.execute(select(Tool).where(Tool.id == tool_id))
    tool = result.scalar_one_or_none()

    if not tool:
        raise HTTPException(status_code=404, detail=f"Tool with id {tool_id} not found")

    tool_name = tool.name
    await db.delete(tool)
    await db.commit()

    return {"message": f"Tool '{tool_name}' deleted successfully"}

@router.post("/api/tools/test", response_model=ToolTestResponse)
async def test_tool(request: ToolTestRequest):
    """Test a tool execution."""
    try:
        if request.tool_type == "function":
            if not request.code:
                raise HTTPException(status_code=400, detail="Code is required for function tool")
            
            # Create a local scope to execute the code
            local_scope = {}
            try:
                # Execute the code definition
                exec(request.code, globals(), local_scope)
                
                # Find the function in the local scope
                # We assume the last defined function is the one to call, or we look for one
                func = None
                for item in local_scope.values():
                    if callable(item):
                        func = item
                        break
                
                if not func:
                    return ToolTestResponse(
                        status="error",
                        error="No function found in the provided code"
                    )
                
                # Call the function with arguments
                import inspect
                if inspect.iscoroutinefunction(func):
                    result = await func(**request.arguments)
                else:
                    result = func(**request.arguments)

                # Log the function tool result
                logger.info(
                    "Tool test (function) executed",
                    extra={
                        "tool_type": "function",
                        "tool_name": getattr(request, "name", None),
                        "result_preview": str(result)[:500],
                    },
                )
                
                return ToolTestResponse(
                    status="success",
                    result=str(result)
                )
            except Exception as e:
                import traceback
                return ToolTestResponse(
                    status="error",
                    error=f"Execution error: {str(e)}\n{traceback.format_exc()}"
                )
                
        elif request.tool_type == "api":
            if not request.api_endpoint:
                raise HTTPException(status_code=400, detail="API endpoint is required for API tool")

            import httpx
            import json
            try:
                # Determine HTTP method
                method = "GET" if not request.arguments else "POST"

                # Log the request details
                logger.info(f"Testing API tool: {method} {request.api_endpoint}")
                logger.info(f"Request arguments: {json.dumps(request.arguments, indent=2)}")
                logger.info(f"api_request_payload (schema): {request.api_request_payload}")

                async with httpx.AsyncClient(timeout=30.0) as client:
                    if method == "GET":
                        logger.info(f"Sending GET request with params: {request.arguments}")
                        response = await client.get(request.api_endpoint, params=request.arguments)
                    else:
                        logger.info(f"Sending POST request with JSON body: {json.dumps(request.arguments, indent=2)}")
                        response = await client.post(request.api_endpoint, json=request.arguments)

                    # Log the response
                    logger.info(f"Response status: {response.status_code}")
                    logger.info(f"Response headers: {dict(response.headers)}")
                    logger.info(f"Response body: {response.text[:1000]}")

                    # Check if response is successful
                    if response.status_code >= 400:
                        logger.error(f"API returned error status {response.status_code}: {response.text}")
                        return ToolTestResponse(
                            status="error",
                            error=f"API returned status {response.status_code}: {response.text[:500]}"
                        )

                    return ToolTestResponse(
                        status="success",
                        result=response.text
                    )
            except httpx.TimeoutException as e:
                logger.error(f"API request timeout: {str(e)}")
                return ToolTestResponse(
                    status="error",
                    error=f"API request timeout after 30 seconds: {str(e)}"
                )
            except httpx.RequestError as e:
                logger.error(f"API request error: {str(e)}")
                return ToolTestResponse(
                    status="error",
                    error=f"API request error: {str(e)}"
                )
            except Exception as e:
                logger.error(f"Unexpected error during API test: {str(e)}")
                import traceback
                logger.error(traceback.format_exc())
                return ToolTestResponse(
                    status="error",
                    error=f"Unexpected error: {str(e)}"
                )
        
        else:
            raise HTTPException(status_code=400, detail=f"Invalid tool type: {request.tool_type}")
            
    except Exception as e:
        return ToolTestResponse(
            status="error",
            error=f"Unexpected error: {str(e)}"
        )
