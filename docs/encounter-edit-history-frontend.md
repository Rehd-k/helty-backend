# Encounter edit history — frontend integration guide

This document describes how to integrate post-completion encounter amendments and edit history in the client.

All routes are relative to your configured API base URL.  
Auth: `Authorization: Bearer <token>` (JWT `sub` must be the treating doctor’s Staff UUID to edit).

---

## Edit rules

| Encounter `status` | Who can edit | How changes are stored |
|--------------------|--------------|-------------------------|
| `ONGOING` | Treating doctor only (`encounter.doctorId === current user`) | Direct update on live records (no history rows) |
| `COMPLETED` | Treating doctor only | Full clinical snapshot saved to history **before** each change; live records hold the **current** version |
| `CANCELLED` | Nobody | `400` — cannot edit |

**Optional `editReason`** on any mutating request for a completed encounter (stored on the history row).

---

## `editMeta` on encounter detail

**GET** `/encounters/:id`  
Pass the logged-in staff id via the JWT; the response includes `editMeta`:

```json
{
  "id": "enc-uuid",
  "status": "COMPLETED",
  "doctorId": "doc-uuid",
  "hpi": "Current text…",
  "editMeta": {
    "hasEdits": true,
    "editCount": 2,
    "lastEditedAt": "2026-05-28T14:30:00.000Z",
    "canEdit": true,
    "requiresVersionedEdits": true
  }
}
```

| Field | Type | Use in UI |
|-------|------|-----------|
| `hasEdits` | boolean | Show an **Edited** badge when `true` |
| `editCount` | number | Badge/tooltip: “Amended N time(s)” |
| `lastEditedAt` | ISO string \| null | “Last amended …” |
| `canEdit` | boolean | Enable edit controls only when `true` |
| `requiresVersionedEdits` | boolean | When `true`, completed encounter: same PATCH APIs, but each save creates history (explain to user if needed) |

`canEdit` is `false` for non-treating doctors and for `CANCELLED` encounters.

---

## Mutating endpoints (unchanged URLs)

Use the same routes as before. For **completed** encounters, include optional `editReason` in the body (or query for DELETE diagnosis).

### Main encounter

**PATCH** `/encounters/:id`

Body: existing `UpdateEncounterDto` fields (`hpi`, SOAP fields, `proceduresJson`, etc.) plus optional:

```json
{
  "hpi": "Updated history…",
  "editReason": "Corrected transcription error"
}
```

- Do **not** send `status: ONGOING` to reopen a completed encounter (`400`).
- Omitting `status` no longer resets the encounter to ongoing.

### Diagnoses

| Method | Route | `editReason` |
|--------|-------|----------------|
| `POST` | `/encounters/:encounterId/diagnoses` | Body |
| `PATCH` | `/encounters/:encounterId/diagnoses/:diagnosisId` | Body |
| `DELETE` | `/encounters/:encounterId/diagnoses/:diagnosisId` | Query `?editReason=…` |

### Clinical specialties

| Method | Route | `editReason` |
|--------|-------|----------------|
| `PUT` | `/encounters/:id/specialty-modules` | Body on `SyncSpecialtyModulesDto` |
| `PUT` | `/encounters/:id/clinical-sections/:specialty/:sectionKey` | Body on `UpsertClinicalSectionDto` |

### Complete encounter

**PATCH** `/encounters/:id/complete` — treating doctor only; does **not** create a history row.

---

## Edit history API

### List (summary)

**GET** `/encounters/:id/edit-history`

Newest first. No full snapshot in the list (keeps payloads small).

```json
[
  {
    "id": "hist-uuid",
    "editedAt": "2026-05-28T14:30:00.000Z",
    "reason": "Corrected transcription error",
    "changedKeys": ["hpi", "soapAssessment"],
    "editedBy": {
      "id": "doc-uuid",
      "firstName": "Ada",
      "lastName": "Okafor",
      "staffId": "EMP-001"
    }
  }
]
```

### Detail (full snapshot)

**GET** `/encounters/:id/edit-history/:historyId`

