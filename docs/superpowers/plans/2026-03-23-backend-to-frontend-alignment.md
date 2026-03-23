# Backend-to-Frontend Architecture Alignment Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align the frontend to the simplified new backend architecture (modular `patients/` package), removing health summary, file uploads, and unused types.

**Architecture:** The backend was refactored from a monolithic `patients.py` into `patients/core.py`, `records.py`, `imaging.py`. The new modules drop file uploads and health summary generation; they only support text records and URL-based imaging. The frontend is updated to reflect exactly what these new modules provide.

**Tech Stack:** FastAPI (Python), Next.js 14 (TypeScript), SQLAlchemy async, React

---

## Files to Change

| File | Change |
|---|---|
| `src/api/routers/patients/records.py` | Fix two bugs: wrong field names in response building |
| `web/lib/api.ts` | Remove dropped endpoints/types; update `getPatient` return type; remove `uploadMedicalRecord`, `uploadImagingRecord`, `regenerateHealthSummary`, `streamHealthSummaryUpdates`, `getPatientDetail`, `HealthSummaryResponse`, `UploadResponse`, `PatientVisit` |
| `web/lib/mock-data.ts` | Align `PatientWithDetails` with simplified `PatientDetail`; remove clinical/health-summary fields from mock data |
| `web/components/medical/record-upload.tsx` | Remove file upload tab and non-imaging URL branch; keep URL-only imaging mode |
| `web/components/medical/health-overview.tsx` | Remove AI health summary card and static clinical cards (allergies, meds, history) |
| `web/components/medical/patient-imaging-tab.tsx` | Remove `setUploadDefaultGroupId` from props |
| `web/app/(dashboard)/patient/[id]/page.tsx` | Remove health summary streaming; add separate `getImageGroups` call; remove upload state |

---

## Task 1: Fix backend bugs in `records.py`

**Files:**
- Modify: `src/api/routers/patients/records.py`

The new `records.py` has two bugs introduced during refactoring:
1. `list_patient_records` builds `RecordResponse` with `summary=r.summary` but `RecordResponse` has no `summary` field — it has `title`, `description`, `content`, `file_url`, `file_type`.
2. `create_text_record` references `record.summary` but `TextRecordCreate` has `description`, not `summary`.

- [ ] **Step 1: Fix `list_patient_records` response building**

Replace the list response in `src/api/routers/patients/records.py:30-38`:

```python
    return [
        RecordResponse(
            id=r.id,
            patient_id=r.patient_id,
            record_type=r.record_type,
            title=r.summary or "Medical Record",
            description=None,
            content=r.content,
            file_url=None,
            file_type=r.record_type,
            created_at=r.created_at.isoformat()
        ) for r in records
    ]
```

- [ ] **Step 2: Fix `create_text_record`**

In `create_text_record` replace:
```python
    new_record = MedicalRecord(
        patient_id=patient_id,
        record_type="text",
        content=record.content,
        summary=record.summary   # BUG: field doesn't exist
    )
```
With:
```python
    new_record = MedicalRecord(
        patient_id=patient_id,
        record_type="text",
        content=record.content,
        summary=record.description
    )
```

And fix the return value to use `RecordResponse` correctly:
```python
    return RecordResponse(
        id=new_record.id,
        patient_id=new_record.patient_id,
        record_type=new_record.record_type,
        title=record.title,
        description=new_record.summary,
        content=new_record.content,
        file_url=None,
        file_type="text",
        created_at=new_record.created_at.isoformat()
    )
```

- [ ] **Step 3: Commit**

```bash
git add src/api/routers/patients/records.py
git commit -m "fix: correct RecordResponse field names in new records.py module"
```

---

## Task 2: Simplify types and remove removed endpoints in `api.ts`

**Files:**
- Modify: `web/lib/api.ts`

Remove `PatientVisit`, simplify `PatientDetail`, simplify `MedicalRecord`, remove functions that call dropped endpoints.

