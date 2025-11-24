from typing import Dict, Any

def build_decision_context(system_prompt: str, sub_agents: Dict[str, Dict[str, Any]]) -> str:
    """Build context for main agent's decision-making.
    
    Args:
        system_prompt: The base system prompt
        sub_agents: Dictionary of available sub-agents
        
    Returns:
        Complete decision context with specialist information
    """
    specialist_list = ""
    if sub_agents:
        specialist_list = "\n" + "="*70 + "\n"
        specialist_list += "AVAILABLE SPECIALISTS\n"
        specialist_list += "="*70 + "\n\n"
        for role, info in sub_agents.items():
            specialist_list += f"**{info['name']}** (role: {role})\n"
            specialist_list += f"Description: {info['description']}\n"
            specialist_list += "\n"
        specialist_list += "="*70 + "\n"
    else:
        specialist_list = "\n(No specialists currently available)\n"
    
    return f"""{system_prompt}

{specialist_list}"""

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
