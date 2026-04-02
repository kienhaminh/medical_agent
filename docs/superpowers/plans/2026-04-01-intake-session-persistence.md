# Intake Session Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist the patient intake `session_id` in localStorage so the full conversation is restored on page reload, and cleared on "New chat" or the next calendar day.

**Architecture:** On the first SSE `session_id` event, write `{ sessionId, date }` to `localStorage`. On page mount, if a valid same-day entry exists, fetch `GET /api/chat/sessions/{sessionId}/messages` and restore messages into state. Clear localStorage on `handleNewChat` or date mismatch.

**Tech Stack:** React 19, TypeScript, Next.js 16 App Router. No new dependencies.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `web/app/intake/use-intake-chat.ts` | Modify | Add localStorage read on mount, write on session_id, clear on new chat |

The proxy route `web/app/api/chat/sessions/[sessionId]/messages/route.ts` already exists and needs no changes.

---

### Task 1: Add localStorage helper constants and restore logic on mount

**Files:**
- Modify: `web/app/intake/use-intake-chat.ts`

- [ ] **Step 1: Add the localStorage key constant and `StoredSession` type at the top of the file**

Open `web/app/intake/use-intake-chat.ts`. After the imports, add:

```ts
const INTAKE_SESSION_KEY = "intake_session";

interface StoredSession {
  sessionId: number;
  date: string; // "YYYY-MM-DD"
}

function getTodayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function readStoredSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(INTAKE_SESSION_KEY);
    if (!raw) return null;
    const parsed: StoredSession = JSON.parse(raw);
    if (parsed.date !== getTodayDate()) {
      localStorage.removeItem(INTAKE_SESSION_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeStoredSession(sessionId: number): void {
  const entry: StoredSession = { sessionId, date: getTodayDate() };
  localStorage.setItem(INTAKE_SESSION_KEY, JSON.stringify(entry));
}

function clearStoredSession(): void {
  localStorage.removeItem(INTAKE_SESSION_KEY);
}
```

- [ ] **Step 2: Add a restore `useEffect` that runs once on mount**

Inside `useIntakeChat`, after the existing scroll `useEffect`, add:

```ts
useEffect(() => {
  const stored = readStoredSession();
  if (!stored) return;

  setSessionId(stored.sessionId);

  fetch(`/api/chat/sessions/${stored.sessionId}/messages`)
    .then((res) => {
      if (!res.ok) {
        clearStoredSession();
        return;
      }
      return res.json();
    })
    .then((data) => {
      if (!Array.isArray(data)) return;
      const restored: ChatMessage[] = data
        .filter(
          (m: { role: string }) =>
            m.role === "user" || m.role === "assistant"
        )
        .map((m: { id: number; role: string; content: string }) => ({
          id: String(m.id),
          role: m.role as "user" | "assistant",
          content: m.content,
        }));
      if (restored.length > 0) {
        setMessages(restored);
      }
    })
    .catch(() => {
      // Backend unavailable — silently start fresh, keep sessionId for retry
    });
}, []); // eslint-disable-line react-hooks/exhaustive-deps
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd web && npx tsc --noEmit
```

Expected: no errors related to `use-intake-chat.ts`.

---

### Task 2: Write session_id to localStorage when received from SSE

**Files:**
- Modify: `web/app/intake/use-intake-chat.ts`

- [ ] **Step 1: Update the `session_id` SSE handler to persist to localStorage**

Find this block in `sendMessage` (around line 92):

```ts
if (parsed.session_id && !sessionId) {
  setSessionId(parsed.session_id);
}
```

Replace it with:

```ts
if (parsed.session_id && !sessionId) {
  setSessionId(parsed.session_id);
  writeStoredSession(parsed.session_id);
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd web && npx tsc --noEmit
```

Expected: no errors.

---

### Task 3: Clear localStorage on "New chat"

**Files:**
- Modify: `web/app/intake/use-intake-chat.ts`

- [ ] **Step 1: Update `handleNewChat` to clear localStorage**

Find this function:

```ts
const handleNewChat = () => {
  setMessages([]);
  setInput("");
  setSessionId(null);
  setTriageStatus(null);
  setActiveForm(null);
};
```

Replace it with:

```ts
const handleNewChat = () => {
  clearStoredSession();
  setMessages([]);
  setInput("");
  setSessionId(null);
  setTriageStatus(null);
  setActiveForm(null);
};
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd web && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd web && git add app/intake/use-intake-chat.ts
git commit -m "feat: persist intake session_id in localStorage for same-day conversation restore"
```

---

### Task 4: Manual verification

- [ ] **Step 1: Start the dev server**

```bash
cd web && npm run dev
```

- [ ] **Step 2: Verify new session is saved**

1. Open `http://localhost:3000/intake`
2. Open DevTools → Application → Local Storage → `http://localhost:3000`
3. Send a message to the intake agent
4. After the first assistant reply, confirm `intake_session` key appears with `{ sessionId: <number>, date: "<today>" }`

- [ ] **Step 3: Verify conversation restores on reload**

1. Reload the page (`Cmd+R`)
2. The previous conversation messages should appear immediately
3. Send another message — it should continue in the same session (same `sessionId` sent in request body)

- [ ] **Step 4: Verify "New chat" clears localStorage**

1. Click the "New chat" button
2. Check DevTools → Local Storage: `intake_session` key should be gone
3. Send a new message — a new `intake_session` entry should appear with a new `sessionId`

- [ ] **Step 5: Verify day expiry (manual simulation)**

1. Open DevTools → Console and run:
   ```js
   const s = JSON.parse(localStorage.getItem("intake_session"));
   s.date = "2000-01-01";
   localStorage.setItem("intake_session", JSON.stringify(s));
   ```
2. Reload the page
3. The old conversation should NOT appear (stale date cleared), starting fresh
4. `intake_session` key in Local Storage should be gone or replaced after a new message
