# Per-Patient Chat Sessions with Reset — Doctor Page

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single global chat session in the doctor workspace with per-patient sessions stored in localStorage, and add a reset button to clear a patient's conversation.

**Architecture:** All logic lives in `use-doctor-workspace.ts`. A map of `patient_id → session_id` replaces the old single-key storage. `selectVisit` restores a patient's previous session on load; discharge and transfer clear it. `AiChatMode` gets a small reset button. No backend changes.

**Tech Stack:** React (hooks, useCallback), TypeScript, localStorage, Tailwind CSS, lucide-react

---

## File Map

| File | Change |
|---|---|
| `web/app/(dashboard)/doctor/use-doctor-workspace.ts` | Replace storage helpers; update selectVisit, handleChatSubmit, draftSoapNote, handleDischarge, handleTransfer; add handleResetChat; remove on-mount effect |
| `web/components/doctor/ai-chat-mode.tsx` | Add `onResetChat` prop + RotateCcw reset button |
| `web/components/doctor/doctor-ai-panel.tsx` | Add `onResetChat` to props + pass to AiChatMode |
| `web/app/(dashboard)/doctor/page.tsx` | Destructure `handleResetChat` from workspace; pass to DoctorAiPanel |

---

## Task 1: Replace localStorage helpers

**Files:**
- Modify: `web/app/(dashboard)/doctor/use-doctor-workspace.ts:29-42`

- [ ] **Replace the old constants and helpers**

In `use-doctor-workspace.ts`, replace lines 29–42 (the `DOCTOR_SESSION_KEY`, `saveSession`, and `loadSession` block) with:

```ts
const DOCTOR_SESSIONS_KEY = "medinexus_doctor_sessions";

function savePatientSession(patientId: number, sessionId: number): void {
  try {
    const raw = localStorage.getItem(DOCTOR_SESSIONS_KEY);
    const map: Record<string, number> = raw ? JSON.parse(raw) : {};
    map[String(patientId)] = sessionId;
    localStorage.setItem(DOCTOR_SESSIONS_KEY, JSON.stringify(map));
  } catch {
    // ignore storage errors
  }
}

function loadPatientSession(patientId: number): number | null {
  try {
    const raw = localStorage.getItem(DOCTOR_SESSIONS_KEY);
    if (!raw) return null;
    const map: Record<string, number> = JSON.parse(raw);
    return map[String(patientId)] ?? null;
  } catch {
    return null;
  }
}

function clearPatientSession(patientId: number): void {
  try {
    const raw = localStorage.getItem(DOCTOR_SESSIONS_KEY);
    if (!raw) return;
    const map: Record<string, number> = JSON.parse(raw);
    delete map[String(patientId)];
    localStorage.setItem(DOCTOR_SESSIONS_KEY, JSON.stringify(map));
  } catch {
    // ignore storage errors
  }
}
```

- [ ] **Commit**

```bash
git add web/app/\(dashboard\)/doctor/use-doctor-workspace.ts
git commit -m "refactor(doctor): replace global session storage with per-patient map"
```

---

## Task 2: Update session save/clear call sites

**Files:**
- Modify: `web/app/(dashboard)/doctor/use-doctor-workspace.ts`

Replace every call to the old helpers and add session clearing on discharge/transfer.

- [ ] **Update `handleChatSubmit` — replace `saveSession`**

Find this line in `handleChatSubmit` (~line 391):
```ts
saveSession(response.session_id);
```
Replace with:
```ts
if (selectedPatient) {
  savePatientSession(selectedPatient.id, response.session_id);
}
```

- [ ] **Update `draftSoapNote` — replace `saveSession`**

Find the same line in `draftSoapNote` (~line 467):
```ts
saveSession(response.session_id);
```
Replace with:
```ts
if (selectedPatient) {
  savePatientSession(selectedPatient.id, response.session_id);
}
```

- [ ] **Update `handleDischarge` — clear session on success**

Replace the entire `handleDischarge` callback:
```ts
const handleDischarge = useCallback(async () => {
  if (!selectedVisit) return;
  try {
    await completeVisit(selectedVisit.id);
    clearPatientSession(selectedVisit.patient_id);
    toast.success("Patient discharged");
    setSelectedVisit(null);
    setSelectedPatient(null);
    setActiveTab("queue");
    fetchQueue();
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "Failed to discharge");
  }
}, [selectedVisit, fetchQueue]);
```

- [ ] **Update `handleTransfer` — clear session on success**

