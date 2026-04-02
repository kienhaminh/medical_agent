# Flexible Agent-Defined Form System

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hardcoded form template system with a flexible model where the agent passes form field definitions (title, label, type, required, db_field) to `ask_user`. The frontend generates a Zod-validated form dynamically. The backend routes submitted values to the correct DB columns using the `db_field` mappings — PII never flows back to the agent.

**Architecture:**
1. Agent calls `ask_user(title, fields, message)`. Each field declares a `db_field` such as `"patient.dob"` or `"intake.phone"` — the agent never sees the values, only opaque IDs.
2. `ask_user` fires `{form_type: "fields", title, fields}` to the frontend SSE queue and returns `"form_shown"` immediately.
3. Frontend builds a Zod schema from the field list, renders the form, validates locally before submit.
4. On submit, frontend posts `{answers, field_mappings}` where `field_mappings` is `{field_name: db_field}`.
5. Backend routes by `db_field` prefix: `patient.*` → Patient table, `intake.*` → IntakeSubmission. Fields with no `db_field` are returned to the agent in the trigger message.
6. Backend creates a hidden `[FORM_RESULT]` trigger message and dispatches a Celery task for the next agent turn.
7. Frontend subscribes to `GET /api/chat/messages/{id}/stream` and streams the agent's next response.

**Tech Stack:** Zod, react-hook-form, @hookform/resolvers, shadcn/ui, FastAPI + Celery + Redis

---

## File Map

### New / rewritten frontend files
| File | Responsibility |
|------|---------------|
| `web/lib/dynamic-form.ts` | `buildZodSchema(fields)` — derives a Zod schema from field definitions |
| `web/components/reception/dynamic-form.tsx` | Single form component that renders any field list |
| `web/components/reception/form-input-bar.tsx` | Rewritten — dispatches `"fields"` type to `DynamicForm`, `"question"` type to inline choice UI |
| `web/app/api/chat/messages/[messageId]/stream/route.ts` | Next.js proxy for message stream SSE |

### Deleted frontend files
| File | Why |
|------|-----|
| `web/components/reception/form-fields.tsx` | Replaced by `dynamic-form.tsx` |

### Modified backend files
| File | What changes |
|------|-------------|
| `src/tools/builtin/ask_user_tool.py` | New signature: `ask_user(title, fields, message)` — fire-and-forget |
| `src/tools/form_request_registry.py` | Remove event/result/field_name tracking — keep session queues only |
| `src/api/models.py` | `FormResponseRequest` — add `field_mappings` and `agent_role` |
| `src/api/routers/chat/messages.py` | `submit_form_response` — generic `db_field` routing, trigger Celery |

### Deleted backend files
| File | Why |
|------|-----|
| `src/tools/builtin/ask_user_input_tool.py` | Replaced by updated `ask_user` |
| `src/forms/templates.py` | Agent defines fields dynamically now |
| `src/forms/vault.py` | Logic inlined into `messages.py` |
| `src/forms/field_classification.py` | Replaced by `db_field` mapping |

---

## Task 1: Install frontend dependencies

**Files:**
- Modify: `web/package.json`

- [ ] **Step 1: Install packages**

```bash
cd web && npm install zod react-hook-form @hookform/resolvers
```

Expected: `added N packages` with no errors.

- [ ] **Step 2: Verify**

```bash
grep -E '"zod"|"react-hook-form"|"@hookform' web/package.json
```

Expected: three lines with version numbers.

- [ ] **Step 3: Commit**

```bash
git add web/package.json web/package-lock.json
git commit -m "chore(web): add zod and react-hook-form"
```

---

## Task 2: Build dynamic Zod schema generator

**Files:**
- Create: `web/lib/dynamic-form.ts`

Zod requires schemas to be defined at compile time normally, but `z.object()` accepts a plain object of `ZodTypeAny` values — so we can build it at runtime from the field list.

- [ ] **Step 1: Create the file**

