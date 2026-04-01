def format_specialist_report(agent_name: str, content: str) -> str:
    """Format a report from a specialist."""
    return f"REPORT FROM SPECIALIST **[{agent_name}]**:\n{content}"

def format_specialist_error(agent_name: str, error: str) -> str:
    """Format an error report from a specialist."""
    return f"REPORT FROM SPECIALIST **[{agent_name}]**: Error during consultation - {error}"

def format_specialist_timeout(timeout: float) -> str:
    """Format a timeout report."""
    return f"REPORT FROM SPECIALIST **[Timeout]**: Sub-agent consultation exceeded {timeout}s timeout"

def format_specialist_exception(agent_role: str, exception: str) -> str:
    """Format an exception report from a specialist."""
    return f"REPORT FROM SPECIALIST **[{agent_role}]**: Exception - {exception}"
