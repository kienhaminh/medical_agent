# Token Optimization Design

**Goal:** Reduce per-turn input token consumption by ~60–70% through prompt stabilization, duplicate removal, token budget enforcement, and specialist context pruning — enabling provider-side prompt caching for additional cost reduction.

**Architecture:** Four targeted, independent changes to the message assembly pipeline. Static content is front-loaded and made byte-stable to maximize provider cache hits. Dynamic content (memory, history) is capped by token budget. Specialist calls receive only the delegation query plus minimal context instead of the full conversation history.

**Tech Stack:** Python, LangGraph, tiktoken (already a transitive dependency), existing `ContextManager.count_tokens()`.

---

## Change 1: Stabilize & Trim System Prompt

**Problem:** `system.py` produces a ~1,500-token prompt. `build_decision_context()` injects a dynamic specialist list inline, making the entire prompt unique per-request and busting provider-side caching.

**Fix:**
- Remove specialist list injection from the static system prompt.
- Move the specialist list to a **separate `SystemMessage`** appended after the static prompt in `langgraph_agent.py`. This message can vary without invalidating the static prefix cache.
- Remove hardcoded fallback imaging JSON example (~100 tokens).
- Compress the skill-discovery workflow section (~600 tokens → ~200 tokens): keep rules, remove prose examples.

**Target:** Static system prompt ≤ 500 tokens, byte-identical across all requests.

**Files:**
- Modify: `src/prompt/system.py`
- Modify: `src/agent/langgraph_agent.py`

---

## Change 2: Remove Duplicate System Prompt

**Problem:** The system prompt is added twice per turn:
1. `langgraph_agent.py:252` — added to `initial_state["messages"]`
2. `graph_builder.py:147` — prepended again before every `agent_llm.ainvoke()`

This wastes ~1,500–3,000 tokens per turn and prevents the static prefix from being cached (the second copy appears at a different position each turn as history grows).

**Fix:** Remove the `[SystemMessage(content=self.system_prompt)] +` prepend in `graph_builder.py`. The system message already lives in `state["messages"]` from `initial_state`.

**Files:**
- Modify: `src/agent/graph_builder.py` (line ~147)

---

## Change 3: Enforce Token Budget on History

**Problem:** `ContextManager` tracks tokens via `count_tokens()` but the `max_tokens` config value (default: 100,000) is never enforced. Message-count limits (`keep_recent: 20`) are enforced, but a 20-message history can still consume 10k–40k tokens.

**Fix:** Add `trim_to_token_budget(messages, budget)` to `ContextManager`:
- Never drop `SystemMessage` entries.
- Drop oldest `HumanMessage`/`AIMessage` pairs first.
- Stop trimming once total token count ≤ budget.
- Fall back to character-based estimate (`len(text) // 4`) if tiktoken is unavailable for the model.

Call this in `langgraph_agent.py` before each LLM invocation, with `budget=2000` for the history portion.

**Token budget allocation per turn:**
| Component | Budget |
|---|---|
| Static system prompt | ≤ 500 tokens |
| Specialist list (dynamic) | ≤ 200 tokens |
| Memory context | ≤ 500 tokens |
| Chat history | ≤ 2,000 tokens |
| User message | ~50–200 tokens |
| **Total** | **≤ 3,500 tokens** |

**Files:**
- Modify: `src/context/manager.py`
- Modify: `src/agent/langgraph_agent.py`

---

## Change 4: Prune Specialist Context

**Problem:** Each specialist in `specialist_handler.py` receives `input_messages` = the full conversation history. With 5 parallel specialists and 2+ LLM calls each, this multiplies history token cost by up to 10×.

**Fix:** Replace full history with a pruned context:
```
Specialist LLM Input = [
  SystemMessage(specialist_role_prompt)  # ≤ 200 tokens
  HumanMessage(delegation_query)         # ≤ 200 tokens
  ... last 2 turns of history ...        # ≤ 400 tokens
]
```
- Extract last 2 `HumanMessage`/`AIMessage` pairs from the full message list.
- If history is empty (first turn), send only the delegation query.
- Specialist role prompt: short, role-specific (e.g. "You are a radiology specialist..."), not the full main-agent system prompt.

**Files:**
- Modify: `src/agent/specialist_handler.py`

---

## Memory Deduplication (minor)

Before injecting Mem0 memories into the system message, strip exact duplicates by comparing `stripped().lower()` strings. Cap total memory block at 500 tokens; drop oldest memories first if over budget.

**Files:**
- Modify: `src/agent/langgraph_agent.py` (memory injection block, ~line 256)

---

## Error Handling

- `trim_to_token_budget()` must never drop `SystemMessage` or the current `HumanMessage` — only history.
- If `count_tokens()` raises, fall back to `len(text) // 4` character estimate.
- Specialist pruning: if history is empty, send delegation query only — no error.
- No changes to streaming, tool execution, or LangGraph graph structure.

---

## Testing

- **Unit:** `trim_to_token_budget()` — system messages never dropped; oldest pairs dropped first; result always under budget.
- **Unit:** specialist message pruning — assert ≤ delegation query + 2 history turns regardless of history length.
- **Unit:** memory dedup — identical strings removed, distinct strings kept.
- **Integration:** full conversation turn asserts `total_input_tokens < 3500` using the `usage` event emitted by existing LLM providers.

---

## Expected Token Reduction

| Change | Saving per turn |
|---|---|
| Remove duplicate system prompt | ~1,500 tokens |
| Trim system prompt | ~1,000 tokens |
| Token budget on history | ~1,000–3,000 tokens |
| Specialist context pruning | ~3,000–6,000 tokens (across all specialists) |
| **Total** | **~6,500–11,500 tokens saved** |

**Estimated result:** 3,000–3,500 input tokens per main-agent turn (down from 4,500–8,000+). Specialist calls: ~800 tokens each (down from 4,000–7,000). Provider-side prompt caching reduces effective cost of the static prefix by ~50% on cache hits.