```typescript
// web/lib/dynamic-form.ts
import { z } from "zod";

export type FieldType = "text" | "email" | "date" | "select" | "textarea" | "number";

export interface FormFieldDef {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  /** DB column this field maps to, e.g. "patient.dob" or "intake.phone".
   *  Sent back with the submission so the backend knows where to save it.
   *  If absent, the value is returned to the agent as a safe field. */
  db_field?: string;
  options?: string[];     // for type === "select"
  placeholder?: string;
}

/**
 * Build a Zod schema at runtime from a list of form field definitions.
 * Required fields must be non-empty strings; optional fields may be empty.
 */
export function buildZodSchema(fields: FormFieldDef[]): z.ZodObject<Record<string, z.ZodTypeAny>> {
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const field of fields) {
    let validator: z.ZodTypeAny;

    if (field.type === "email") {
      validator = z.string().email("Invalid email address");
      if (field.required) {
        validator = (validator as z.ZodString).min(1, "Required");
      } else {
        validator = validator.optional().or(z.literal(""));
      }
    } else if (field.type === "select" && field.options && field.options.length > 0) {
      const opts = field.options as [string, ...string[]];
      validator = field.required
        ? z.enum(opts, { required_error: "Required" })
        : z.enum(opts).optional();
    } else {
      // text, date, textarea, number — all treated as strings in the form
      validator = field.required
        ? z.string().min(1, "Required")
        : z.string().optional().or(z.literal(""));
    }

    shape[field.name] = validator;
  }

  return z.object(shape);
}

/**
 * Extract the db_field mapping from a field list.
 * Returns { fieldName: dbField } for fields that have a db_field set.
 */
export function extractFieldMappings(fields: FormFieldDef[]): Record<string, string> {
  const mappings: Record<string, string> = {};
  for (const field of fields) {
    if (field.db_field) {
      mappings[field.name] = field.db_field;
    }
  }
  return mappings;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd web && npx tsc --noEmit 2>&1 | grep "dynamic-form"
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add web/lib/dynamic-form.ts
git commit -m "feat(web): add runtime Zod schema builder for dynamic forms"
```

---

## Task 3: Build DynamicForm component

**Files:**
- Create: `web/components/reception/dynamic-form.tsx`

This single component handles any form the agent defines. It auto-groups fields into a two-column grid (textareas span full width). It uses `react-hook-form` + the dynamically built Zod schema.

- [ ] **Step 1: Create the component**

```tsx
// web/components/reception/dynamic-form.tsx
"use client";

import { useMemo } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { buildZodSchema, type FormFieldDef } from "@/lib/dynamic-form";

interface DynamicFormProps {
  title?: string;
  message?: string;
  fields: FormFieldDef[];
  onSubmit: (answers: Record<string, string>) => Promise<void>;
  submitting: boolean;
}

export function DynamicForm({ title, message, fields, onSubmit, submitting }: DynamicFormProps) {
  const schema = useMemo(() => buildZodSchema(fields), [fields]);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<Record<string, string>>({
    resolver: zodResolver(schema),
    defaultValues: Object.fromEntries(fields.map((f) => [f.name, ""])),
  });

  const renderField = (field: FormFieldDef) => {
    const error = errors[field.name]?.message as string | undefined;

    const label = (
      <Label className="text-xs">
        {field.label}
        {field.required && <span className="text-red-400 ml-0.5">*</span>}
      </Label>
    );

    let input: React.ReactNode;

    if (field.type === "select" && field.options) {
      input = (
        <Controller
          name={field.name}
          control={control}
          render={({ field: ctrl }) => (
            <Select value={ctrl.value} onValueChange={ctrl.onChange}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder={field.placeholder ?? `Select ${field.label.toLowerCase()}`} />
              </SelectTrigger>
              <SelectContent>
                {field.options!.map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {opt.charAt(0).toUpperCase() + opt.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      );
    } else if (field.type === "textarea") {
      input = (
        <Textarea
          {...register(field.name)}
          placeholder={field.placeholder}
          rows={2}
          className="text-sm resize-none"
        />
      );
    } else {
      input = (
        <Input
          {...register(field.name)}
          type={field.type === "date" ? "date" : field.type === "number" ? "number" : field.type === "email" ? "email" : "text"}
          placeholder={field.placeholder}
          className="h-8 text-sm"
        />
      );
    }

    return (
      <div key={field.name} className={`space-y-1 ${field.type === "textarea" ? "col-span-2" : "col-span-1"}`}>
        {label}
        {input}
        {error && <p className="text-[10px] text-red-400">{error}</p>}
      </div>
    );
  };

  return (
    <form
      onSubmit={handleSubmit((data) => onSubmit(data as Record<string, string>))}
      className="space-y-3"
    >
      {title && <h3 className="text-sm font-semibold text-cyan-400">{title}</h3>}
      {message && <p className="text-xs text-muted-foreground">{message}</p>}

      <div className="grid grid-cols-2 gap-x-3 gap-y-2">
        {fields.map(renderField)}
      </div>

      <Button
        type="submit"
        disabled={submitting}
        size="sm"
        className="w-full bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600 text-white h-8 text-xs"
      >
        {submitting
          ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />Submitting...</>
          : "Submit"}
      </Button>
    </form>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd web && npx tsc --noEmit 2>&1 | grep "dynamic-form"
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add web/components/reception/dynamic-form.tsx
git commit -m "feat(web): add DynamicForm component with runtime Zod validation"
```

---

## Task 4: Rewrite FormInputBar with dynamic form dispatch

**Files:**
- Modify: `web/components/reception/form-input-bar.tsx`
- Delete: `web/components/reception/form-fields.tsx`

The `ActiveForm` type now has two variants:
- `form_type: "fields"` — rendered by `DynamicForm`
- `form_type: "question"` — rendered by inline choice buttons (unchanged)

- [ ] **Step 1: Check form-fields.tsx has no other consumers**

```bash
grep -r "form-fields" web/ --include="*.tsx" --include="*.ts"
```

