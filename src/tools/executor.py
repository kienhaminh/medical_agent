"""Tool executor for safe tool invocation with error handling."""

import logging
from typing import Any

from .registry import ToolRegistry
from .base import ToolResult

logger = logging.getLogger(__name__)


class ToolExecutor:
    """Executes tools with comprehensive error handling.

    Provides safe wrapper around tool invocation with:
    - Tool existence validation
    - Parameter validation (via Pydantic schemas)
    - Exception catching and error formatting
    - Execution logging

    Args:
        registry: ToolRegistry instance containing registered tools

    Example:
        >>> registry = ToolRegistry()
        >>> executor = ToolExecutor(registry)
        >>> result = executor.execute("get_time", {})
        >>> if result.success:
        ...     print(result.data)
    """

    def __init__(self, registry: ToolRegistry):
        """Initialize executor with tool registry.

        Args:
            registry: ToolRegistry containing available tools
        """
        self.registry = registry

    def execute(self, name: str, args: dict[str, Any]) -> ToolResult:
        """Execute tool with error handling.

        Invokes tool by name with provided arguments. Handles all errors
        gracefully, returning ToolResult with success/failure status.

        Args:
            name: Tool name to execute
            args: Tool arguments as dictionary (matches tool's parameter schema)

        Returns:
            ToolResult with execution outcome:
            - success=True, data=<tool output> on success
            - success=False, error=<error message> on failure

        Error Cases:
            - Tool not found in registry
            - Invalid arguments (Pydantic validation)
            - Tool execution exception
            - Unexpected errors

        Example:
            >>> result = executor.execute("get_datetime", {"timezone": "UTC"})
            >>> print(result.to_string())
            2025-11-16T13:24:00+00:00

            >>> result = executor.execute("unknown_tool", {})
            >>> print(result.to_string())
            Error: Tool 'unknown_tool' not found
        """
        # Validate tool exists
        tool = self.registry.get(name)
        if not tool:
            error_msg = f"Tool '{name}' not found"
            logger.warning(error_msg)
            return ToolResult(success=False, error=error_msg)

        try:
            # Execute tool directly
            logger.debug(f"Executing tool '{name}' with args: {args}")
            result = tool(**args)
            logger.debug(f"Tool '{name}' succeeded with result: {result}")
            return ToolResult(success=True, data=result)

        except Exception as e:
            # Catch all exceptions and convert to user-friendly error
            error_msg = str(e)
            logger.error(f"Tool '{name}' failed: {error_msg}", exc_info=True)
            return ToolResult(success=False, error=error_msg)