Replace the entire `handleTransfer` callback:
```ts
const handleTransfer = useCallback(
  async (targetDepartment: string) => {
    if (!selectedVisit) return;
    try {
      await transferVisit(selectedVisit.id, targetDepartment);
      clearPatientSession(selectedVisit.patient_id);
      toast.success(`Patient transferred to ${targetDepartment}`);
      setSelectedVisit(null);
      setSelectedPatient(null);
      setActiveTab("queue");
      fetchQueue();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to transfer");
    }
  },
  [selectedVisit, fetchQueue]
);
```

- [ ] **Commit**

```bash
git add web/app/\(dashboard\)/doctor/use-doctor-workspace.ts
git commit -m "feat(doctor): save/clear chat session per patient on send, discharge, transfer"
```

---

## Task 3: Restore session on patient select + add reset + remove on-mount effect

**Files:**
- Modify: `web/app/(dashboard)/doctor/use-doctor-workspace.ts`

- [ ] **Remove the on-mount session restore `useEffect`**

Delete the entire block starting at ~line 152 through ~line 192:
```ts
// Restore session from localStorage and load chat history
useEffect(() => {
  const stored = loadSession();
  if (!stored) return;
  // ... (the entire useEffect body)
}, []);
```

- [ ] **Update `selectVisit` to restore the patient's previous session**

Replace the entire `selectVisit` `useCallback` with:
```ts
const selectVisit = useCallback(async (visit: VisitListItem) => {
  setSelectedVisit(visit);
  setActiveTab("patient");
  setPatientLoading(true);
  // Reset chat state before loading new patient
  setChatMessages([]);
  setChatSessionId(null);
  chatSessionIdRef.current = null;
  setVisitBrief("");
  setDdxDiagnoses([]);
  setDdxLoading(false);

  try {
    const patient = await getPatient(visit.patient_id);
    setSelectedPatient(patient);
    setClinicalNotes((visit as any).clinical_notes || "");
    setNotesSaved(false);
  } catch {
    toast.error("Failed to load patient details");
  } finally {
    setPatientLoading(false);
  }

  // Restore this patient's previous session if available
  const storedSessionId = loadPatientSession(visit.patient_id);
  if (storedSessionId) {
    try {
      const messages = await getSessionMessages(storedSessionId);
      const uiMessages = messages
        .filter((m) => m.content && m.content.trim())
        .map(mapApiMessageToUi);
      if (uiMessages.length > 0) {
        setChatMessages(uiMessages);
        chatSessionIdRef.current = storedSessionId;
        setChatSessionId(storedSessionId);
      }
    } catch {
      // Session expired or deleted on server — start fresh
      clearPatientSession(visit.patient_id);
    }
  }

  // Fetch pre-visit brief asynchronously after patient load
  setBriefLoading(true);
  getVisitBrief(visit.id)
    .then((data) => setVisitBrief(data.brief))
    .catch(() => setVisitBrief(""))
    .finally(() => setBriefLoading(false));
}, []);
```

- [ ] **Add `handleResetChat` after `clearChatLoadingState` (~line 303)**

```ts
const handleResetChat = useCallback(() => {
  cancelStreamRef.current?.();
  cancelStreamRef.current = null;
  setChatMessages([]);
  setChatSessionId(null);
  chatSessionIdRef.current = null;
  setChatInput("");
  clearChatLoadingState();
  if (selectedPatient) {
    clearPatientSession(selectedPatient.id);
  }
}, [selectedPatient]);
```

- [ ] **Expose `handleResetChat` in the hook's return object**

In the `return { ... }` block at the bottom, add under the AI Chat section:
```ts
handleResetChat,
```

- [ ] **Commit**

```bash
git add web/app/\(dashboard\)/doctor/use-doctor-workspace.ts
git commit -m "feat(doctor): restore per-patient sessions on selectVisit, add handleResetChat"
```

---

## Task 4: Reset button UI + wire through component tree

**Files:**
- Modify: `web/components/doctor/ai-chat-mode.tsx`
- Modify: `web/components/doctor/doctor-ai-panel.tsx`
- Modify: `web/app/(dashboard)/doctor/page.tsx`

- [ ] **Add `onResetChat` prop and reset button to `AiChatMode`**

In `web/components/doctor/ai-chat-mode.tsx`:

1. Add `RotateCcw` to the lucide-react import:
```ts
import { Sparkles, Send, FileText, Stethoscope, Zap, Pill, RotateCcw } from "lucide-react";
```