Expected: only in `form-input-bar.tsx` itself. If other files import it, update them to use `DynamicForm` first.

- [ ] **Step 2: Rewrite form-input-bar.tsx**

```tsx
"use client";

import { useState } from "react";
import { Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DynamicForm } from "./dynamic-form";
import { extractFieldMappings, type FormFieldDef } from "@/lib/dynamic-form";

export interface ActiveForm {
  id: string;
  form_type: "fields" | "question";
  // Present when form_type === "fields"
  title?: string;
  message?: string;
  fields?: FormFieldDef[];
  // Present when form_type === "question"
  question?: string;
  choices?: string[];
  allow_multiple?: boolean;
}

interface FormInputBarProps {
  activeForm: ActiveForm;
  sessionId: number;
  onSubmitted: (answers?: Record<string, string>, messageId?: number) => void;
}

export function FormInputBar({ activeForm, sessionId, onSubmitted }: FormInputBarProps) {
  const [submitting, setSubmitting] = useState(false);
  const [selectedChoices, setSelectedChoices] = useState<Set<string>>(new Set());

  const submitForm = async (answers: Record<string, string>) => {
    setSubmitting(true);
    try {
      const field_mappings =
        activeForm.form_type === "fields" && activeForm.fields
          ? extractFieldMappings(activeForm.fields)
          : undefined;

      const resp = await fetch(`/api/chat/${sessionId}/form-response`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          form_id: activeForm.id,
          answers,
          field_mappings,
          agent_role: "reception_triage",
        }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      onSubmitted(answers, data.message_id);
    } catch (err) {
      console.error("Form submission failed:", err);
    } finally {
      setSubmitting(false);
    }
  };

  // Choice-based question
  if (activeForm.form_type === "question") {
    const choices = activeForm.choices ?? [];
    const allowMultiple = activeForm.allow_multiple ?? false;

    const handleChoiceClick = (choice: string) => {
      if (allowMultiple) {
        setSelectedChoices((prev) => {
          const next = new Set(prev);
          if (next.has(choice)) next.delete(choice);
          else next.add(choice);
          return next;
        });
      } else {
        submitForm({ choice });
      }
    };

    return (
      <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-4 space-y-3">
        {activeForm.question && (
          <p className="text-sm text-foreground/80">{activeForm.question}</p>
        )}
        <div className="flex flex-wrap gap-2">
          {choices.map((choice) => {
            const isSelected = selectedChoices.has(choice);
            return (
              <Button
                key={choice}
                onClick={() => handleChoiceClick(choice)}
                disabled={submitting}
                variant={isSelected ? "default" : "outline"}
                size="sm"
                className={cn(
                  "h-8 px-3 text-xs transition-all",
                  isSelected
                    ? "bg-gradient-to-r from-cyan-500 to-teal-500 text-white border-transparent"
                    : "border-border/50 hover:border-cyan-500/40"
                )}
              >
                {allowMultiple && isSelected && <Check className="w-3 h-3 mr-1" />}
                {submitting && !allowMultiple
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : choice}
              </Button>
            );
          })}
        </div>
        {allowMultiple && (
          <Button
            onClick={() => submitForm({ choices: Array.from(selectedChoices).join(", ") })}
            disabled={submitting || selectedChoices.size === 0}
            size="sm"
            className="bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600 text-white h-8 text-xs"
          >
            {submitting
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />Submitting...</>
              : `Submit (${selectedChoices.size} selected)`}
          </Button>
        )}
      </div>
    );
  }

  // Dynamic field form
  return (
    <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-4">
      <DynamicForm
        title={activeForm.title}
        message={activeForm.message}
        fields={activeForm.fields ?? []}
        onSubmit={submitForm}
        submitting={submitting}
      />
    </div>
  );
}
```

- [ ] **Step 3: Delete form-fields.tsx**

```bash
git rm web/components/reception/form-fields.tsx
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd web && npx tsc --noEmit 2>&1 | head -30
```

Expected: zero errors.

- [ ] **Step 5: Commit**

```bash
git add web/components/reception/form-input-bar.tsx
git commit -m "feat(web): rewrite FormInputBar for dynamic agent-defined forms"
```

---

## Task 5: Add Next.js proxy for message stream SSE

**Files:**
- Create: `web/app/api/chat/messages/[messageId]/stream/route.ts`

- [ ] **Step 1: Create the proxy route**

```typescript
// web/app/api/chat/messages/[messageId]/stream/route.ts
import { NextRequest } from "next/server";

const pythonBackendUrl =
  process.env.PYTHON_BACKEND_URL || "http://localhost:8000";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ messageId: string }> }
) {
  const { messageId } = await params;
  const upstream = await fetch(
    `${pythonBackendUrl}/api/chat/messages/${messageId}/stream`,
    { headers: { Accept: "text/event-stream" } }
  );
  return new Response(upstream.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add web/app/api/chat/messages/
git commit -m "feat(web): add Next.js proxy for message stream SSE"
```

