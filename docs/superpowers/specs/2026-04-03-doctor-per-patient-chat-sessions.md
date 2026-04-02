# Per-Patient Chat Sessions with Reset — Doctor Page

**Date:** 2026-04-03
**Scope:** `/app/(dashboard)/doctor/` and `components/doctor/` only. No backend changes.

---

## Problem

The doctor page stores one global chat session (`medinexus_doctor_session` in localStorage). When a doctor switches between patients, the previous patient's conversation is lost and cannot be recovered. There is also no way to reset the current conversation.

---

## Solution

Store a map of `patient_id → session_id` in localStorage. Each patient gets their own session that is restored when the doctor navigates back to them. Sessions are explicitly cleared on discharge or transfer. A reset button lets the doctor start a fresh conversation at any time.

---

## Storage Schema

**Key:** `medinexus_doctor_sessions`
**Value:** `{ [patient_id: string]: number }` — maps patient ID (as string) to session ID

```ts
// Example value in localStorage
{ "42": 123, "17": 89, "5": 304 }
```

**Helpers (module-level functions in `use-doctor-workspace.ts`):**
- `savePatientSession(patientId: number, sessionId: number): void`
- `loadPatientSession(patientId: number): number | null`
- `clearPatientSession(patientId: number): void`

The old `DOCTOR_SESSION_KEY` and `saveSession`/`loadSession` helpers are removed.

---

## Session Lifecycle

| Event | Behavior |
|---|---|
| `selectVisit(visit)` | Look up `loadPatientSession(visit.patient_id)`. If found: call `getSessionMessages()` to restore messages and set `chatSessionId`. If load fails (expired/deleted): call `clearPatientSession()`, start fresh. |
| First message sent | `savePatientSession(selectedPatient.id, response.session_id)` |
| Subsequent messages | Session already saved; no-op on save |
| `handleResetChat()` | Cancel stream → clear messages → reset session state → `clearPatientSession(selectedPatient.id)` |
| `handleDischarge()` | `clearPatientSession(selectedVisit.patient_id)` before resetting workspace state |
| `handleTransfer()` | Same as discharge |
| Page mount (on-mount `useEffect`) | Remove entirely — no patient context available on mount; sessions are restored via `selectVisit` |

---

## New Function: `handleResetChat`

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

Exposed in the hook's return object alongside the existing chat fields.

---

## Component Changes

### `use-doctor-workspace.ts`
- Replace `DOCTOR_SESSION_KEY`, `saveSession`, `loadSession` with the new per-patient helpers
- Update `selectVisit` to restore the patient's session after loading patient details
- Update `handleChatSubmit` and `draftSoapNote` to call `savePatientSession` instead of `saveSession`
- Add `clearPatientSession` call in `handleDischarge` and `handleTransfer` (use `selectedVisit.patient_id`)
- Add `handleResetChat` callback
- Remove the on-mount session restore `useEffect`
- Return `handleResetChat` from the hook

### `components/doctor/ai-chat-mode.tsx`
- Add `onResetChat?: () => void` prop to `AiChatModeProps`
- Add a `RotateCcw` icon button inside the input bar (bottom-left), visible only when `messages.length > 0`
- Button triggers `onResetChat()` immediately — no confirmation dialog

### `components/doctor/doctor-ai-panel.tsx`
- Add `onResetChat?: () => void` to `DoctorAiPanelProps`
- Pass to `<AiChatMode onResetChat={onResetChat} />`

### `app/(dashboard)/doctor/page.tsx`
- Destructure `handleResetChat` from `useDoctorWorkspace()`
- Pass as `onResetChat={handleResetChat}` to `<DoctorAiPanel />`

---

## Error Handling

- If `getSessionMessages()` throws (session expired, 404, network error): silently catch, call `clearPatientSession(patientId)`, and proceed with empty chat. No error toast — the doctor simply sees a fresh conversation.
- `clearPatientSession` is safe to call even if the key doesn't exist in the map.

---

## Out of Scope

- No backend changes (no `patient_id` column on `ChatSession`)
- No cross-device session sync
- No reconnect-to-pending-message logic on patient switch (removed for simplicity)
- No confirmation dialog on reset
