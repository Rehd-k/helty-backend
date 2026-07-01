# Revenue by Service — Frontend Integration Guide

This document describes how to integrate the **Revenue by Service** summary and drill-down APIs in the accounts reports UI.

## Overview

The feature has two levels:

1. **Summary** — revenue grouped by service **category** (e.g. Laboratory, Radiology). Each row shows total amount, transaction count, and percent of total.
2. **Drill-down** — when the user clicks a summary row, load a paginated list of individual payments (who paid, when, how much, which invoice).

> **Important:** Summary rows use `serviceCategory`, which is the service category name when present, otherwise the individual service name, otherwise `"Other"`. The drill-down endpoint filters by this exact label.

## Authentication

All endpoints require a staff JWT:

```
Authorization: Bearer <token>
```

Allowed account types: `ACCOUNTING`, `ACCOUNTS`, `SUPER_ADMIN`.

## UI flow

```
┌─────────────────────────────────────┐
│  Revenue by Service (summary)       │
│  period selector + asOf (optional)  │
├─────────────────────────────────────┤
│  Laboratory    ₦1,250,000   42 tx   │  ← click row
│  Radiology       ₦800,000   28 tx   │
│  ...                                │
└─────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────┐
│  Laboratory — Payment details       │
│  (same period / asOf as parent)     │
├─────────────────────────────────────┤
│  Date       Patient    Service  Amt  │
│  15 Jun     John Doe   FBC     15k  │
│  ...                                │
│  [pagination]                       │
└─────────────────────────────────────┘
```

Pass `period` and `asOf` from the parent screen into the detail view so totals stay consistent with the summary.

---

## 1. Summary endpoint

### Request

```
GET /accounts/reports/revenue-by-service
```

### Query parameters

| Parameter | Required | Type | Description |
|-----------|----------|------|-------------|
| `period` | yes | string | `today`, `week`, `month`, `quarter`, or `year` |
| `asOf` | no | ISO 8601 | Anchor instant; defaults to now |

### Example

```
GET /accounts/reports/revenue-by-service?period=month&asOf=2026-07-01T00:00:00.000Z
```

### Response

```json
{
  "rows": [
    {
      "serviceCategory": "Laboratory",
      "amount": 1250000,
      "transactionCount": 42,
      "percentOfTotal": 38.5
    },
    {
      "serviceCategory": "Radiology",
      "amount": 800000,
      "transactionCount": 28,
      "percentOfTotal": 24.6
    }
  ]
}
```

### Suggested summary table columns

| Column | Field |
|--------|-------|
| Category | `serviceCategory` |
| Amount | `amount` |
| Transactions | `transactionCount` |
| % of total | `percentOfTotal` |

Make each row clickable. On click, navigate to a detail view (or open a modal) and pass `serviceCategory` plus the current `period` and `asOf`.

---

## 2. Drill-down endpoint

### Request

```
GET /accounts/reports/revenue-by-service/details
```

### Query parameters

| Parameter | Required | Type | Default | Description |
|-----------|----------|------|---------|-------------|
| `period` | yes | string | — | Same as summary: `today`, `week`, `month`, `quarter`, `year` |
| `asOf` | no | ISO 8601 | now | Same anchor as summary |
| `serviceCategory` | yes | string | — | Exact `serviceCategory` from the clicked summary row |
| `skip` | no | number | `0` | Pagination offset |
| `take` | no | number | `50` | Page size (max `100`) |
| `q` | no | string | — | Search patient name, hospital `patientId`, phone, or invoice number |

### Example

```
GET /accounts/reports/revenue-by-service/details?period=month&serviceCategory=Laboratory&skip=0&take=50
```

URL-encode `serviceCategory` when it contains spaces or special characters:

```
serviceCategory=Laboratory
serviceCategory=General%20Consultation
```

### Response

