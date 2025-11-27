"""Adapters to convert existing tools to LangChain format."""

from typing import Callable, Optional, Any
from langchain_core.tools import tool as langchain_tool
import inspect
import json


def convert_to_langchain_tool(func: Callable) -> Callable:
    """Convert existing tool function to LangChain @tool format.

    LangChain auto-generates schemas from function signatures and docstrings.
    This adapter preserves the function signature, docstring, and name.

    Args:
        func: Tool function to convert

    Returns:
        LangChain tool function

    Example:
        >>> def my_tool(arg: str) -> str:
        ...     '''My tool docstring.'''
        ...     return f"Result: {arg}"
        >>> lc_tool = convert_to_langchain_tool(my_tool)
        >>> # lc_tool is now a LangChain tool with auto-generated schema
    """
    # Apply @tool decorator from LangChain
    # This automatically generates the tool schema from the function signature
    return langchain_tool(func)


def convert_db_tool_to_langchain(db_tool, tool_func: Optional[Callable] = None) -> Callable:
    """Convert a database Tool object to LangChain format with enriched description.
    
    This function creates an enhanced tool description that includes:
    - For API tools: endpoint, request/response schemas and examples
    - For function tools: enhanced description with DB metadata
    
    Args:
        db_tool: Database Tool object with metadata
        tool_func: Optional callable function (if already registered in memory)
        
    Returns:
        LangChain tool function with enriched description
    """
    # Build enriched docstring based on tool type
    enriched_docstring = build_enriched_docstring(db_tool, tool_func)
    
    # Get or create the executable function
    if tool_func is not None:
        # Use existing function but update its docstring
        func = tool_func
        # Update the function's docstring
        func.__doc__ = enriched_docstring
    elif db_tool.tool_type == "api":
        # Create wrapper function for API calls
        func = create_api_wrapper_function(db_tool, enriched_docstring)
    else:
        # No function available and not an API tool - this shouldn't happen
        raise ValueError(f"Tool {db_tool.name} has no executable code and is not an API tool")
    
    # Convert to LangChain format
    return langchain_tool(func)


def build_enriched_docstring(db_tool, tool_func: Optional[Callable] = None) -> str:
    """Build an enriched docstring for a tool.
    
    Args:
        db_tool: Database Tool object
        tool_func: Optional callable function
        
    Returns:
        Enriched docstring string
    """
    # Start with base description from database
    parts = [db_tool.description]
    
    if db_tool.tool_type == "api" and db_tool.api_endpoint:
        # Add API-specific information
        parts.append("\n\n**API Tool Information:**")
        parts.append(f"\n- Endpoint: `{db_tool.api_endpoint}`")
        
        if db_tool.api_request_payload:
            parts.append("\n\n**Request Schema:**")
            parts.append(f"\n```json\n{_format_json(db_tool.api_request_payload)}\n```")
        
        if db_tool.api_request_example:
            parts.append("\n\n**Request Example:**")
            parts.append(f"\n```json\n{_format_json(db_tool.api_request_example)}\n```")
        
        if db_tool.api_response_payload:
            parts.append("\n\n**Response Schema:**")
            parts.append(f"\n```json\n{_format_json(db_tool.api_response_payload)}\n```")
        
        if db_tool.api_response_example:
            parts.append("\n\n**Response Example:**")
            parts.append(f"\n```json\n{_format_json(db_tool.api_response_example)}\n```")
    
    elif db_tool.tool_type == "function" and tool_func:
        # For function tools, add parameter information from function signature
        try:
            sig = inspect.signature(tool_func)
            if sig.parameters:
                parts.append("\n\n**Parameters:**")
                for param_name, param in sig.parameters.items():
                    param_type = param.annotation if param.annotation != inspect.Parameter.empty else "Any"
                    param_default = f" = {param.default}" if param.default != inspect.Parameter.empty else ""
                    parts.append(f"\n- `{param_name}`: {param_type}{param_default}")
        except Exception:
            # If we can't get signature, just skip parameter details
            pass
    
    return "".join(parts)


def _format_json(json_str: str) -> str:
    """Format JSON string for better readability.
    
    Args:
        json_str: JSON string (may already be formatted)
        
    Returns:
        Formatted JSON string
    """
    try:
        # Try to parse and re-format
        obj = json.loads(json_str)
        return json.dumps(obj, indent=2)
    except (json.JSONDecodeError, TypeError):
        # If parsing fails, return as-is
        return json_str


def create_api_wrapper_function(db_tool, docstring: str) -> Callable:
    """Create a wrapper function for API-based tools.
    
    Args:
        db_tool: Database Tool object with API configuration
        docstring: Enriched docstring for the function
        
    Returns:
        Callable function that makes API calls
    """
    import requests
    
    def api_tool_wrapper(**kwargs) -> str:
        """Execute API call with provided parameters."""
        try:
            # Make API request
            # For now, assume POST request with JSON body
            # This can be enhanced to support different HTTP methods
            print(f"API Request Payload: {kwargs}")
            response = requests.post(
                db_tool.api_endpoint,
                json=kwargs,
                timeout=90
            )
            response.raise_for_status()
            
            # Return response
            return response.text
        except requests.RequestException as e:
            return f"API Error: {str(e)}"
        except Exception as e:
            return f"Error: {str(e)}"
    
    # Set function metadata
    api_tool_wrapper.__name__ = db_tool.symbol
    api_tool_wrapper.__doc__ = docstring
    
    return api_tool_wrapper


def get_langchain_tools_from_registry(registry) -> list:
    """Convert all registered tools to LangChain format.

    Args:
        registry: ToolRegistry instance

    Returns:
        List of LangChain tool objects

    Example:
        >>> from src.tools.registry import ToolRegistry
        >>> registry = ToolRegistry()
        >>> lc_tools = get_langchain_tools_from_registry(registry)
        >>> # All tools converted to LangChain format
    """
    tools = registry.get_all_tools()
    return [convert_to_langchain_tool(t) for t in tools]