---

## Task 6: Update use-intake-chat — handle new form_request shape and stream after submit

**Files:**
- Modify: `web/app/intake/use-intake-chat.ts`

Two changes:
1. `form_request` SSE payload now has `form_type`, `fields`, `question` — update `setActiveForm()`
2. `handleFormSubmitted` subscribes to the new message stream via `message_id`

- [ ] **Step 1: Update use-intake-chat.ts**

Replace the `handleFormSubmitted` function and update the `form_request` SSE handler:

```typescript
// In sendMessage SSE loop — replace the form_request handling:
if (parsed.form_request) {
  setActiveForm(parsed.form_request as ActiveForm);
  setActivity(null);
  // Agent generates the prompt text naturally as SSE chunks — no need to extract from schema
}
```

Replace `handleFormSubmitted`:

```typescript
const handleFormSubmitted = (
  answers?: Record<string, string>,
  messageId?: number,
) => {
  // Build submission card (title from activeForm or generic label)
  if (activeForm) {
    const title =
      activeForm.form_type === "question"
        ? "Answer submitted"
        : activeForm.title ?? "Form submitted";
    const answer =
      activeForm.form_type === "question" && answers
        ? answers.choices ?? answers.choice
        : undefined;

    const submissionMsg: ChatMessage = {
      id: `form-${Date.now()}`,
      role: "user",
      content: "",
      formSubmission: {
        title,
        formType: activeForm.form_type === "question" ? "question" : "multi_field",
        sectionCount: 0,
        fieldCount: activeForm.fields?.length ?? 0,
        answer,
      },
    };
    setMessages((prev) => [...prev, submissionMsg]);
  }
  setActiveForm(null);

  if (messageId) {
    void streamMessageResponse(messageId);
  }
};

const streamMessageResponse = async (messageId: number) => {
  setIsLoading(true);
  const assistantId = `agent-${messageId}`;
  setMessages((prev) => [
    ...prev,
    { id: assistantId, role: "assistant", content: "" },
  ]);

  try {
    const response = await fetch(`/api/chat/messages/${messageId}/stream`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    if (!reader) throw new Error("No response body");

    let accumulated = "";
    outer: while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      for (const line of chunk.split("\n")) {
        if (!line.startsWith("data: ")) continue;
        try {
          const parsed = JSON.parse(line.slice(6));
          if (parsed.chunk) {
            if (activity) setActivity(null);
            accumulated += parsed.chunk;
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantId ? { ...msg, content: accumulated } : msg
              )
            );
          }
          if (parsed.tool_call) {
            const toolName: string = parsed.tool_call.tool ?? parsed.tool_call.name ?? "";
            setActivity(TOOL_LABELS[toolName] ?? `Running ${toolName.replace(/_/g, " ")}`);
          }
          if (parsed.tool_result) setActivity("Analyzing results");
          // Another form request may arrive within this agent turn
          if (parsed.form_request) {
            setActiveForm(parsed.form_request as ActiveForm);
            setActivity(null);
          }
          // Detect triage completion
          if (parsed.tool_result) {
            const resultText = parsed.tool_result.result ?? "";
            if (typeof resultText === "string" && resultText.includes("Triage completed")) {
              const deptMatch = resultText.match(/Auto-routed to:\s*([^(]+)/);
              const confMatch = resultText.match(/confidence:\s*([\d.]+)/);
              if (deptMatch) {
                setTriageStatus({
                  department: deptMatch[1].trim(),
                  confidence: confMatch ? parseFloat(confMatch[1]) : 0,
                });
              }
            }
          }
          if (parsed.type === "done" || parsed.done) break outer;
        } catch {
          // ignore malformed lines
        }
      }
    }
  } catch {
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === assistantId
          ? { ...msg, content: "Connection error. Please try again." }
          : msg
      )
    );
  } finally {
    setIsLoading(false);
    setActivity(null);
  }
};
```

Also update the session restore filter to hide `[FORM_RESULT]` trigger messages:

```typescript
const restored: ChatMessage[] = data
  .filter(
    (m: { role: string; content: string }) =>
      (m.role === "user" || m.role === "assistant") &&
      !m.content?.startsWith("[FORM_RESULT]")
  )
  .map((m: { id: number; role: string; content: string }) => ({
    id: String(m.id),
    role: m.role as "user" | "assistant",
    content: m.content,
  }));
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd web && npx tsc --noEmit 2>&1 | head -30
```

Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add web/app/intake/use-intake-chat.ts
git commit -m "feat(web): stream new agent turn after form submit via message_id"
```

---

## Task 7: Rewrite ask_user_tool — dynamic fields, fire-and-forget

**Files:**
- Modify: `src/tools/builtin/ask_user_tool.py`

The tool now takes `title` + `fields` (list of field defs) instead of a template name. It fires the form event and returns immediately.

- [ ] **Step 1: Rewrite the tool**

```python
"""ask_user — flexible agent-defined form tool.

The agent specifies the full form structure: title, message, and a list of
fields. Each field declares what DB column it maps to via db_field so the
backend can save PII privately without the agent ever seeing the values.

Fires immediately — does not wait for the patient to respond.
The backend triggers the next agent turn automatically after submission.

Registered at import time with scope="global".
"""
import logging
import uuid

