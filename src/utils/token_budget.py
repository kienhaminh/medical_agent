"""Token budget utilities for LangChain message lists.

Provides token counting and history trimming for the LangGraph agent pipeline.
Never drops SystemMessage entries; trims oldest non-system messages first.
"""

import logging
from langchain_core.messages import BaseMessage, SystemMessage

logger = logging.getLogger(__name__)

_OVERHEAD_PER_MESSAGE = 4  # role + formatting overhead estimate


def count_text_tokens(text: str) -> int:
    """Count tokens in text using tiktoken, falling back to char estimate."""
    try:
        import tiktoken
        enc = tiktoken.get_encoding("cl100k_base")
        return len(enc.encode(text))
    except Exception:
        return max(1, len(text) // 4)


def count_message_tokens(messages: list[BaseMessage]) -> int:
    """Count total tokens across a list of LangChain messages."""
    total = 0
    for msg in messages:
        content = msg.content if isinstance(msg.content, str) else str(msg.content)
        total += count_text_tokens(content) + _OVERHEAD_PER_MESSAGE
    return total


def trim_to_token_budget(
    messages: list[BaseMessage],
    budget: int,
) -> list[BaseMessage]:
    """Trim a LangChain message list to fit within a token budget.

    SystemMessage entries are never dropped. Oldest non-system messages
    are dropped first (from the front of the list) until total tokens
    fall within budget.

    Args:
        messages: List of LangChain BaseMessage objects.
        budget: Target maximum token count.

    Returns:
        Trimmed list. System messages always included regardless of budget.
    """
    if not messages:
        return []

    system_msgs = [m for m in messages if isinstance(m, SystemMessage)]
    other_msgs = [m for m in messages if not isinstance(m, SystemMessage)]

    total = count_message_tokens(system_msgs) + count_message_tokens(other_msgs)

    dropped = 0
    while total > budget and other_msgs:
        removed = other_msgs.pop(0)
        total -= count_message_tokens([removed])
        dropped += 1

    if dropped:
        logger.debug("trim_to_token_budget: dropped %d messages to fit budget=%d", dropped, budget)

    # Preserve original message order: include SystemMessages and remaining other_msgs
    remaining_ids = {id(m) for m in other_msgs}
    return [m for m in messages if isinstance(m, SystemMessage) or id(m) in remaining_ids]
