# Lab MCS / AST — Frontend Integration Guide

This document describes backend changes for **Microbiology Culture & Sensitivity (MCS)** workflows, specifically **Antibiotic Susceptibility Testing (AST)**. The system does not mark tests as “MCS” in the catalog ahead of time; instead, the ordering user opts in per order line when AST may be needed.

---

## Overview

| Concern | Approach |
|--------|----------|
| Which tests get AST? | User sets `astRequested: true` on an order line when creating the lab order |
| Antibiotic panel | Configured centrally under **Lab → Antibiotics** |
| Susceptibility values (S/I/R, etc.) | Configured centrally under **Lab → AST result options** |
| Culture / organism fields | Existing dynamic test fields (`LabTestField`) on the test version |
| AST grid | Separate API from regular field results |

---

## 1. Lab configuration screens

Add two management sections under **Lab settings / config** (alongside categories, tests, and fields).

### 1.1 Antibiotics catalog

**Base path:** `/lab/antibiotics`

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/lab/antibiotics?activeOnly=true` | Load panel for result-entry dropdowns |
| `GET` | `/lab/antibiotics` | Admin list (includes inactive) |
| `POST` | `/lab/antibiotics` | Create |
| `PATCH` | `/lab/antibiotics/:id` | Update |
| `DELETE` | `/lab/antibiotics/:id` | Delete (409 if referenced by AST results) |

**Create body:**

```json
{
  "name": "Amoxicillin",
  "code": "AMX",
  "isActive": true,
  "position": 0
}
```

**UI suggestions:**

- “Manage antibiotics” button opens a table with add/edit/deactivate.
- Sort by `position`, then `name` (matches API ordering).
- Prefer **deactivate** (`isActive: false`) over delete for antibiotics already used on reports.
- Recommended seed values (create once via admin UI): Amoxicillin, Ampicillin, Ciprofloxacin, Ceftriaxone, Gentamicin, Metronidazole, etc.

### 1.2 AST result options

**Base path:** `/lab/ast-result-options`

Same CRUD shape as antibiotics.

**Create body:**

```json
{
  "label": "Sensitive",
  "code": "S",
  "isActive": true,
  "position": 0
}
```

**Recommended initial options:**

| label | code | position |
|-------|------|----------|
| Sensitive | S | 0 |
| Intermediate | I | 1 |
| Resistant | R | 2 |
| Not tested | NT | 3 |

These populate the **dropdown per antibiotic row** during result entry.

---

## 2. Lab order creation

**Endpoint:** `POST /lab/orders`

Each item in `items` now accepts an optional flag:

```json
{
  "patientId": "uuid",
  "doctorId": "uuid",
  "items": [
    {
      "testVersionId": "uuid",
      "astRequested": true
    },
    {
      "testVersionId": "uuid",
      "astRequested": false
    }
  ]
}
```

### Frontend behaviour

- For **every** test added to an order, show a toggle/checkbox: **“Include AST (antibiotic susceptibility)”**.
- Default: `false`.
- No need to detect MCS from test name/category — the clinician/lab requester decides at order time.
- Persist `astRequested` on each line; it is returned on order fetch.

**Order detail** (`GET /lab/orders/:id`) now includes per item:

```json
{
  "id": "order-item-uuid",
  "astRequested": true,
  "testVersion": { "...": "..." },
  "results": [ "... regular field results ..." ],
  "astResults": [
    {
      "id": "uuid",
      "antibiotic": { "id": "...", "name": "Amoxicillin", "code": "AMX" },
      "resultOption": { "id": "...", "label": "Sensitive", "code": "S" },
      "enteredBy": { "id": "...", "firstName": "...", "lastName": "..." }
    }
  ]
}
```

List endpoint (`GET /lab/orders`) returns `astRequested` on each item but not nested `astResults` — use order detail for the full AST grid.

---

## 3. Result entry

Two parallel sections on the result-entry screen for an order item:

### 3.1 Standard fields (unchanged)

- `POST /lab/results/batch` with `{ orderItemId, enteredBy, results: [{ fieldId, value }] }`
- `GET /lab/results/:orderItemId`

Use for organism, colony count, gram stain, etc. configured as `LabTestField` on the test version.

### 3.2 AST susceptibility grid

Only render when `orderItem.astRequested === true`.

**On mount, load:**

1. `GET /lab/antibiotics?activeOnly=true` — row labels
2. `GET /lab/ast-result-options?activeOnly=true` — dropdown options
3. `GET /lab/ast-results/:orderItemId` — existing entries (if any)

**UI pattern:**

```
Antibiotic          Susceptibility
─────────────────────────────────
Amoxicillin (AMX)   [ Sensitive ▼ ]
Ciprofloxacin       [ Resistant ▼ ]
...
```

- One dropdown per antibiotic row.
- User fills only antibiotics that were tested (partial panel is allowed).
- Empty rows are not submitted.

**Save:**

`POST /lab/ast-results/batch`

```json
{
  "orderItemId": "uuid",
  "enteredBy": "staff-uuid",
  "results": [
    {
      "antibioticId": "uuid",
      "resultOptionId": "uuid"
    }
  ]
}
```

- Upserts by `(orderItemId, antibioticId)` — safe to resubmit on edit.
- Duplicate `antibioticId` in one batch → `400`.
- If `astRequested` is false → `400` with message that AST was not ordered for this line.
- Inactive antibiotic/option IDs → `400`.
- Same invoice/payment rules as regular lab results apply when the order is billed.

**Response:** array of saved AST rows with nested `antibiotic`, `resultOption`, `enteredBy`.

---

## 4. Reports & display

When rendering a completed MCS report:

1. Show standard field results in field order (`position`).
2. If `astRequested`, append an **Antibiotic Susceptibility** table:
   - Columns: Antibiotic (name + optional code), Result (label + optional code)
   - Sort matches API: `antibiotic.position`, then `antibiotic.name`
3. If `astRequested` but `astResults` is empty, show “AST pending” or hide section per product preference.

---

## 5. Error handling

| Status | Scenario |
|--------|----------|
| `400` | AST batch on line without `astRequested` |
| `400` | Duplicate antibiotic in batch |
| `400` | Invalid/inactive antibiotic or result option |
| `404` | Unknown order item, staff, antibiotic, or option |
| `409` | Delete antibiotic/option still referenced by results |

---

## 6. TypeScript types (suggested)

```typescript
interface LabAntibiotic {
  id: string;
  name: string;
  code: string | null;
  isActive: boolean;
  position: number;
}

interface LabAstResultOption {
  id: string;
  label: string;
  code: string | null;
  isActive: boolean;
  position: number;
}

interface LabOrderItemInput {
  testVersionId: string;
  astRequested?: boolean;
}

interface LabAstResultRow {
  antibioticId: string;
  resultOptionId: string;
}

interface LabAstResult {
  id: string;
  orderItemId: string;
  antibiotic: LabAntibiotic;
  resultOption: LabAstResultOption;
  enteredBy: { id: string; firstName: string; lastName: string };
}
```

---

## 7. Migration

Run on backend before using these APIs:

```bash
pnpm exec prisma migrate deploy
```

Migration name: `20260609120000_lab_mcs_ast`

---

## 8. Summary checklist for frontend

- [ ] Config: Antibiotics CRUD screen + “Manage antibiotics” entry point
- [ ] Config: AST result options CRUD + recommended S/I/R defaults
- [ ] Order form: per-line **Include AST** toggle → `astRequested`
- [ ] Result entry: conditional AST grid when `astRequested`
- [ ] Result entry: load antibiotics + options + existing AST results
- [ ] Result entry: save via `POST /lab/ast-results/batch`
- [ ] Order detail / report: render AST table alongside field results
