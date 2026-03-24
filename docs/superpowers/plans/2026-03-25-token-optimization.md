# Token Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce per-turn LLM input tokens by ~60% through prompt trimming, duplicate removal, token budget enforcement on chat history, and specialist prompt length warnings that enable provider-side caching.

**Architecture:** Five independent changes to the message assembly pipeline. A new standalone utility `token_budget.py` handles LangChain-message-aware trimming. The static system prompt is stabilized as a module-level constant (not a function that rebuilds a string) so the provider can cache it. Dynamic content (specialist list, memory, history) is appended after the static prefix and token-capped.

**Tech Stack:** Python 3.11+, LangChain Core (`BaseMessage`), tiktoken (transitive dep via `langchain-openai`; falls back to `len//4` if unavailable), pytest.

**Spec:** `docs/superpowers/specs/2026-03-25-token-optimization-design.md`

---

## File Map

| Action | Path | Purpose |
|---|---|---|
| Create | `src/utils/token_budget.py` | Standalone token counting + history trimmer for LangChain messages |
| Create | `tests/unit/test_token_budget.py` | Unit tests for the above |
| Modify | `src/prompt/system.py` | Replace 209-line prompt with ~40-line trimmed version; add specialist list helper |
| Modify | `src/agent/graph_builder.py:147` | Remove duplicate `[SystemMessage(...)] +` prepend |
| Modify | `src/agent/langgraph_agent.py:248-273` | Add specialist list message, memory dedup+cap, history budget trim |
| Modify | `src/agent/specialist_handler.py:229` | Add warning when specialist system_prompt exceeds 300 tokens |

---

## Task 1: Token Budget Utility

**Files:**
- Create: `src/utils/token_budget.py`
- Create: `tests/unit/test_token_budget.py`

- [ ] **Step 1: Write the failing tests**

```python
# tests/unit/test_token_budget.py
import pytest
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from src.utils.token_budget import trim_to_token_budget, count_message_tokens


class TestTrimToTokenBudget:
    def test_empty_list_returns_empty(self):
        assert trim_to_token_budget([], budget=100) == []

    def test_only_system_messages_never_dropped(self):
        msgs = [SystemMessage(content="sys1"), SystemMessage(content="sys2")]
        result = trim_to_token_budget(msgs, budget=1)  # impossibly small budget
        assert len(result) == 2
        assert all(isinstance(m, SystemMessage) for m in result)

    def test_oldest_messages_dropped_first(self):
        msgs = [
            HumanMessage(content="old message"),
            AIMessage(content="old reply"),
            HumanMessage(content="recent message"),
            AIMessage(content="recent reply"),
        ]
        # Force trim by using a tiny budget that keeps only the recent pair
        budget = count_message_tokens([msgs[2], msgs[3]]) + 10
        result = trim_to_token_budget(msgs, budget=budget)
        contents = [m.content for m in result]
        assert "recent message" in contents
        assert "recent reply" in contents
        assert "old message" not in contents

    def test_system_messages_preserved_when_trimming(self):
        msgs = [
            SystemMessage(content="system prompt"),
            HumanMessage(content="old message"),
            HumanMessage(content="recent message"),
        ]
        budget = count_message_tokens([msgs[0], msgs[2]]) + 5
        result = trim_to_token_budget(msgs, budget=budget)
        assert any(isinstance(m, SystemMessage) for m in result)
        assert any(m.content == "recent message" for m in result)
        assert not any(m.content == "old message" for m in result)

    def test_result_is_under_budget(self):
        msgs = [HumanMessage(content="x" * 500) for _ in range(10)]
        result = trim_to_token_budget(msgs, budget=50)
        total = count_message_tokens(result)
        assert total <= 50 or result == []  # may be empty if even one msg exceeds budget

    def test_already_under_budget_unchanged(self):
        msgs = [
            SystemMessage(content="sys"),
            HumanMessage(content="hi"),
            AIMessage(content="hello"),
        ]
        budget = count_message_tokens(msgs) + 100
        result = trim_to_token_budget(msgs, budget=budget)
        assert len(result) == 3
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /Users/kien.ha/Code/medical_agent
pytest tests/unit/test_token_budget.py -v 2>&1 | head -30
```