- [ ] **Step 1: Remove `PatientVisit` interface**

Delete lines defining the `PatientVisit` interface (lines 30-52 in the current file).

- [ ] **Step 2: Simplify `MedicalRecord` interface**

Replace the current `MedicalRecord` interface with:
```typescript
export interface MedicalRecord {
  id: number;
  patient_id: number;
  record_type: "text" | "image" | "pdf";
  title: string;
  description?: string;
  content?: string;
  file_url?: string;
  file_type?: string;
  created_at: string;
}
```
(Removes: `visit_id`, `metadata`, `updated_at`)

- [ ] **Step 3: Simplify `PatientDetail` interface**

Replace the current `PatientDetail` interface with:
```typescript
export interface PatientDetail extends Patient {
  records?: MedicalRecord[];
  imaging?: Imaging[];
  image_groups?: ImageGroup[];
}
```
(Removes: `medical_history`, `allergies`, `current_medications`, `family_history`, `health_summary*`, `visits`)

- [ ] **Step 4: Update `getPatient` to return `PatientDetail`**

Change the `getPatient` function signature and return type:
```typescript
export async function getPatient(id: number): Promise<PatientDetail> {
  const res = await fetch(`${API_BASE_URL}/patients/${id}`);
  if (!res.ok) throw new Error("Failed to fetch patient");
  return res.json();
}
```

- [ ] **Step 5: Remove `getPatientDetail` function**

Delete the `getPatientDetail` function (currently around line 208). It called `/patients/{id}/detail` which does not exist in the new backend — `GET /patients/{id}` is the correct endpoint (already used by `getPatient`).

Search for any other references before deleting: `grep -r "getPatientDetail" web/` — confirm only `page.tsx` imports it.

- [ ] **Step 6: Remove `UploadResponse` interface and upload functions**

Both `uploadMedicalRecord` and `uploadImagingRecord` call endpoints that no longer exist in the new backend modules. Delete:
- `UploadResponse` interface
- `uploadMedicalRecord()` function
- `uploadImagingRecord()` function

Confirm no remaining usages: `grep -r "uploadMedicalRecord\|uploadImagingRecord" web/` — should return empty after Task 4 removes the import from `record-upload.tsx`.

- [ ] **Step 7: Remove `HealthSummaryResponse` interface and health summary functions**

Delete:
- `HealthSummaryResponse` interface
- `regenerateHealthSummary()` function
- `streamHealthSummaryUpdates()` function and `StreamEvent` type (if only used for health summary)

Note: `StreamEvent` and `streamMessageUpdates` are used for chat — keep those. Only remove `streamHealthSummaryUpdates`.

- [ ] **Step 8: Commit**

```bash
git add web/lib/api.ts
git commit -m "refactor: align api.ts types and functions with new simplified backend"
```

---

## Task 3: Align `mock-data.ts` with simplified `PatientDetail`

**Files:**
- Modify: `web/lib/mock-data.ts`

`PatientWithDetails` currently extends `Patient` with removed fields. Update it to match the simplified `PatientDetail`.

- [ ] **Step 1: Update `PatientWithDetails` to extend `PatientDetail`**

Replace:
```typescript
export interface PatientWithDetails extends Patient {
  medical_history?: string;
  allergies?: string;
  current_medications?: string;
  family_history?: string;
  health_summary?: string;
  health_summary_updated_at?: string;
  health_summary_status?: "pending" | "generating" | "completed" | "error";
  health_summary_task_id?: string;
  records?: MedicalRecord[];
  imaging?: Imaging[];
  image_groups?: ImageGroup[];
  visits?: PatientVisit[];
}
```
With:
```typescript
export interface PatientWithDetails extends PatientDetail {}
```

And update the import at the top:
```typescript
import type {
  PatientDetail,
  MedicalRecord,
  Imaging,
  ImageGroup,
} from "./api";
```