2. Add `onResetChat` to `AiChatModeProps`:
```ts
interface AiChatModeProps {
  messages: Message[];
  input: string;
  setInput: (input: string) => void;
  isLoading: boolean;
  currentActivity?: AgentActivity | null;
  activityDetails?: string;
  handleSendMessage: (e: React.FormEvent) => void;
  messagesEndRef: RefObject<HTMLDivElement | null>;
  onResetChat?: () => void;
}
```

3. Destructure `onResetChat` in the function signature:
```ts
export function AiChatMode({
  messages,
  input,
  setInput,
  isLoading,
  currentActivity,
  activityDetails,
  handleSendMessage,
  messagesEndRef,
  onResetChat,
}: AiChatModeProps) {
```

4. Replace the hint/send row in the input bar (the `absolute bottom-0` div) with:
```tsx
<div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-3 pb-2.5">
  <div className="flex items-center gap-2">
    <span className="text-[10px] text-muted-foreground/30 font-mono select-none">
      ↵ send · ⇧↵ newline
    </span>
    {!isEmpty && onResetChat && (
      <button
        type="button"
        onClick={onResetChat}
        className="flex items-center gap-1 text-[10px] text-muted-foreground/35 hover:text-muted-foreground/70 transition-colors font-mono"
      >
        <RotateCcw className="w-2.5 h-2.5" />
        reset
      </button>
    )}
  </div>
  <button
    type="submit"
    disabled={isLoading || !input.trim()}
    className="w-7 h-7 rounded-lg flex items-center justify-center transition-all disabled:opacity-25 disabled:cursor-not-allowed"
    style={{
      background: input.trim() && !isLoading
        ? "hsl(var(--primary))"
        : "hsl(var(--muted))",
      boxShadow: input.trim() && !isLoading ? "0 2px 10px hsl(var(--primary)/0.3)" : "none",
    }}
  >
    <Send className="w-3.5 h-3.5 text-white" />
  </button>
</div>
```

- [ ] **Add `onResetChat` to `DoctorAiPanelProps` and pass it to `AiChatMode`**

In `web/components/doctor/doctor-ai-panel.tsx`:

1. Add to the interface:
```ts
interface DoctorAiPanelProps {
  // ... existing props ...
  onResetChat?: () => void;
}
```

2. Destructure in the function signature:
```ts
export function DoctorAiPanel({
  // ... existing params ...
  onResetChat,
}: DoctorAiPanelProps) {
```

3. Pass to `<AiChatMode>`:
```tsx
{activeMode === "chat" && (
  <AiChatMode
    messages={messages}
    input={input}
    setInput={setInput}
    isLoading={isLoading}
    currentActivity={currentActivity}
    activityDetails={activityDetails}
    handleSendMessage={handleSendMessage}
    messagesEndRef={messagesEndRef}
    onResetChat={onResetChat}
  />
)}
```

- [ ] **Pass `handleResetChat` from doctor page to `DoctorAiPanel`**

In `web/app/(dashboard)/doctor/page.tsx`, the `<DoctorAiPanel>` render (~line 105):
```tsx
<DoctorAiPanel
  messages={workspace.chatMessages}
  input={workspace.chatInput}
  setInput={workspace.setChatInput}
  isLoading={workspace.chatLoading}
  currentActivity={workspace.currentActivity}
  activityDetails={workspace.activityDetails}
  handleSendMessage={workspace.handleChatSubmit}
  messagesEndRef={workspace.messagesEndRef}
  wsEvents={wsEvents}
  patientName={workspace.selectedPatient?.name}
  width={workspace.aiWidth}
  setWidth={workspace.setAiWidth}
  isResizing={workspace.isResizing}
  setIsResizing={workspace.setIsResizing}
  onResetChat={workspace.handleResetChat}
/>
```

- [ ] **Commit**

```bash
git add web/components/doctor/ai-chat-mode.tsx web/components/doctor/doctor-ai-panel.tsx web/app/\(dashboard\)/doctor/page.tsx
git commit -m "feat(doctor): add reset chat button and wire onResetChat through panel"
```

---

## Manual Verification Checklist

After all tasks, verify in the browser:

- [ ] Select Patient A → start a conversation → switch to Patient B → switch back to Patient A → previous conversation is visible
- [ ] Select a patient → send a message → click "reset" → chat clears, empty state shown
- [ ] Select a patient with a previous session → click reset → switch away and back → chat is empty (session was cleared)
- [ ] Discharge a patient → reselect them from the queue (as a new visit) → chat starts empty
- [ ] Transfer a patient → chat starts empty for next patient
- [ ] Refresh the page — no crash, no ghost session restored from old `medinexus_doctor_session` key (old key may still exist in browser storage, it is simply ignored)