Expected: `ModuleNotFoundError: No module named 'src.utils.token_budget'`

- [ ] **Step 3: Implement `src/utils/token_budget.py`**

```python
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

    return system_msgs + other_msgs
```

- [ ] **Step 4: Run tests — all must pass**

```bash
pytest tests/unit/test_token_budget.py -v
```

Expected: `6 passed`

- [ ] **Step 5: Commit**

```bash
git add src/utils/token_budget.py tests/unit/test_token_budget.py
git commit -m "feat: add trim_to_token_budget utility for LangChain messages"
```

---

## Task 2: Trim & Stabilize System Prompt

**Files:**
- Modify: `src/prompt/system.py`

The current prompt is 209 lines (~1,500 tokens). We replace it with a ~40-line version (~380 tokens) that keeps all behavioral rules but removes inline examples, multi-line planning examples, and the hardcoded fallback imaging JSON block.

We also add a `build_specialist_list_message()` helper that produces the separate dynamic `SystemMessage` for the specialist list (currently `build_decision_context()` is defined but never called anywhere).

- [ ] **Step 1: Replace `src/prompt/system.py`**

```python
"""System prompt for the unified LangGraph agent.

STATIC_SYSTEM_PROMPT is a module-level constant so it is byte-identical
across all requests, enabling provider-side prompt prefix caching.

Dynamic content (specialist list, memory context) is injected as separate
SystemMessage entries appended after this constant in langgraph_agent.py.
"""

from typing import Dict, Any


STATIC_SYSTEM_PROMPT = """You are an intelligent AI assistant supporting healthcare providers with both general queries and specialized medical information retrieval.

**Audience:** Healthcare providers (doctors, nurses, clinicians).

**Role:**
- Non-medical queries: Answer directly using your knowledge.
- Medical/health queries: Coordinate specialist sub-agents to retrieve and analyze patient information.

**Tools:**
- delegate_to_specialist — delegate to a medical specialist
- get_agent_architecture — query available specialists and capabilities
- get_current_datetime, get_current_weather, get_location — utility tools
- search_skills_semantic, search_tools, list_available_tools, get_tool_info — skill/tool discovery

**Medical Workflow:**
1. Discover: `search_skills_semantic("your query")` to find relevant skills/tools first
2. Direct use: If a skill/tool handles the request, use it directly (faster, no specialist overhead)
3. Delegate: Use `delegate_to_specialist` only for complex analysis requiring medical expertise
4. Never output "CONSULT: ..." — always invoke the tool directly
5. Always pass ALL relevant context (IDs, URLs, values) in delegation queries — specialists don't see conversation history

**Multi-Specialist Planning:**
- Determine if tasks are independent (parallel) or have dependencies (sequential)
- Sequential: when specialist B needs specialist A's output first
- Parallel: when tasks are independent of each other
- Synthesize all specialist reports into one cohesive final response; don't expose internal tooling

**Response Format:**
- Medical queries: third-person perspective ("Patient X presents with..."), professional clinical terminology, address the healthcare provider not the patient
- Images/Links: always use markdown — `![desc](url)` or `[text](url)` — never say "cannot directly display"
- Don't expose internal tool calls, raw JSON, or planning steps in your final answer

Always provide helpful, accurate responses, whether general or medical."""


def get_default_system_prompt() -> str:
    """Return the default static system prompt."""
    return STATIC_SYSTEM_PROMPT


def build_specialist_list_message(sub_agents: Dict[str, Dict[str, Any]]) -> str:
    """Build a specialist list block for injection as a separate SystemMessage.

    Kept separate from STATIC_SYSTEM_PROMPT so the static prefix is
    byte-identical across requests (enabling provider-side caching) while
    the specialist list can vary as agents are added/removed.

    Args:
        sub_agents: Dict mapping role → agent info dict (name, description).

    Returns:
        Formatted string listing available specialists, or a brief note if none.
    """
    if not sub_agents:
        return "No specialist sub-agents are currently available."

    lines = ["Available specialist sub-agents:"]
    for role, info in sub_agents.items():
        lines.append(f"- {info['name']} (role: {role}): {info.get('description', '')}")
    return "\n".join(lines)
```