- [ ] **Step 2: Clean up mock patient data**

Remove fields that no longer exist on the type from all entries in `mockPatients` array:
- `medical_history`, `allergies`, `current_medications`, `family_history`
- `health_summary`, `health_summary_updated_at`, `health_summary_status`, `health_summary_task_id`
- `visits` arrays

Keep: `id`, `name`, `dob`, `gender`, `created_at`, `records`, `imaging`, `image_groups`

- [ ] **Step 3: Commit**

```bash
git add web/lib/mock-data.ts
git commit -m "refactor: simplify PatientWithDetails to match new PatientDetail type"
```

---

## Task 4: Simplify `RecordUpload` to URL-only imaging

**Files:**
- Modify: `web/components/medical/record-upload.tsx`

The backend no longer has file upload endpoints. Remove the "Upload File" tab; keep only "Add by URL" for imaging records.

- [ ] **Step 1: Remove file upload state and dropzone**

Remove:
- `UploadMode` type and `uploadMode` state
- `file` state and `setFile`
- `useDropzone` import and `onDrop` callback, `getRootProps`, `getInputProps`, `isDragActive`
- File-mode branch in `handleUpload`

- [ ] **Step 2: Remove non-imaging URL record creation branch**

In `handleUpload`, remove the `else` branch that calls `POST /api/patients/${patientId}/records` with `{title, description, file_type, preview_url, origin_url}` — the new backend records endpoint only accepts `{title, content, description}` for text records, not URL-based records.

Keep only the imaging URL creation path (the `if (imagingTypes.includes(fileType))` branch).

- [ ] **Step 3: Remove `uploadMedicalRecord` and `uploadImagingRecord` imports**

Update the import from `@/lib/api`:
```typescript
import {
  getImageGroups,
  createImageGroup,
} from "@/lib/api";
```

- [ ] **Step 4: Update dialog title and remove mode toggle UI**

Update `DialogTitle` to "Add Imaging Record" and `DialogDescription` to "Add imaging by URL (MRI, X-Ray, CT Scan, etc.)".

Remove the mode toggle buttons (`<div className="flex gap-2 p-1 bg-muted rounded-lg">` block).

- [ ] **Step 5: Remove file upload JSX section**

Remove the conditional `{uploadMode === "file" ? (...file upload area...) : (...URL inputs...)}` — keep only the URL inputs unconditionally.

- [ ] **Step 6: Simplify file type options to imaging only**

Remove non-imaging types from the Select: keep `mri`, `xray`, `t1`, `t1ce`, `t2`, `flair`, `ct_scan`, `ultrasound`. Remove `lab_report` and `other`.

Update the default value: `const [fileType, setFileType] = useState<string>("mri")`.

- [ ] **Step 7: Commit**

```bash
git add web/components/medical/record-upload.tsx
git commit -m "refactor: simplify RecordUpload to URL-only imaging mode"
```

---

## Task 5: Simplify `HealthOverview` component

**Files:**
- Modify: `web/components/medical/health-overview.tsx`

The backend no longer provides health summary, allergies, medications, or visit history. Replace the overview with a simple patient stats card.

- [ ] **Step 1: Remove AI health summary card and regenerate props**

Remove the entire `Card` component block for "AI Health Summary" (lines 39-120).

Remove from the interface:
```typescript
interface HealthOverviewProps {
  patient: PatientWithDetails;
  // Remove these:
  onRegenerateClick?: () => void;
  isRegenerating?: boolean;
  healthSummaryUpdatedAt?: string;
}
```

Simplified interface:
```typescript
interface HealthOverviewProps {
  patient: PatientWithDetails;
}
```

- [ ] **Step 2: Simplify Quick Stats**

