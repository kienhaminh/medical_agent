# Intake Session Persistence Design

**Date:** 2026-04-01  
**Scope:** Frontend only (`web/app/intake/`)  
**Status:** Approved

## Problem

The patient intake chat (`/intake`) stores `session_id` in React state only. A page refresh or tab close loses the session, forcing the patient to restart their conversation from scratch.

## Goal

When a patient returns to the intake page on the same day, restore the full previous conversation and continue in the same backend session. A new day or explicit "New chat" click starts fresh.

## Approach

Store `{ sessionId, date }` in `localStorage` when the backend assigns a session ID. On page load, if the stored date matches today, fetch the conversation history from the backend and restore it.

## localStorage Schema

**Key:** `intake_session`  
**Value:**
```json
{ "sessionId": 42, "date": "2026-04-01" }
```

- `sessionId`: integer, the backend `ChatSession.id`
- `date`: ISO date string (`YYYY-MM-DD`), used to detect day boundary

## Data Flow

### First Visit (no localStorage entry)

1. Patient opens `/intake` — no stored session, start fresh
2. Patient sends first message → SSE stream begins
3. Backend creates `ChatSession`, emits `{ "session_id": 42 }` event
4. Hook receives event → sets React state → writes `{ sessionId: 42, date: "2026-04-01" }` to localStorage

### Returning Visit (same day)

1. Patient opens `/intake` — hook reads `intake_session` from localStorage
2. Date matches today → set `sessionId` in state, fetch `GET /api/chat/sessions/42/messages`
3. Map response to `ChatMessage[]` (filter to `role === "user" | "assistant"`, skip `"system"`)
4. Set messages in state — conversation appears restored
5. Patient can continue chatting; subsequent messages use the stored `sessionId`

### New Day

1. Patient opens `/intake` — hook reads `intake_session`, date is yesterday
2. Date mismatch → `localStorage.removeItem("intake_session")`, start fresh

### New Chat Button

1. Patient clicks "New chat" → `handleNewChat()` called
2. Clear `localStorage.removeItem("intake_session")`
3. Reset all state: `messages`, `sessionId`, `triageStatus`, `activeForm`

## Files Changed

| File | Change |
|------|--------|
| `web/app/intake/use-intake-chat.ts` | Add localStorage read on mount, write on session_id event, clear on handleNewChat |

## Files Unchanged (already exist)

| File | Role |
|------|------|
| `web/app/api/chat/sessions/[sessionId]/messages/route.ts` | Proxy to `GET /api/chat/sessions/{sessionId}/messages` — no changes needed |

## Message Mapping

Backend `ChatMessageResponse` → frontend `ChatMessage`:

```ts
const messages = response
  .filter((m) => m.role === "user" || m.role === "assistant")
  .map((m) => ({
    id: String(m.id),
    role: m.role as "user" | "assistant",
    content: m.content,
  }));
```

## Session Expiry Rules

| Trigger | Action |
|---------|--------|
| Page load, date matches today | Restore session |
| Page load, date is past | Clear localStorage, start fresh |
| "New chat" clicked | Clear localStorage, start fresh |
| Triage completed | Session remains in localStorage until one of the above |

## Out of Scope

- Multi-session history (patient seeing past visits)
- Cross-device session sync
- Authentication-gated session recovery