from src.tools.form_request_registry import form_registry, current_session_id_var
from src.tools.registry import ToolRegistry

logger = logging.getLogger(__name__)


async def ask_user(
    title: str,
    fields: list[dict],
    message: str = "",
) -> str:
    """Show a custom form to the patient and return immediately.

    The patient fills the form at their own pace. The backend saves all
    PII privately (the agent never sees raw personal data) and automatically
    triggers the next agent turn once the patient submits.

    The agent does NOT need to call this tool again or wait for a response.

    Args:
        title: Form heading shown to the patient (e.g. "Patient Check-In").
        fields: List of field definitions. Each field is a dict with:
            - "name"        (str, required): snake_case key, e.g. "first_name"
            - "label"       (str, required): Human-readable label shown to patient
            - "type"        (str, required): "text" | "email" | "date" | "select" |
                                             "textarea" | "number"
            - "required"    (bool, default true): Whether the field must be filled
            - "db_field"    (str, optional): DB column to save to. Format:
                            "patient.<column>"  — saved to Patient table (PII)
                            "intake.<column>"   — saved to IntakeSubmission (PII)
                            Omit for safe/non-PII fields (value returned to agent)
            - "placeholder" (str, optional): Hint text inside the input
            - "options"     (list[str], optional): Choices for "select" type
        message: Optional helper text shown below the title.

    Returns:
        "form_shown"   — always immediate.
        "Error: ..."   — if fields list is empty or no active session.

    Example — patient identification:
        ask_user(
            title="Let's Get Started",
            message="We need a few details to look you up.",
            fields=[
                {"name": "first_name", "label": "First Name", "type": "text",
                 "db_field": "patient.first_name", "placeholder": "Jane"},
                {"name": "last_name",  "label": "Last Name",  "type": "text",
                 "db_field": "patient.last_name",  "placeholder": "Doe"},
                {"name": "dob",        "label": "Date of Birth", "type": "date",
                 "db_field": "patient.dob"},
                {"name": "gender",     "label": "Gender", "type": "select",
                 "db_field": "patient.gender",
                 "options": ["male", "female", "other"]},
            ]
        )

    Example — visit details (non-PII, returned to agent):
        ask_user(
            title="Today's Visit",
            fields=[
                {"name": "chief_complaint", "label": "Reason for Visit",
                 "type": "text", "db_field": "intake.chief_complaint"},
                {"name": "symptoms", "label": "Describe Your Symptoms",
                 "type": "textarea", "required": False,
                 "db_field": "intake.symptoms"},
            ]
        )
    """
    if not fields:
        return "Error: fields list cannot be empty"

    session_id = current_session_id_var.get()
    queue = form_registry.get_session_queue(session_id)
    if queue is None:
        logger.warning("ask_user called with no session queue (session_id=%s)", session_id)
        return "Error: no active patient session"

    form_id = str(uuid.uuid4())

    # Normalize fields — ensure required defaults to True if not specified.
    normalized_fields = [
        {
            "name": f["name"],
            "label": f["label"],
            "type": f.get("type", "text"),
            "required": f.get("required", True),
            **({} if "db_field" not in f else {"db_field": f["db_field"]}),
            **({} if "placeholder" not in f else {"placeholder": f["placeholder"]}),
            **({} if "options" not in f else {"options": f["options"]}),
        }
        for f in fields
    ]

    await queue.put({
        "type": "form_request",
        "payload": {
            "id": form_id,
            "form_type": "fields",
            "title": title,
            "message": message,
            "fields": normalized_fields,
        },
    })

    logger.info(
        "Form shown: form_id=%s title=%r fields=%d session_id=%s",
        form_id, title, len(fields), session_id,
    )
    return "form_shown"


_registry = ToolRegistry()
_registry.register(
    ask_user,
    scope="global",
    symbol="ask_user",
    allow_overwrite=True,
)
```

- [ ] **Step 2: Verify Python import**

```bash
python -c "from src.tools.builtin.ask_user_tool import ask_user; print('ok')"
```

Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add src/tools/builtin/ask_user_tool.py
git commit -m "refactor(backend): ask_user takes dynamic field definitions, fire-and-forget"
```

---

## Task 8: Simplify FormRequestRegistry

**Files:**
- Modify: `src/tools/form_request_registry.py`

Remove all Event-based tracking (`_form_events`, `_form_results`, `_form_templates`, `_form_field_names`). Keep only session queues.

- [ ] **Step 1: Rewrite form_request_registry.py**

