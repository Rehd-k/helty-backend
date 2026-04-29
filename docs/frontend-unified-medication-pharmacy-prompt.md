# Frontend Implementation Prompt: Unified Medication Order + Pharmacy Updates

You are a senior frontend engineer. Implement the UI and client-side integration for the latest backend changes in the hospital system. Build production-quality code with strong typing, resilient error handling, and clean UX.

## Goal

Update the frontend to support:

1. Unified medication order source (`MedicationOrder` now handles both encounter and admission medication flows).
2. New medication lifecycle field: `administrationStatus` (`ACTIVE` | `STOPPED`) while preserving existing `status` values used by current client (`Pending Dispense` | `Dispensed` | `Cancelled`).
3. New pharmacy dispense history endpoint (invoice-settlement based) with date-range and drug filters.
4. Consumable batch pricing support (`costPrice`, `sellingPrice`) via new consumable batch endpoints.
5. Add **Dispense History** as its own item in the **Pharmacy** menu.

---

## Non-Negotiable UX Requirements

- Keep existing workflows functional; no regression to current medication order pages.
- Treat `status` and `administrationStatus` as different concerns:
  - `status` = dispense/billing state
  - `administrationStatus` = clinical order activity (`ACTIVE`/`STOPPED`)
- Surface loading, empty, error, and retry states for all new API calls.
- Use date range controls with sane defaults (today start/end) and timezone-safe formatting.
- Preserve pagination for long lists.

---

## Backend Contract to Integrate

### 1) Unified Medication Orders

- Medication orders now include inpatient-compatible fields.
- New/updated payload fields:
  - `admissionId?: string`
  - `startDateTime?: string`
  - `endDateTime?: string`
  - `notes?: string`
  - `administrationStatus?: 'ACTIVE' | 'STOPPED'`
- Existing field remains:
  - `status: 'Pending Dispense' | 'Dispensed' | 'Cancelled'`

Frontend actions:
- Update medication order forms/types/schemas to include optional inpatient fields.
- Ensure detail/list views show:
  - `status` badge (dispense)
  - `administrationStatus` badge (clinical)
- For admission medication screens, map old assumptions to the unified model cleanly.

### 2) Pharmacy Dispense History (new menu item + page)

Use endpoint:
- `GET /pharmacy/dashboard/dispense-history`

Query params to support:
- `fromDate`
- `toDate`
- `drugId`
- `patientQuery` (optional free text)
- `skip`
- `take`

Expected list row fields (from response mapping):
- `invoiceItemId`
- `invoiceId`
- `dispensedAt`
- `encounterId`
- `quantity`
- `unitPrice`
- `amountPaid`
- `drug: { id, name }`
- `patient: { id, patientId, name }`

Frontend actions:
- Add **Dispense History** under Pharmacy sidebar/menu.
- Build page with:
  - date range picker
  - drug selector/autocomplete
  - optional patient search input
  - table/grid results
  - pagination
  - export-ready structure (keep data model export friendly even if export button is deferred)
- Include quick filters: Today, Last 7 days, This month.
- Support deep-linkable filters via URL query state.

### 3) Consumable Batch Pricing

New endpoints:
- `POST /pharmacy/consumables/:id/batches`
- `GET /pharmacy/consumables/:id/batches`

Create payload includes:
- `locationType`
- `locationId`
- `batchNumber?`
- `expiryDate?`
- `quantityReceived`
- `quantityRemaining`
- `costPrice`
- `sellingPrice`

Frontend actions:
- Add consumable batch pricing form fields:
  - Cost Price
  - Selling Price
- Validate numeric input (`>= 0`), with decimal support.
- Show pricing columns in consumable batch list/details.
- Format monetary values consistently with app currency formatter.

---

## Navigation / IA Changes

In Pharmacy menu, ensure this order (or close equivalent):

1. Dashboard
2. Drugs
3. Batches
4. Consumables
5. **Dispense History** (new)
6. Stock Transfer / Purchase / other existing items

Do not hide existing pages; only add this new menu item and route.

---

## State & Data Layer Requirements

- Update API client types/interfaces to include all new fields.
- Add separate frontend model typing for:
  - medication dispense status (`status`)
  - medication administration lifecycle (`administrationStatus`)
- In query hooks/services:
  - debounce patient text filter
  - cancel stale requests on fast filter changes
  - keep previous data while paginating (avoid UI flicker)

---

## Validation Rules (Frontend)

- Medication order:
  - `administrationStatus` only accepts `ACTIVE` or `STOPPED`.
  - `endDateTime` cannot be before `startDateTime` when both exist.
- Consumable batch:
  - `costPrice >= 0`
  - `sellingPrice >= 0`
  - `quantityReceived >= 0`
  - `quantityRemaining >= 0`

Show inline validation messages and block submit on invalid data.

---

## Acceptance Criteria

1. Pharmacy menu contains a new **Dispense History** item that routes correctly.
2. Dispense History page can filter by date range and by drug; optional patient filter works.
3. Medication order screens can read/write `administrationStatus` without breaking existing `status` UX.
4. Consumable batch UI supports create/list with `costPrice` and `sellingPrice`.
5. No regressions in existing medication order and pharmacy screens.
6. All new screens include loading, empty, and error states.
7. TypeScript/build/lint pass in frontend project.

---

## Implementation Style

- Prefer reusable UI primitives over page-specific one-off widgets.
- Keep business mapping in service/query layer, not in components.
- Add concise comments only for non-obvious logic.
- Write/adjust tests for:
  - status vs administrationStatus rendering
  - dispense history filters and pagination
  - consumable pricing form validation

Deliver complete code changes, not pseudo-code.
