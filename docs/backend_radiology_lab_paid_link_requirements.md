# Backend Requirements: Radiology + Lab Paid-Linked Requests

## Context
Frontend now uses a paid-invoice flow for Radiology and Laboratory:
- Patient is selected/created first.
- Services are sent to bill (invoice + invoice items).
- Waiting Patients lists paid invoices by category.
- Opening a paid patient starts request creation with invoice linkage metadata.

This document lists backend API contracts needed so the flow is fully enforceable server-side.

## 1) Invoices By Category (Paid-Only Support)

### Endpoint
- `GET /invoices/by-service-categories`

### Required query params
- `category` (repeatable): e.g. `Radiology & Imaging`, `Laboratory`, `Laboratory Tests`
- `fromDate`, `toDate` (ISO date-time)
- `status` (optional but required for this flow): `PAID` (or include `FULLY_PAID`)
- search fields already used by frontend: `transactionId`, `invoiceId`, `invoiceID`, `patientName`

### Required response shape per row
- `invoice.id` (UUID invoice id)
- `invoice.invoiceID` or `invoice.invoiceId` (human bill number)
- `invoice.status`
- `invoice.patientId` and/or nested `patient.id`
- `invoice.invoiceItems[]` with:
  - `id` (invoice item id)
  - `serviceId`
  - `service.name`
  - `service.category.name` (or equivalent category field)

## 2) Radiology Request Creation With Invoice Item Link

### Existing endpoint used
- `POST /radiology/requests`

### Frontend now sends (when opened from paid waiting flow)
- existing fields:
  - `patientId`
  - `requestedById`
  - `scanType`
  - `priority`
  - optional notes/body fields
- new linkage fields:
  - `invoiceId`
  - `invoiceItemId`
  - `serviceId`

### Required backend behavior
- Validate `invoiceId` belongs to `patientId`.
- Validate invoice is paid (`PAID` or `FULLY_PAID`).
- Validate `invoiceItemId` exists on invoice and matches `serviceId`.
- Validate service category is `Radiology & Imaging`.
- Enforce one-time consumption (cannot reuse same invoice item for multiple radiology requests).
- Mark invoice item as consumed/reserved for this created request (persist link).

## 3) Lab Order Creation With Invoice Item Link

### Existing endpoint used
- `POST /lab/orders`

### Frontend now sends (when opened from paid waiting flow)
- existing fields:
  - `patientId`
  - `doctorId`
  - `items: [{ testVersionId }]`
- new linkage fields:
  - `invoiceId`
  - `invoiceItemId`
  - `serviceId`

### Required backend behavior
- Validate `invoiceId` belongs to `patientId`.
- Validate invoice is paid.
- Validate `invoiceItemId` and `serviceId` are linked on that invoice.
- Validate service category is either `Laboratory` or `Laboratory Tests`.
- Enforce one-time consumption of the invoice item.
- Persist relation between created lab order and consumed invoice item.

## 4) Encounter Imaging/Lab Order Rules (already preselected patient)

Doctor encounter imaging/lab order dialogs now filter to matching categories only.
For consistency, if backend auto-creates invoice items from `serviceId`, enforce:
- category checks by module (`Radiology & Imaging` vs `Laboratory*`)
- duplicate protection for already-consumed invoice items when linkage is supplied

## 5) Error Contract (for frontend UX)

Use clear machine-readable errors, for example:
- `INVOICE_NOT_PAID`
- `INVOICE_ITEM_NOT_FOUND`
- `INVOICE_ITEM_ALREADY_CONSUMED`
- `INVOICE_ITEM_CATEGORY_MISMATCH`
- `INVOICE_PATIENT_MISMATCH`

Recommended payload:
```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "code": "INVOICE_ITEM_ALREADY_CONSUMED",
  "message": "This paid invoice item has already been used for a request."
}
```

## 6) Optional: Explicit Consumption API

If consumption is not done inside create endpoints, add one of:
- `POST /invoices/:invoiceId/items/:itemId/consume` (idempotent), or
- transactionally consume inside request creation endpoints (preferred).

Preferred approach is transactional consume on create to avoid race conditions.