```python
"""In-memory registry providing session queues for form_request SSE events.

ask_user enqueues form events into the session queue.
The SSE generate() function reads from it alongside agent events.

IMPORTANT — single-process only. Use Redis pub/sub before scaling.
"""
import asyncio
import contextvars
import logging
from typing import Optional

logger = logging.getLogger(__name__)

current_session_id_var: contextvars.ContextVar[Optional[int]] = contextvars.ContextVar(
    "current_session_id", default=None
)


class FormRequestRegistry:
    _instance: Optional["FormRequestRegistry"] = None
    _session_queues: dict[int, asyncio.Queue]

    def __new__(cls) -> "FormRequestRegistry":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._session_queues = {}
        return cls._instance

    def register_session_queue(self, session_id: int, queue: asyncio.Queue) -> None:
        self._session_queues[session_id] = queue

    def unregister_session_queue(self, session_id: int) -> None:
        self._session_queues.pop(session_id, None)

    def get_session_queue(self, session_id: Optional[int]) -> Optional[asyncio.Queue]:
        if session_id is None:
            return None
        return self._session_queues.get(session_id)

    def reset(self) -> None:
        """Clear all state. For tests only."""
        self._session_queues.clear()


form_registry = FormRequestRegistry()
```

- [ ] **Step 2: Verify Python import**

```bash
python -c "from src.tools.form_request_registry import form_registry; print('ok')"
```

Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add src/tools/form_request_registry.py
git commit -m "refactor(backend): simplify FormRequestRegistry to session queues only"
```

---

## Task 9: Update form response model and submit_form_response handler

**Files:**
- Modify: `src/api/models.py`
- Modify: `src/api/routers/chat/messages.py`

The handler now uses `field_mappings` (`{field_name: db_field}`) to route values. No more hardcoded template names.

- [ ] **Step 1: Update FormResponseRequest in models.py**

```python
class FormResponseRequest(BaseModel):
    """Body for POST /api/chat/{session_id}/form-response."""
    form_id: str
    answers: dict[str, str]
    field_mappings: dict[str, str] = {}  # {field_name: db_field}, e.g. {"dob": "patient.dob"}
    agent_role: str = "reception_triage"
```

- [ ] **Step 2: Rewrite submit_form_response in messages.py**

Remove the old template-based dispatch. Remove import of vault and field_classification. Add `_identify_patient` and `_save_intake` as private helpers. Add `process_agent_message` import.

Replace `submit_form_response` (and `_process_dynamic_input`) with:

```python
@router.post("/api/chat/{session_id}/form-response")
async def submit_form_response(session_id: int, body: FormResponseRequest):
    """Receive patient form submission.

    Uses field_mappings to route values to the correct DB tables privately.
    Creates a hidden [FORM_RESULT] trigger message and dispatches a new
    agent turn via Celery.

    Returns {"status": "ok", "message_id": N}
    """
    patient_fields: dict[str, str] = {}   # patient.<col> → value
    intake_fields: dict[str, str] = {}    # intake.<col> → value
    safe_fields: dict[str, str] = {}      # no db_field → returned to agent
    question_answer: str | None = None    # for form_type="question"

    # Route values by db_field prefix
    for field_name, value in body.answers.items():
        db_field = body.field_mappings.get(field_name)
        if db_field and db_field.startswith("patient."):
            patient_fields[db_field.split(".", 1)[1]] = value
        elif db_field and db_field.startswith("intake."):
            intake_fields[db_field.split(".", 1)[1]] = value
        else:
            # No db_field mapping — "choice" key from ask_user_question
            if field_name in ("choice", "choices"):
                question_answer = value
            else:
                safe_fields[field_name] = value

    trigger_parts: list[str] = []
    patient_id: int | None = None
    intake_id: str | None = None

    # Save to Patient if we have identity fields
    identity_fields = {"first_name", "last_name", "dob", "gender"}
    if identity_fields.issubset(patient_fields.keys()):
        try:
            patient_id, is_new = await _identify_patient(patient_fields)
            trigger_parts.append(f"patient_id={patient_id}")
            trigger_parts.append(f"is_new={'true' if is_new else 'false'}")
        except Exception as e:
            logger.error("identify_patient failed: %s", e, exc_info=True)
            raise HTTPException(status_code=500, detail="Failed to identify patient")

    # Save to IntakeSubmission if we have intake fields
    if intake_fields:
        try:
            all_fields = {**patient_fields, **intake_fields}
            pid = patient_id  # may be None for partial updates
            _, intake_id = await _save_intake(all_fields, patient_id=pid)
            trigger_parts.append(f"intake_id={intake_id}")
        except Exception as e:
            logger.error("save_intake failed: %s", e, exc_info=True)
            raise HTTPException(status_code=500, detail="Failed to save intake data")

    # Include safe (non-PII) field values in the trigger message
    for k, v in safe_fields.items():
        trigger_parts.append(f"{k}={v!r}")

    # Include question answer if present
    if question_answer is not None:
        trigger_parts.append(f"answer={question_answer!r}")

    trigger_content = (
        f"[FORM_RESULT] form submitted. {', '.join(trigger_parts)}"
        if trigger_parts
        else "[FORM_RESULT] form submitted."
    )

    async with AsyncSessionLocal() as db:
        trigger_msg = ChatMessage(
            session_id=session_id,
            role="user",
            content=trigger_content,
        )
        db.add(trigger_msg)
        await db.flush()

        assistant_msg = ChatMessage(
            session_id=session_id,
            role="assistant",
            content="",
            status="pending",
        )
        db.add(assistant_msg)
        await db.commit()
        await db.refresh(assistant_msg)
        message_id = assistant_msg.id

    process_agent_message.delay(
        session_id=session_id,
        message_id=message_id,
        user_id="intake",
        user_message=trigger_content,
        agent_role=body.agent_role,
    )

    return {"status": "ok", "message_id": message_id}


