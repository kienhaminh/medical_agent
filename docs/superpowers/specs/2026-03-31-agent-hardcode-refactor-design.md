# Agent Hardcode Refactor Design

**Date:** 2026-03-31
**Status:** Approved

---

## 1. Architecture Overview

All agent definitions move from the database into Python source code. The `sub_agents` table and the `SubAgent` SQLAlchemy model are eliminated entirely. Chat routing resolves agent configuration from a static Python registry instead of a DB query. The admin UI for creating/editing agents is removed; existing read-only views (chat history, usage) remain.

**Motivation:** Agent configuration was not user-managed in practice — it was seeded at startup from hardcoded prompts. Removing the DB layer simplifies the startup sequence, removes a class of sync bugs, and makes agent definitions reviewable via code diff rather than opaque DB state.

---

## 2. Agent Registry

### 2.1 `src/agent/core_agents.py` additions

Add `RECEPTION_AGENT` alongside the existing five agents. The reception system prompt is migrated verbatim from `scripts/db/seed/seed_full_flow.py`.

```python
RECEPTION_AGENT = {
    "name": "Reception Triage",
    "role": "reception_triage",
    "description": (
        "Conducts patient intake interviews, collects chief complaints and symptoms, "
        "and generates triage assessments with department routing suggestions."
    ),
    "system_prompt": (
        "You are a hospital reception triage assistant. You conduct patient intake autonomously.\n\n"
        # ... (full prompt from seed_full_flow.py lines 731-782)
    ),
    "color": "#14b8a6",
    "icon": "ClipboardList",
    "is_template": True,
    "tools": ["ask_user", "create_visit", "complete_triage"],
}

CORE_AGENTS = [
    RECEPTION_AGENT,
    INTERNIST_AGENT,
    DOCTOR_AGENT,
    CARDIOLOGIST_AGENT,
    NEUROLOGIST_AGENT,
    PULMONOLOGIST_AGENT,
]
```

### 2.2 New file: `src/agent/agent_registry.py`

```python
from typing import Optional
from .core_agents import CORE_AGENTS

_REGISTRY: dict[str, dict] = {agent["role"]: agent for agent in CORE_AGENTS}

def get_agent_config(role: str) -> Optional[dict]:
    """Return agent config dict for the given role, or None if not found."""
    return _REGISTRY.get(role)

def list_agents() -> list[dict]:
    """Return all agent config dicts."""
    return list(_REGISTRY.values())
```

`get_agent_config` replaces the DB query in chat routing. `list_agents` replaces the `/api/agents` list endpoint for any read-only consumers.

---

## 3. DB Changes

### 3.1 Tables/columns to drop

| What | Where |
|------|-------|
| `sub_agents` table | Entire table |
| `agent_skills` association table | Entire table |
| `agent_id` column | `chat_sessions` |
| `assigned_agent_id` column | `tools` |

### 3.2 Model changes

- **Delete** `src/models/agent.py` — `SubAgent` model entirely removed.
- **Modify** `src/models/chat.py` — remove `agent_id` mapped column and its `ForeignKey("sub_agents.id")`.
- **Modify** `src/models/tool.py` — remove `assigned_agent_id` mapped column and its `ForeignKey("sub_agents.id")`.
- **Modify** `src/models/skill.py` — remove `agent_skills` association table and the `AgentSkill` / `agent_skills` references.

### 3.3 Migration

A new Alembic migration:
1. `DROP TABLE agent_skills`
2. `ALTER TABLE chat_sessions DROP COLUMN agent_id`
3. `ALTER TABLE tools DROP COLUMN assigned_agent_id`
4. `DROP TABLE sub_agents`

### 3.4 Seed script

Remove the `seed_reception_agent` function (and its call) from `scripts/db/seed/seed_full_flow.py`. The reception agent system prompt is now canonical in `core_agents.py`.

---

## 4. API Changes