Replace the three-card stats grid with two cards (records + imaging):
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
  <Card className="p-4 bg-card/50 border-border/50">
    <div className="flex items-center gap-3">
      <div className="p-2 rounded-lg bg-cyan-500/10">
        <Activity className="w-5 h-5 text-cyan-500" />
      </div>
      <div className="flex-1">
        <p className="text-xs text-muted-foreground">Medical Records</p>
        <p className="text-2xl font-bold font-display">
          {patient.records?.length || 0}
        </p>
      </div>
    </div>
  </Card>

  <Card className="p-4 bg-card/50 border-border/50">
    <div className="flex items-center gap-3">
      <div className="p-2 rounded-lg bg-teal-500/10">
        <Calendar className="w-5 h-5 text-teal-500" />
      </div>
      <div className="flex-1">
        <p className="text-xs text-muted-foreground">Imaging Records</p>
        <p className="text-2xl font-bold font-display">
          {patient.imaging?.length || 0}
        </p>
      </div>
    </div>
  </Card>
</div>
```

- [ ] **Step 3: Remove static clinical cards**

Remove the Allergies, Current Medications, Medical History, and Family History `Card` components — these fields no longer exist on `PatientWithDetails`.

- [ ] **Step 4: Clean up unused imports**

Remove: `Sparkles`, `AlertCircle`, `CheckCircle2`, `TrendingUp`, `Heart`, `RefreshCw`, `ReactMarkdown`, `remarkGfm`

Keep: `Activity`, `Calendar`, `Card`, `Separator`

- [ ] **Step 5: Commit**

```bash
git add web/components/medical/health-overview.tsx
git commit -m "refactor: simplify HealthOverview to stats-only, remove health summary and clinical cards"
```

---

## Task 6: Update patient detail page

**Files:**
- Modify: `web/app/(dashboard)/patient/[id]/page.tsx`

Remove health summary streaming, remove file upload state, update data loading to use simplified `getPatient` + separate `getImageGroups` call.

- [ ] **Step 1: Update imports**

In the `@/lib/api` import block, remove:
- `getPatientDetail`
- `regenerateHealthSummary`
- `streamHealthSummaryUpdates`

Add `getImageGroups` (needed for Step 3's separate groups fetch):
```typescript
import {
  getPatient,
  getImageGroups,       // ← add
  getSessionMessages,
  deleteImagingRecord,
  type MedicalRecord,
  type Imaging,
  type ImageGroup,
} from "@/lib/api";
```

State type stays as `PatientWithDetails` from `@/lib/mock-data` — it now extends `PatientDetail` so it's compatible.

- [ ] **Step 2: Remove health summary state variables**

Remove:
```typescript
const [isRegenerating, setIsRegenerating] = useState(false);
const streamCleanupRef = useRef<(() => void) | null>(null);
```

- [ ] **Step 3: Update data loading `useEffect`**

Ensure `getImageGroups` is imported from `@/lib/api` at the top of the file.

Replace:
```typescript
useEffect(() => {
  if (params.id) {
    getPatient(Number(params.id))
      .then(setPatient)
      .catch(() => { ... })
  }
}, [params.id]);
```
With a version that also fetches image groups (the new `core.py` `get_patient` returns `image_groups: []` empty — groups must be loaded separately):
```typescript
useEffect(() => {
  if (!params.id) return;
  const id = Number(params.id);

  const loadPatient = async () => {
    try {
      const patientData = await getPatient(id);
      try {
        const groups = await getImageGroups(id);
        setPatient({ ...patientData, image_groups: groups });
      } catch {
        setPatient(patientData);
      }
    } catch {
      const mockPatient = getMockPatientById(id);
      if (mockPatient) setPatient(mockPatient);
    }
  };

  loadPatient();
}, [params.id]);
```

- [ ] **Step 4: Remove health summary functions and effects**

Delete:
- `startHealthSummaryStream` function
- `useEffect` for stream cleanup (`return () => streamCleanupRef.current?.()`)
- `useEffect` for auto-resume streaming
- `handleRegenerateHealthSummary` function

- [ ] **Step 5: Remove upload state that's no longer needed**

Remove `uploadDefaultGroupId` state (the simplified RecordUpload no longer needs a default group from the page; it manages groups internally).

Remove `handleUploadComplete` function — replaced by a reload of imaging data.

Add a simple refresh after upload:
```typescript
const handleUploadComplete = (record: Imaging) => {
  setPatient((current) => {
    if (!current) return current;
    return {
      ...current,
      imaging: [record, ...(current.imaging || [])],
    };
  });
};
```

Remove `handleImageGroupCreated` — the RecordUpload component manages groups internally now.

- [ ] **Step 6: Update `HealthOverview` call**

Remove the regenerate props:
```tsx
<HealthOverview patient={patient} />
```

- [ ] **Step 7: Update `RecordUpload` call**

Remove `defaultGroupId` and `onGroupCreated` props (no longer on the simplified component):
```tsx
<RecordUpload
  patientId={patient.id}
  open={uploadOpen}
  onClose={() => setUploadOpen(false)}
  onUploadComplete={handleUploadComplete}
