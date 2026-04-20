# HMO API — client integration guide

This document describes how the **Health Maintenance Organization (HMO)** feature works in the hospital backend and how a frontend (web or mobile) should integrate with it.

## Concepts

- **HMO** — A named insurer or plan (e.g. “NHIS Standard Plan”). Each HMO has optional `code` and `notes`.
- **HMO service prices** — For each HMO, you configure **one row per hospital service**: full price for that line item, how much the **HMO pays**, and how much the **patient pays** (co-pay). The API enforces **`hmoPays + patientPays = fullCost`** for every row (two decimal places).
- **Patients** — A patient can be linked to an HMO with **`hmoId`**. The legacy text field **`hmo`** on the patient is still supported for old data; when you set **`hmoId`**, the server syncs **`hmo`** to the linked HMO’s **name** for display compatibility.

## Authentication

All routes below require a **valid staff JWT** (same as the rest of the API).

## List services (for dropdowns)

Before configuring HMO prices, load the master service catalog:

- **`GET /services`** — Paginated list of hospital services (each item includes `id`, `name`, `cost`, etc.).

Store **`id`** as **`serviceId`** when building HMO pricing forms.

---

## HMO endpoints

Base path: **`/hmos`**

### Create HMO

**`POST /hmos`**

Request body:

```json
{
  "name": "NHIS Standard Plan",
  "code": "NHIS-STD",
  "notes": "Optional internal notes",
  "servicePrices": [
    {
      "serviceId": "uuid-of-service-from-get-services",
      "fullCost": 5000,
      "hmoPays": 4000,
      "patientPays": 1000
    }
  ]
}
```

- `servicePrices` is optional. Each entry must reference a valid **`serviceId`** from **`GET /services`**.
- **No duplicate `serviceId`** in the same array.

Response: full HMO detail (same shape as **Get HMO by id**).

### List HMOs

**`GET /hmos?search=&skip=0&take=20`**

- `search` — optional; matches **name** or **code** (case-insensitive).
- `skip` / `take` — pagination.

Response includes list items with **`_count.patients`** and **`_count.servicePrices`**.

### Get HMO by id

**`GET /hmos/:id`**

Returns the HMO, its **`servicePrices`** (each with nested **`service`** summary: `id`, `name`, `searviceCode`, `cost`, …), and **`_count.patients`**.

### Update HMO

**`PATCH /hmos/:id`**

```json
{
  "name": "Updated name",
  "code": "NEW-CODE",
  "notes": "…",
  "servicePrices": [
    {
      "serviceId": "…",
      "fullCost": 6000,
      "hmoPays": 5000,
      "patientPays": 1000
    }
  ]
}
```

- If **`servicePrices`** is present, it **replaces the entire set** of HMO service prices for that HMO (you may send an empty array to clear all prices).
- Omit **`servicePrices`** to leave existing pricing unchanged.

### Delete HMO

**`DELETE /hmos/:id`**

- **Fails with 400** if any patient still has **`hmoId`** pointing to this HMO. Reassign or clear patients first.

### List patients under an HMO

**`GET /hmos/:id/patients?search=&skip=0&take=20`**

- `search` — optional; matches surname, first name, phone, or `patientId`.

---

## Linking patients to an HMO

Use the existing **patient** APIs with the new optional field:

### Create patient

**`POST /patients`** (or your project’s create route — confirm path in Swagger)

Body may include:

- **`hmoId`** — UUID from **`GET /hmos`** (preferred).
- **`hmo`** — legacy free-text (used only when **`hmoId`** is not sent).

If **`hmoId`** is set, the server validates the HMO exists and sets **`hmo`** to that HMO’s **name**.

### Update patient

**`PATCH /patients/:id`**

- **`hmoId`** — UUID to link; send **`null`** to remove the link (also clears the legacy **`hmo`** text).

Patient list/detail responses include **`hmoProvider`** when present:

```json
"hmoProvider": {
  "id": "…",
  "name": "NHIS Standard Plan",
  "code": "NHIS-STD"
}
```

---

## Suggested UI flow

1. **Settings → HMOs**: call **`POST /hmos`** or **`PATCH /hmos/:id`** with **`servicePrices`** built from a multi-select of services (options from **`GET /services`**) and three numeric fields per row: **full cost**, **HMO pays**, **patient pays**.
2. **Patient registration / edit**: show an HMO dropdown from **`GET /hmos`**, save **`hmoId`** on the patient.
3. **View enrollees**: from an HMO detail screen, call **`GET /hmos/:id/patients`**.

---

## Error cases to handle

- **400** — Invalid pricing (`hmoPays + patientPays ≠ fullCost`), duplicate `serviceId` in `servicePrices`, or unknown **`serviceId`**.
- **400** — Cannot delete HMO while patients are linked.
- **404** — Unknown HMO id (or unknown **`hmoId`** on patient create/update).
- **409** — Another HMO already uses the same **name** (case-insensitive) on create/update.

---

## Swagger

Interactive docs: **`/api`** (or your deployed Swagger URL) under tag **`HMO`**.