async def _identify_patient(fields: dict[str, str]) -> tuple[int, bool]:
    """Look up or create a patient by name + DOB. Returns (patient_id, is_new)."""
    from sqlalchemy import select as _select
    from src.models.patient import Patient

    full_name = f"{fields.get('first_name', '').strip()} {fields.get('last_name', '').strip()}".strip()
    dob = fields.get("dob", "").strip()
    gender = fields.get("gender", "").strip()

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            _select(Patient).where(Patient.name == full_name, Patient.dob == dob)
        )
        patient = result.scalar_one_or_none()
        if patient is not None:
            return patient.id, False
        patient = Patient(name=full_name, dob=dob, gender=gender)
        db.add(patient)
        await db.commit()
        await db.refresh(patient)
        return patient.id, True


async def _save_intake(fields: dict[str, str], patient_id: int | None = None) -> tuple[int, str]:
    """Save intake fields to IntakeSubmission. Returns (patient_id, intake_id)."""
    import json as _json
    import uuid as _uuid
    from sqlalchemy import select as _select
    from src.models.patient import Patient
    from src.models.intake_submission import IntakeSubmission

    KNOWN_COLS = {
        "first_name", "last_name", "dob", "gender",
        "phone", "email", "address",
        "chief_complaint", "symptoms",
        "insurance_provider", "policy_id",
        "emergency_contact_name", "emergency_contact_relationship", "emergency_contact_phone",
    }

    def _get(key: str) -> str:
        return fields.get(key, "").strip()

    async with AsyncSessionLocal() as db:
        if patient_id is not None:
            result = await db.execute(_select(Patient).where(Patient.id == patient_id))
            patient = result.scalar_one_or_none()
            if patient is None:
                raise ValueError(f"patient_id={patient_id} not found")
        else:
            full_name = f"{_get('first_name')} {_get('last_name')}".strip()
            result = await db.execute(
                _select(Patient).where(Patient.name == full_name, Patient.dob == _get("dob"))
            )
            patient = result.scalar_one_or_none()
            if patient is None:
                patient = Patient(name=full_name, dob=_get("dob"), gender=_get("gender"))
                db.add(patient)
                await db.flush()

        extra = {k: v for k, v in fields.items() if k not in KNOWN_COLS}
        submission = IntakeSubmission(
            id=str(_uuid.uuid4()),
            patient_id=patient.id,
            first_name=_get("first_name") or (patient.name.split(" ", 1)[0] if patient.name else ""),
            last_name=_get("last_name") or (patient.name.rsplit(" ", 1)[-1] if patient.name else ""),
            dob=_get("dob") or patient.dob or "",
            gender=_get("gender") or patient.gender or "",
            phone=_get("phone"),
            email=_get("email"),
            address=_get("address"),
            chief_complaint=_get("chief_complaint"),
            symptoms=_get("symptoms") or None,
            insurance_provider=_get("insurance_provider"),
            policy_id=_get("policy_id"),
            emergency_contact_name=_get("emergency_contact_name"),
            emergency_contact_relationship=_get("emergency_contact_relationship"),
            emergency_contact_phone=_get("emergency_contact_phone"),
            extra_data=_json.dumps(extra) if extra else None,
        )
        db.add(submission)
        await db.commit()
        await db.refresh(submission)
        return patient.id, submission.id