```json
{
  "id": "hist-uuid",
  "editedAt": "2026-05-28T14:30:00.000Z",
  "reason": "Corrected transcription error",
  "changedKeys": ["hpi"],
  "snapshot": {
    "encounter": {
      "chiefComplaint": null,
      "hpi": "Previous HPI text…",
      "pmh": null,
      "surgicalHistory": null,
      "drugHistory": null,
      "allergyHistory": null,
      "familyHistory": null,
      "socialHistory": null,
      "examinationNotes": null,
      "soapSubjective": null,
      "soapObjective": null,
      "soapAssessment": null,
      "soapPlan": null,
      "triageNotes": null,
      "proceduresJson": null
    },
    "diagnoses": [
      {
        "id": "dx-uuid",
        "primaryIcdCode": "J06.9",
        "primaryIcdDescription": "Acute upper respiratory infection",
        "secondaryDiagnosesJson": []
      }
    ],
    "specialtyModules": [
      {
        "specialty": "CARDIOLOGY",
        "enabledSectionKeys": ["cardiology.ecg"]
      }
    ],
    "clinicalSections": [
      {
        "specialty": "CARDIOLOGY",
        "sectionKey": "cardiology.ecg",
        "schemaVersion": 1,
        "data": { "rhythm": "sinus" }
      }
    ]
  },
  "editedBy": { "id": "doc-uuid", "firstName": "Ada", "lastName": "Okafor", "staffId": "EMP-001" }
}
```

---

## UI recommendations

### View mode (completed + amended)

1. If `editMeta.hasEdits`, show badge: **Edited** (optionally with `editCount` / `lastEditedAt`).
2. Button: **View edit history** → list screen/modal from `GET …/edit-history`.
3. Row tap → `GET …/edit-history/:historyId` for diff/timeline.

### Timeline mental model

- **Current screen** = live `GET /encounters/:id` (latest values).
- Each history entry’s `snapshot` = clinical state **immediately before** that edit.
- Oldest history entry ≈ state at the time of the first post-completion amendment (not necessarily identical to moment of `complete` if nothing was snapshotted at completion).

### Diff / highlights

Use `changedKeys` on each history row:

| Key pattern | Meaning |
|-------------|---------|
| `hpi`, `soapPlan`, … | Main encounter field |
| `diagnoses.add` | Diagnosis added |
| `diagnoses.{id}` | Diagnosis updated |
| `diagnoses.{id}.removed` | Diagnosis removed |
| `specialtyModules.CARDIOLOGY` | Module keys changed |
| `clinicalSections.CARDIOLOGY.cardiology.ecg` | Section payload changed |

Compare `snapshot` to the previous version (prior history snapshot or current encounter) for field-level before/after UI.

### Edit mode

| Condition | Behavior |
|-----------|----------|
| `ONGOING` + `canEdit` | Normal inline editing |
| `COMPLETED` + `canEdit` | Amendment flow; optional reason field; save via same PATCH/PUT APIs |
| `!canEdit` | Read-only |

---

## Errors

| HTTP | When |
|------|------|
| `403 Forbidden` | Current user is not `encounter.doctorId` |
| `400 Bad Request` | Cancelled encounter; reopening completed via `status: ONGOING`; PATCH with no clinical changes on completed encounter |
| `404 Not Found` | Unknown encounter or history id |

Standard API error body: `{ "statusCode", "message" }`.

---

## Example flows

### Ongoing consult

1. `GET /encounters/:id` → `status: ONGOING`, `canEdit: true`, `requiresVersionedEdits: false`
2. `PATCH /encounters/:id` with field updates — no history rows

### Amend after completion

1. `GET /encounters/:id` → `status: COMPLETED`, `hasEdits: false`, `canEdit: true`
2. User opens amend form, optional reason
3. `PATCH /encounters/:id` with `{ "hpi": "…", "editReason": "…" }`
4. Refresh detail → `hasEdits: true`, `editCount: 1`
5. **View edit history** → list → open entry → show `snapshot.hpi` vs current `hpi`

### Read-only viewer (another clinician)

1. `GET /encounters/:id` → `canEdit: false`
2. May still list/view history if your app grants read access to encounters

---

## Out of scope (backend)

- One-click restore to a historical version (display only; no restore endpoint).
- Edit history for lab orders, medication orders, or radiology orders.
- Changing `doctorId` after creation.