### 4.1 Remove `/api/agents` router

- Delete `src/api/routers/agents.py` (CRUD: list, create, get, update, delete SubAgent).
- Remove `agents` router from `src/api/server.py` `include_router` calls.

### 4.2 Update chat routing in `src/api/routers/messages.py`

Replace the DB lookup:
```python
# BEFORE
agent_row = await db.get(SubAgent, session.agent_id)
system_prompt = agent_row.system_prompt
tools = [t.symbol for t in agent_row.tools]
```

With registry lookup:
```python
# AFTER
from src.agent.agent_registry import get_agent_config

config = get_agent_config(session.agent_role)  # agent_role stored on session
system_prompt = config["system_prompt"] if config else DEFAULT_SYSTEM_PROMPT
tools = config["tools"] if config else []
```

`chat_sessions` keeps an `agent_role: str` column (already present) — this becomes the single routing key. The `agent_id` FK column is dropped.

### 4.3 `AgentLoader` removal

- Delete or gut `src/agent/agent_loader.py` — any startup sync logic that inserts `SubAgent` rows is removed. If `AgentLoader` has non-agent responsibilities, extract them first.

---

## 5. Frontend Changes

### 5.1 Remove agent management UI

Delete these files entirely:
- `web/app/agent/settings/` — agent settings page
- `web/app/agent/tools/` — agent tools page
- `web/components/agent/agent-form-dialog.tsx`
- `web/components/agent/agent-create-panel.tsx`
- `web/components/agent/agents-tab.tsx`

### 5.2 Keep (read-only)

- `web/app/agent/page.tsx` — main agent view
- `web/app/agent/history/` — chat history
- `web/app/agent/usage/` — usage stats
- `web/components/agent/agent-card.tsx` — display-only card

Agent cards will be populated from the new `GET /api/agents` read-only endpoint (returns `list_agents()` data — no auth-gated writes).

### 5.3 Navigation cleanup

Remove any nav links or tabs that route to the deleted pages.

---

## 6. Error Handling

- `get_agent_config(role)` returns `None` for unknown roles. Chat routing falls back to a minimal default prompt rather than 500-ing.
- The migration is irreversible for the dropped columns; take a DB snapshot before running in production.

---

## 7. Testing

- Unit test `agent_registry.py`: `get_agent_config` returns correct config for known role; returns `None` for unknown role; `list_agents()` returns all 6 agents.
- Integration test: send a chat message with `agent_role="reception_triage"`, assert the system prompt injected matches `RECEPTION_AGENT["system_prompt"]`.
- Migration smoke test: after migration, assert `sub_agents` table does not exist and `chat_sessions.agent_id` column does not exist.

---

## 8. Files Summary

| Action | Path |
|--------|------|
| Add `RECEPTION_AGENT`, update `CORE_AGENTS` | `src/agent/core_agents.py` |
| Create | `src/agent/agent_registry.py` |
| Delete | `src/models/agent.py` |
| Modify (drop `agent_id`) | `src/models/chat.py` |
| Modify (drop `assigned_agent_id`) | `src/models/tool.py` |
| Modify (drop `agent_skills`) | `src/models/skill.py` |
| Create | `alembic/versions/XXXX_drop_sub_agents.py` |
| Delete router, remove from server | `src/api/routers/agents.py`, `src/api/server.py` |
| Delete or gut | `src/agent/agent_loader.py` |
| Update routing | `src/api/routers/messages.py` |
| Update to use `list_agents()` | `src/api/routers/agents_readonly.py` (new, replaces deleted router) |
| Delete | `web/app/agent/settings/` |
| Delete | `web/app/agent/tools/` |
| Delete | `web/components/agent/agent-form-dialog.tsx` |
| Delete | `web/components/agent/agent-create-panel.tsx` |
| Delete | `web/components/agent/agents-tab.tsx` |
| Remove seed function | `scripts/db/seed/seed_full_flow.py` |