```

Also remove these now-unused imports at the top of `messages.py`:
```python
# Remove:
from src.forms.vault import save_intake, identify_patient
from src.forms.field_classification import PII_FIELDS, SAFE_FIELDS, PATIENT_IDENTITY_FIELDS
```

Add if not already present:
```python
from src.tasks.agent_tasks import process_agent_message
```

- [ ] **Step 3: Verify Python imports**

```bash
python -c "from src.api.routers.chat.messages import router; print('ok')"
```

Expected: `ok`

- [ ] **Step 4: Commit**

```bash
git add src/api/models.py src/api/routers/chat/messages.py
git commit -m "feat(backend): generic db_field routing in form response handler"
```

---

## Task 10: Fix merged_events() race condition and remove resolve_form calls

**Files:**
- Modify: `src/api/routers/chat/messages.py` (`generate()` inner function)

Remove any `form_registry.resolve_form()` / `form_registry.cleanup_form()` calls since they no longer exist. Drain the form queue on agent stream end to prevent race condition.

- [ ] **Step 1: Search for obsolete registry calls in messages.py**

```bash
grep -n "resolve_form\|cleanup_form\|register_form\|get_form_result\|get_form_template\|accumulate_answers\|get_accumulated_answers\|clear_accumulated_answers" src/api/routers/chat/messages.py
```

Remove any lines found.

- [ ] **Step 2: Update merged_events() to drain form queue before stopping**

In the `generate()` function, find `merged_events()` and replace the `if event is None: return` with:

```python
agent_done = False
for completed_task in done_set:
    event = completed_task.result()
    if event is None:
        agent_done = True
    else:
        yield event

if agent_done:
    # Drain remaining form events before stopping (prevents race condition
    # when form_request arrives at same time as agent sentinel)
    while not form_event_queue.empty():
        try:
            evt = form_event_queue.get_nowait()
            yield evt
        except asyncio.QueueEmpty:
            break
    return
```

- [ ] **Step 3: Verify Python imports**

```bash
python -c "from src.api.routers.chat.messages import router; print('ok')"
```

Expected: `ok`

- [ ] **Step 4: Commit**

```bash
git add src/api/routers/chat/messages.py
git commit -m "fix(backend): drain form queue on agent done, remove stale registry calls"
```

---

## Task 11: Update system prompt with new ask_user signature

**Files:**
- Modify: `src/prompt/system.py`

The system prompt references `ask_user (form-based intake)`. Update it to reflect the new dynamic field signature.

- [ ] **Step 1: Update the tool description in system.py**

In `src/prompt/system.py`, update the `ask_user` line in the Available Tool Categories:

```python
# Replace:
- Triage: create_visit, complete_triage, ask_user (form-based intake)

# With:
- Triage: create_visit, complete_triage, ask_user (show patient form with custom fields), ask_user_question (choice-based question)
```

- [ ] **Step 2: Commit**

```bash
git add src/prompt/system.py
git commit -m "docs(backend): update system prompt with new ask_user signature"
```

---

## Task 12: Delete obsolete files

**Files:**
- Delete: `src/tools/builtin/ask_user_input_tool.py`
- Delete: `src/forms/templates.py`, `src/forms/vault.py`, `src/forms/field_classification.py`
- Possibly delete: `src/forms/__init__.py`, `src/forms/` directory

- [ ] **Step 1: Check for remaining imports of deleted files**

```bash
grep -r "ask_user_input\|from src.forms" src/ --include="*.py"
```

Remove any remaining imports.

- [ ] **Step 2: Delete files**

```bash
rm -f src/tools/builtin/ask_user_input_tool.py
rm -f src/forms/templates.py src/forms/vault.py src/forms/field_classification.py
cat src/forms/__init__.py 2>/dev/null || echo "(empty)"
# If nothing important remains:
rm -f src/forms/__init__.py && rmdir src/forms 2>/dev/null || true
```

- [ ] **Step 3: Final import check**

```bash
python -c "
from src.tools.builtin.ask_user_tool import ask_user
from src.tools.builtin.ask_user_question_tool import ask_user_question
from src.api.routers.chat.messages import router
from src.tools.form_request_registry import form_registry
print('all imports ok')
"
```

Expected: `all imports ok`

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor(backend): delete obsolete ask_user_input and forms module"
```

---

## Self-Review

**Spec coverage:**
- ✅ Agent passes field definitions: `name`, `label`, `type`, `required`, `db_field`
- ✅ Flexible — any form can be expressed; no hardcoded templates
- ✅ `db_field` maps each field to the correct DB column (`patient.*` or `intake.*`)
- ✅ Non-mapped fields returned to agent safely in trigger message
- ✅ Frontend generates Zod schema at runtime from field list
- ✅ Fire-and-forget: `ask_user` returns `"form_shown"` immediately
- ✅ Form submit → Celery task → frontend subscribes to `GET /messages/{id}/stream`
- ✅ `ask_user_question` unchanged (dynamic choices)
- ✅ `[FORM_RESULT]` messages filtered from session restore
- ✅ Race condition in `merged_events()` fixed
- ✅ All obsolete files deleted

**Placeholder scan:** None — all steps include actual code.

**Type consistency:**
- `FormFieldDef` defined in `web/lib/dynamic-form.ts` — used in `DynamicForm`, `FormInputBar`, `ActiveForm.fields`
- `buildZodSchema(fields)` and `extractFieldMappings(fields)` both take `FormFieldDef[]`
- `onSubmitted(answers?, messageId?)` consistent between `FormInputBar` and `use-intake-chat`
- `_identify_patient(fields: dict[str, str])` takes flat column names (after `db_field` prefix stripped), consistent with how `patient_fields` dict is built
