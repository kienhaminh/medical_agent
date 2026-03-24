# Token Optimization Design

**Goal:** Reduce per-turn input token consumption by ~60% through prompt stabilization, duplicate removal, token budget enforcement, and specialist prompt caching — enabling provider-side prompt caching for additional cost reduction.

**Architecture:** Four targeted, independent changes to the message assembly pipeline. Static content is front-loaded and made byte-stable to maximize provider cache hits. Dynamic content (memory, history) is capped by a token budget enforced at assembly time. Specialist system prompts are stabilized as short, role-specific prefixes to allow provider-side caching across parallel calls.

**Tech Stack:** Python, LangGraph, `langchain_openai` (tiktoken pulled in transitively via langchain; verified by checking installed packages at runtime before use — fallback to `len(text) // 4` if unavailable).

---

## Change 1: Stabilize & Trim System Prompt

**Problem:** `src/prompt/system.py` produces a ~1,500-token prompt. `build_decision_context()` injects the specialist list inline into the static system prompt string, making the entire prompt unique whenever agents are added/removed — busting provider-side prompt caching.

**Fix:**
- Remove specialist list injection from the static system prompt string in `system.py`.
- In `langgraph_agent.py`, after appending the static `SystemMessage`, append a **second `SystemMessage`** with the specialist list. This message can vary without invalidating the static prefix cache.
- Remove hardcoded fallback imaging JSON example (~100 tokens, lines 151–207 of current `system.py`).
- Compress the skill-discovery workflow section: keep the rules, cut the prose examples (~600 tokens → ~200 tokens).

**Target:** Static system prompt ≤ 500 tokens, byte-identical across all requests.

**Message assembly order after this change:**
```python
messages = [
    SystemMessage(content=STATIC_SYSTEM_PROMPT),     # ≤500 tokens, never changes
    SystemMessage(content=specialist_list_block),     # ≤200 tokens, changes only when agents change
    SystemMessage(content=memory_context),            # ≤500 tokens (see memory dedup below)
    *chat_history,                                    # ≤2,000 tokens (see Change 3)
    HumanMessage(content=user_message),              # variable
]
```

**Files:**
- Modify: `src/prompt/system.py`
- Modify: `src/agent/langgraph_agent.py` (message assembly block, lines ~248–273)

---

## Change 2: Remove Duplicate System Prompt

**Problem:** The system prompt is added twice per turn:
1. `langgraph_agent.py:253` — added as first element of `messages` in the initial state
2. `graph_builder.py:147` — prepended again before every `agent_llm.ainvoke()` call inside `main_agent_node`

This wastes ~1,500 tokens on every LLM call and prevents provider caching of the static prefix (the second copy appears at different positions as history accumulates).

**Fix:** Remove the `[SystemMessage(content=self.system_prompt)] +` prepend in `graph_builder.py:147`.

**Why this is safe:** LangGraph's `add_messages` reducer accumulates messages into `state["messages"]` across all node invocations. The `SystemMessage` appended at position 0 in `initial_state` persists through every graph node call — it is never dropped by LangGraph between iterations. `main_agent_node` receives `state["messages"]` which already contains the system prompt at index 0. Removing the explicit prepend does not lose the system context.

**Files:**
- Modify: `src/agent/graph_builder.py` (line ~147, inside `main_agent_node`)

---

## Change 3: Enforce Token Budget on Chat History

**Problem:** `ContextManager.count_tokens()` tracks tokens but the `max_tokens` config (default: 100,000) is never enforced during LangGraph message assembly. The message-count limit (`keep_recent: 20`) is enforced but 20 messages can still consume 10k–40k tokens.

**Note:** `ContextManager` in `src/context/manager.py` operates on `src/llm/provider.Message` objects (a custom dataclass). The LangGraph pipeline in `langgraph_agent.py` uses LangChain `HumanMessage`/`AIMessage`/`SystemMessage` objects. These are incompatible types — `ContextManager` is not used in the LangGraph assembly path.

**Fix:** Add a standalone utility function `trim_to_token_budget(messages, budget)` in `src/utils/token_budget.py`:
- Accepts a list of LangChain `BaseMessage` objects.
- Never drops `SystemMessage` entries.
- Drops oldest `HumanMessage`/`AIMessage` pairs first (from the front of the list).
- Stops trimming once total token count ≤ budget.
- Token counting: attempt `import tiktoken; enc.encode(text)` for the model; fall back to `len(text) // 4` if tiktoken is unavailable or the model encoding is unknown.