- [ ] **Step 2: Verify the old `build_decision_context` import is unused**

```bash
grep -r "build_decision_context" /Users/kien.ha/Code/medical_agent/src/
```

Expected: only the definition in `templates.py` (no callers). Nothing in `system.py` to update.

- [ ] **Step 3: Run existing tests to confirm nothing broke**

```bash
pytest tests/unit/ -v -k "not test_token_budget" 2>&1 | tail -20
```

Expected: same pass/fail count as before this change.

- [ ] **Step 4: Commit**

```bash
git add src/prompt/system.py
git commit -m "feat: trim system prompt from ~1500 to ~380 tokens, add build_specialist_list_message"
```

---

## Task 3: Remove Duplicate System Prompt in GraphBuilder

**Files:**
- Modify: `src/agent/graph_builder.py:147`

The `main_agent_node` inside `GraphBuilder.build()` prepends `SystemMessage(content=self.system_prompt)` before `messages` on every LLM call. But `messages` is `state["messages"]`, which already contains the `SystemMessage` at index 0 (added by `langgraph_agent.py:253` in `initial_state`). LangGraph's `add_messages` reducer accumulates all messages across node calls, so the system prompt at position 0 persists through every graph iteration.

- [ ] **Step 1: Apply the one-line fix**

In `src/agent/graph_builder.py`, find the `main_agent_node` function (~line 138). Change:

```python
# BEFORE (line ~146-148):
response = await agent_llm.ainvoke(
    [SystemMessage(content=self.system_prompt)] + messages
)
```

```python
# AFTER:
response = await agent_llm.ainvoke(messages)
```

- [ ] **Step 2: Remove the now-unused `SystemMessage` import from `graph_builder.py`**

After the removal in Step 1, `SystemMessage` is no longer referenced anywhere in `graph_builder.py`. Remove it from the import line. Verify first:

```bash
grep -n "SystemMessage" /Users/kien.ha/Code/medical_agent/src/agent/graph_builder.py
```

Expected: only the import line (no other usages). Then remove `SystemMessage` from that import.

- [ ] **Step 3: Run existing tests**

```bash
pytest tests/ -v 2>&1 | tail -20
```

Expected: same pass/fail as before.

- [ ] **Step 4: Commit**

```bash
git add src/agent/graph_builder.py
git commit -m "fix: remove duplicate system prompt prepend in main_agent_node"
```

---

## Task 4: Update Message Assembly in LangGraphAgent

**Files:**
- Modify: `src/agent/langgraph_agent.py:248-273`

Three changes in one block of `process_message()`:
1. Add specialist list as a separate `SystemMessage` (after static system prompt)
2. Deduplicate + cap memory context at 500 tokens
3. Trim `chat_history` to 2,000-token budget before appending

- [ ] **Step 1: Add the new import at the top of `langgraph_agent.py`**

Find the existing imports block (~line 10-24). Add:

```python
from ..utils.token_budget import trim_to_token_budget, count_message_tokens, count_text_tokens
from ..prompt.system import build_specialist_list_message
```

- [ ] **Step 2: Replace the message assembly block (lines ~248-273)**

Find this block in `process_message()`:

```python
        # Build initial state with messages
        messages = []

        # Add system prompt
        if self.system_prompt:
            messages.append(SystemMessage(content=self.system_prompt))

        # Add memory context if available
        if memories:
            memory_context = "\n".join([f"- {m}" for m in memories])
            messages.append(
                SystemMessage(
                    content=f"Relevant information from past:\n{memory_context}"
                )
            )

        # Add chat history if provided
        if chat_history:
            for msg in chat_history:
                if msg["role"] == "user":
                    messages.append(HumanMessage(content=msg["content"]))
                elif msg["role"] == "assistant":
                    messages.append(AIMessage(content=msg["content"]))

        # Add user message
        messages.append(HumanMessage(content=user_message))
```

Replace with:

```python
        # Build initial state with messages
        # Order: static system prompt → specialist list → memory → history → user message
        # Static prefix is byte-identical across requests → provider caches it.
        messages = []

        # 1. Static system prompt (never changes — provider caches this prefix)
        if self.system_prompt:
            messages.append(SystemMessage(content=self.system_prompt))

        # 2. Specialist list (separate message so static prefix stays cacheable)
        specialist_list_content = build_specialist_list_message(sub_agents)
        messages.append(SystemMessage(content=specialist_list_content))

        # 3. Memory context — deduplicated and capped at 500 tokens
        if memories:
            # Deduplicate: keep first occurrence of each unique memory (relevance-ordered)
            seen: set = set()
            unique_memories = []
            for m in memories:
                key = m.strip().lower()
                if key not in seen:
                    seen.add(key)
                    unique_memories.append(m)

            # Cap at 500 tokens — drop lowest-relevance (end of list) first
            capped_memories = []
            token_total = 0
            for m in unique_memories:
                t = count_text_tokens(m)
                if token_total + t <= 500:
                    capped_memories.append(m)
                    token_total += t
                else:
                    break

            if capped_memories:
                memory_context = "\n".join([f"- {m}" for m in capped_memories])
                messages.append(
                    SystemMessage(content=f"Relevant information from past:\n{memory_context}")
                )

        # 4. Chat history — trimmed to 2,000-token budget
        if chat_history:
            history_messages = []
            for msg in chat_history:
                if msg["role"] == "user":
                    history_messages.append(HumanMessage(content=msg["content"]))
                elif msg["role"] == "assistant":
                    history_messages.append(AIMessage(content=msg["content"]))
            history_messages = trim_to_token_budget(history_messages, budget=2000)
            messages.extend(history_messages)

        # 5. Current user message
        messages.append(HumanMessage(content=user_message))
```

- [ ] **Step 3: Run existing tests**

```bash
pytest tests/ -v 2>&1 | tail -20
```

Expected: same pass/fail as before.

- [ ] **Step 4: Commit**

```bash
git add src/agent/langgraph_agent.py
git commit -m "feat: add specialist list message, memory dedup+cap, history token budget"
```

---

## Task 5: Specialist Prompt Length Warning

**Files:**
- Modify: `src/agent/specialist_handler.py:229`

When a specialist's `system_prompt` (loaded from DB) exceeds 300 tokens, log a warning so operators know to shorten it. This enables provider-side caching of the specialist prompt prefix. No truncation — the content is semantically meaningful.

- [ ] **Step 1: Add import at the top of `specialist_handler.py`**

Find the existing imports block (~line 1-29). Add:

```python
from ..utils.token_budget import count_text_tokens
```

- [ ] **Step 2: Add the warning after the specialist prompt is created**

Find line ~229:

```python
                specialist_prompt = SystemMessage(content=agent_info["system_prompt"])
```

Add immediately after:

```python
                # Warn if specialist prompt is too long for provider caching
                _prompt_tokens = count_text_tokens(agent_info["system_prompt"])
                if _prompt_tokens > 300:
                    logger.warning(
                        "Specialist '%s' system_prompt is %d tokens (recommended max: 300). "
                        "Shorten it in the agent config to enable provider-side prompt caching.",
                        specialist_role,
                        _prompt_tokens,
                    )
```

- [ ] **Step 3: Run existing tests**

```bash
pytest tests/ -v 2>&1 | tail -20
```

Expected: same pass/fail as before.

- [ ] **Step 4: Commit**

```bash
git add src/agent/specialist_handler.py
git commit -m "feat: warn when specialist system_prompt exceeds 300-token caching threshold"
```

---

## Final Verification

- [ ] **Run the full test suite**

```bash
pytest tests/ -v 2>&1 | tail -30
```

Expected: all previously passing tests still pass.

- [ ] **Spot-check token count of new system prompt**

```bash
python3 -c "
from src.prompt.system import STATIC_SYSTEM_PROMPT
from src.utils.token_budget import count_text_tokens
print('Static system prompt tokens:', count_text_tokens(STATIC_SYSTEM_PROMPT))
"
```

Expected: output < 500.

- [ ] **Confirm no duplicate system prompt in graph**

```bash
grep -n "SystemMessage(content=self.system_prompt)" /Users/kien.ha/Code/medical_agent/src/agent/graph_builder.py
```

Expected: no output (line removed in Task 3).