/>
```

- [ ] **Step 8: Update `PatientImagingTab` call**

Remove `setUploadDefaultGroupId` from the JSX call (this prop is removed from `PatientImagingTab` in Task 7 — do Task 6 and Task 7 together or ensure Task 7 is done first to avoid TypeScript errors):
```tsx
<PatientImagingTab
  patientId={patient.id}
  imageRecords={imageRecords}
  imageGroups={patient.image_groups}
  setUploadOpen={setUploadOpen}
  setViewerRecord={setViewerRecord}
  onAnalyzeGroup={handleAnalyzeGroup}
/>
```

Also remove `onGroupCreated` — `RecordUpload` now manages groups internally and the page no longer has `handleImageGroupCreated`.

- [ ] **Step 9: Commit**

```bash
git add web/app/(dashboard)/patient/[id]/page.tsx
git commit -m "refactor: align patient detail page with new simplified backend"
```

---

## Task 7: Remove `setUploadDefaultGroupId` and `onGroupCreated` from `PatientImagingTab`

**Files:**
- Modify: `web/components/medical/patient-imaging-tab.tsx`

**Do this task before Task 6 Step 8** to avoid TypeScript errors when removing these props from the page call.

The `setUploadDefaultGroupId` prop is no longer passed from the page (RecordUpload manages groups internally). The `onGroupCreated` callback is also no longer needed since the parent page no longer tracks groups in state.

- [ ] **Step 1: Remove props from interface and all usages**

In `patient-imaging-tab.tsx`, remove from `PatientImagingTabProps`:
- `setUploadDefaultGroupId?: (groupId: string | undefined) => void`
- `onGroupCreated?: (group: ImageGroup) => void`

Remove all calls to `setUploadDefaultGroupId?.(...)` and `onGroupCreated?.(...)` within the component body.

If `ImageGroup` was only imported for the `onGroupCreated` type, remove that import too.

- [ ] **Step 2: Commit**

```bash
git add web/components/medical/patient-imaging-tab.tsx
git commit -m "refactor: remove setUploadDefaultGroupId and onGroupCreated props from PatientImagingTab"
```

---

## Verification

After all tasks:

- [ ] Start the backend: `uvicorn src.api.server:app --reload`
- [ ] Verify `/api/patients/{id}/records` returns JSON with `title`, `description`, `content`, `file_url`, `file_type` fields (no crash)
- [ ] Verify `POST /api/patients/{id}/records` with `{"title": "Test", "content": "Content", "description": null}` creates a record without error
- [ ] Start the frontend: `cd web && npm run dev`
- [ ] Verify patient list page loads
- [ ] Verify patient detail page loads without TypeScript errors
- [ ] Verify the Imaging tab shows "Add Imaging" button → opens URL-only dialog
- [ ] Verify the Overview tab shows Medical Records and Imaging counts (no health summary section)
- [ ] Verify no console errors from removed endpoints
