# Doctor Portal — Tabbed Patient Card Design

**Date:** 2026-04-04  
**Status:** Approved

## Goal

Expose all available patient and visit data in the center column of the doctor portal (`ClinicalWorkspace`). Currently the `PatientCardPanel` shows only demographics, chief complaint, and imaging thumbnails. This design upgrades it to a four-tab card that surfaces medical records and visit metadata without adding new collapsible panels or increasing scroll depth.

## Architecture

### Component changes

| File | Change |
|------|--------|
| `web/components/doctor/patient-card-panel.tsx` | Replace flat layout with tabbed component (4 tabs) |
| `web/components/doctor/clinical-workspace.tsx` | Pass `selectedVisit` down to `PatientCardPanel` (already available as prop) |

No new files. No new panels in `ClinicalWorkspace`. The `CollapsiblePanel` wrapper around `PatientCardPanel` is unchanged.

### Data already available

`ClinicalWorkspace` already receives `patient: PatientDetail` and `selectedVisit: VisitListItem`. `PatientDetail` carries `records[]`, `imaging[]`, and `image_groups[]`. `VisitListItem` extends `Visit` with `urgency_level` and `wait_minutes`. All data needed for the four tabs is already in scope — no new API calls required.

`PatientCardPanel` currently only receives `patient` and `chiefComplaint`. It needs `selectedVisit` added to its props.

## Tab Definitions

### Overview (default tab)

- Chief complaint (from `selectedVisit.chief_complaint`)
- Urgency badge (from `selectedVisit.urgency_level`: routine / urgent / critical — color-coded)
- Four stat tiles: Department, Assigned Doctor, Queue Position, Wait Time

### Visit

Key-value list of visit metadata:

- Status (`selectedVisit.status`)
- Urgency level (badge)
- Current department
- Assigned doctor
- Routing decision (`routing_decision[]` joined as arrow chain e.g. "Neurology → Radiology")
- Confidence score (as percentage, shown only when non-null)

### Records

List of `patient.records[]`, each row shows:
- Icon by `record_type`: 📄 pdf, 🖼 image, 📝 text
- Title + date
- Clicking a row with a `file_url` opens it in a new tab; text records expand inline

Empty state: "No records on file"

### Imaging

Existing `PatientImagingPanel` content moved here (2-column thumbnail grid, click to open `.nii.gz`). Empty state: "No imaging on file"

Tab header shows a count badge when records > 0 (e.g. `Records 3`, `Imaging 2`).

## Identity Strip (always visible, above tabs)

Always shown regardless of active tab:

- Patient name (bold)
- Age · Gender · DOB
- Urgency badge (top-right corner, color-coded)

This ensures the patient's identity is never hidden behind a tab.

## States

- **No patient selected**: existing empty state ("Select a patient from the list") — no tabs shown
- **Patient selected, no records**: Records tab shows empty state text
- **Patient selected, no imaging**: Imaging tab shows empty state text

## What Is Not Changing

- `CollapsiblePanel` wrapper around `PatientCardPanel` — unchanged
- Pre-Visit Brief, Clinical Notes, DDx panels — unchanged
- `QuickActionsBar` — unchanged
- No new API calls; all data already fetched

## Out of Scope

- Editing records from this panel
- Adding new records
- Image group display (groups are metadata-only; individual imaging tiles already covered)