Call this in `langgraph_agent.py` before building `initial_state`, applied to `chat_history` with `budget=2000`.

**Token budget allocation per turn:**
| Component | Budget |
|---|---|
| Static system prompt | ≤ 500 tokens |
| Specialist list (dynamic) | ≤ 200 tokens |
| Memory context | ≤ 500 tokens |
| Chat history | ≤ 2,000 tokens (enforced) |
| User message | variable — not capped |
| **Total (excluding user msg)** | **≤ 3,200 tokens** |

**Files:**
- Create: `src/utils/token_budget.py`
- Modify: `src/agent/langgraph_agent.py` (apply budget trim to `chat_history` before message assembly)

---

## Change 4: Stabilize Specialist System Prompts for Provider Caching

**Problem:** Each specialist call sends `[specialist_system_prompt, delegation_query]` to the LLM (the delegation path in `graph_builder.py:105-110` passes `messages=[HumanMessage(content=query)]`, so the context is already minimal). The remaining token cost is in the specialist's `system_prompt` field loaded from the DB (`specialist_handler.py:229`). These prompts can be arbitrarily long and are re-sent verbatim on every parallel specialist call — preventing provider caching.

**Fix:** Enforce a 300-token maximum on specialist system prompts at load time in `specialist_handler.py`. When calling `_consult_single_specialist`:
- Measure the specialist system prompt token count.
- If over 300 tokens, log a warning: `"Specialist '{role}' system_prompt is {n} tokens (limit: 300). Truncate it in the agent config for best caching."`
- Do not truncate silently — the prompt content is semantically meaningful and should be managed in the agent config, not auto-chopped.

This change creates operational awareness without risk of breaking specialist behavior.

**Files:**
- Modify: `src/agent/specialist_handler.py` (inside `_consult_single_specialist`, after line 229)

---

## Memory Deduplication

**Problem:** Mem0 returns memories ordered by relevance score (highest first). The same fact can appear multiple times with slightly different phrasing. All memories are concatenated without deduplication or token budget, potentially injecting 1k–2k tokens of redundant context.

**Fix:** In `langgraph_agent.py`, before building the memory `SystemMessage`:
1. Deduplicate: compare `m.strip().lower()` strings, skip exact duplicates.
2. Token-cap: compute total tokens; drop from the end of the list (lowest-relevance memories last) until under 500 tokens.

**Files:**
- Modify: `src/agent/langgraph_agent.py` (memory injection block, lines ~255–262)

---

## Error Handling

- `trim_to_token_budget()` must never drop `SystemMessage` or the current `HumanMessage` — only history pairs.
- If tiktoken is unavailable, `len(text) // 4` character estimate is the fallback — this is acceptable for budget enforcement (not billing).
- Specialist prompt length warning is advisory only — no truncation, no error thrown.
- Memory dedup: if memories list is empty, skip dedup/cap entirely — no error.
- No changes to streaming, tool execution, or LangGraph graph structure.

---

## Testing

**Unit tests** (`tests/utils/test_token_budget.py`):
- `trim_to_token_budget()` never drops `SystemMessage` entries.
- Oldest `HumanMessage`/`AIMessage` pairs are dropped first.
- Result is always under the specified budget.
- Empty list input returns empty list.
- List with only system messages is returned unchanged.

**Unit tests** (`tests/agent/test_langgraph_agent.py`):
- Memory dedup: identical memory strings → only one kept; distinct strings → all kept.
- Memory cap: inject 10 memories totalling >500 tokens → output ≤ 500 tokens, lowest-relevance dropped.

**Integration test** — use `langchain_core.callbacks.AsyncCallbackHandler` to intercept `on_llm_start` events in tests. The `serialized_messages` argument contains the full prompt sent to the LLM, enabling token counting without mocking the LLM response. Assert total input tokens < 3,500 for a standard single-turn request with 5 messages of history.

---

## Expected Token Reduction

| Change | Saving per main-agent turn |
|---|---|
| Remove duplicate system prompt | ~1,500 tokens |
| Trim & stabilize system prompt | ~1,000 tokens |
| Token budget on chat history | ~1,000–3,000 tokens (session-dependent) |
| Memory dedup + cap | ~200–1,000 tokens |
| **Total** | **~3,700–6,500 tokens saved** |

Specialist calls: already minimal (delegation query only). Provider-side caching of the stabilized static system prompt reduces effective cost by ~50% on cache hits (OpenAI: prompts ≥1,024 tokens with identical prefix; Kimi/Moonshot: similar).