```json
{
  "period": "month",
  "asOf": "2026-07-01T12:00:00.000Z",
  "serviceCategory": "Laboratory",
  "totalAmount": 1250000,
  "total": 42,
  "skip": 0,
  "take": 50,
  "rows": [
    {
      "allocationId": "a1b2c3d4-...",
      "paidAt": "2026-06-15T10:30:00.000Z",
      "amount": 15000,
      "patient": {
        "id": "patient-uuid",
        "patientId": "P-00123",
        "displayName": "Mr John Doe",
        "phoneNumber": "+2348012345678"
      },
      "invoice": {
        "id": "invoice-uuid",
        "invoiceID": "INV-2026-0042"
      },
      "service": {
        "id": "service-uuid",
        "name": "Full Blood Count",
        "categoryName": "Laboratory"
      },
      "lineItem": {
        "quantity": 1,
        "unitPrice": 15000,
        "customDescription": null
      },
      "payment": {
        "id": "payment-uuid",
        "source": "CASH",
        "method": "CASH",
        "reference": null,
        "receivedBy": "Jane Accountant"
      },
      "encounterId": "encounter-uuid-or-null"
    }
  ]
}
```

### Suggested detail table columns

| Column | Field | Notes |
|--------|-------|-------|
| Date | `paidAt` | Format as local date/time |
| Patient | `patient.displayName` | Link to patient chart if available |
| Hospital ID | `patient.patientId` | Optional |
| Service | `service.name` | Individual service within the category |
| Qty | `lineItem.quantity` | Optional |
| Amount | `amount` | Allocated amount for this line |
| Payment method | `payment.source` or `payment.method` | `CASH`, `CARD`, `TRANSFER`, `WALLET`, `INSURANCE`, `WAIVER` |
| Invoice # | `invoice.invoiceID` | Link to invoice detail if available |
| Received by | `payment.receivedBy` | Staff display name |

### Pagination

- Use `total` for total row count and `totalAmount` for the category total in the header.
- Page size: `take` (default 50, max 100).
- Next page: `skip = skip + take`.
- Example page 2: `skip=50&take=50`.

```typescript
const page = 1;
const take = 50;
const skip = (page - 1) * take;

const url = `/accounts/reports/revenue-by-service/details?period=${period}&serviceCategory=${encodeURIComponent(serviceCategory)}&skip=${skip}&take=${take}`;
```

### Search

Debounce a search input and pass it as `q`:

```
GET .../details?period=month&serviceCategory=Laboratory&q=john
```

Search matches (case-insensitive, partial):

- Patient first name, surname, other name
- Hospital `patientId`
- Phone number
- Invoice number (`invoiceID`)

Reset `skip` to `0` when the search query changes.

---

## Field glossary

| Field | Meaning |
|-------|---------|
| `serviceCategory` | Summary grouping label: category name, or service name if uncategorized, or `"Other"` |
| `service.name` | The specific billable service on the invoice line (e.g. "Full Blood Count") |
| `service.categoryName` | The category of that service (may match `serviceCategory`) |
| `amount` | Portion of the payment allocated to this invoice line item |
| `allocationId` | Unique ID for the payment allocation row |
| `paidAt` | When the parent payment was recorded |
| `encounterId` | Related clinical encounter, if any |

---

## Error responses

| Status | Cause |
|--------|-------|
| `400` | Missing/blank `serviceCategory`, invalid `period`, or invalid `asOf` |
| `401` | Missing or expired token |
| `403` | Staff role not allowed (non-accounting user) |

---

## Optional deep links

If your app has these routes, link from the detail table:

- Patient: `/patients/:patient.id` or chart route using `patient.id`
- Invoice: `/invoices/:invoice.id` using `invoice.id` or `invoice.invoiceID`
- Encounter: `/encounters/:encounterId` when `encounterId` is not null

---

## TypeScript types (reference)

```typescript
type RevenueByServiceSummaryRow = {
  serviceCategory: string;
  amount: number;
  transactionCount: number;
  percentOfTotal: number;
};

type RevenueByServiceDetailsRow = {
  allocationId: string;
  paidAt: string;
  amount: number;
  patient: {
    id: string;
    patientId: string | null;
    displayName: string;
    phoneNumber: string | null;
  };
  invoice: {
    id: string;
    invoiceID: string;
  };
  service: {
    id: string | null;
    name: string | null;
    categoryName: string | null;
  };
  lineItem: {
    quantity: number;
    unitPrice: number;
    customDescription: string | null;
  };
  payment: {
    id: string;
    source: string;
    method: string | null;
    reference: string | null;
    receivedBy: string;
  };
  encounterId: string | null;
};

type RevenueByServiceDetailsResponse = {
  period: string;
  asOf: string;
  serviceCategory: string;
  totalAmount: number;
  total: number;
  skip: number;
  take: number;
  rows: RevenueByServiceDetailsRow[];
};
```
