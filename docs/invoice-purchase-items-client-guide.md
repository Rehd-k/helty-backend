# Invoice Purchase Items — Client Integration Guide

Use this guide to bill **purchase catalog items** on patient invoices, view usage history, and return unpaid lines.

**Related:** [`purchase-item-selling-price-guide.md`](./purchase-item-selling-price-guide.md) for catalog pricing.

---

## New `InvoiceItem` fields

| Field | Type | Description |
|-------|------|-------------|
| `purchaseItemId` | UUID? | FK to `PurchaseItem` catalog |
| `purchasesLocationId` | UUID? | Purchases location used for FIFO stock |
| `purchaseItem` | object? | `{ id, itemName, sku, sellingPrice }` in responses |
| `purchasesLocation` | object? | `{ id, name }` in responses |

Purchase lines are **mutually exclusive** with `drugId` and `consumableId` on the same line.

---

## Add a purchase item to an invoice

Stock is deducted **immediately** when the line is created (consumable-style).

```http
POST /invoices/{invoiceId}/items
Content-Type: application/json
Authorization: Bearer {token}

{
  "purchaseItemId": "purchase-item-uuid",
  "purchasesLocationId": "purchases-location-uuid",
  "quantity": 2,
  "unitPrice": 1500
}
```

| Field | Required | Notes |
|-------|----------|-------|
| `purchaseItemId` | Yes | Catalog item UUID |
| `purchasesLocationId` | Yes | Location with available batch stock |
| `quantity` | No | Default `1` |
| `unitPrice` | No | Defaults to catalog `sellingPrice` (`0` = free) |
| `serviceId` | No | Optional linked service line metadata |

### Errors

| Status | Cause |
|--------|-------|
| `400` | Missing `purchasesLocationId`, multiple stock types on one line, insufficient stock |
| `404` | Invoice, purchase item, or location not found |
| `400` | Invoice is `PAID` |

---

## Usage history

Lists purchase items issued to patients via invoice lines (stock deducted at add time).

```http
GET /purchases/dashboard/usage-history?fromDate=2026-06-01&toDate=2026-06-07&skip=0&take=20
Authorization: Bearer {token}
```

**Required role:** `PURCHASES`, `PURCHASES_STORE`, `PURCHASES_STAFF`, `PURCHASES_HEAD`, or `SUPER_ADMIN`.

### Query parameters

| Param | Description |
|-------|-------------|
| `fromDate`, `toDate` | ISO date window (defaults to today) |
| `purchaseItemId` | Filter by catalog item |
| `purchasesLocationId` | Filter by issuing location |
| `patientQuery` | Search patient name or `patientId` |
| `skip`, `take` | Pagination (`take` max 100) |

### Response

```json
{
  "data": [
    {
      "invoiceItemId": "line-uuid",
      "invoiceUUID": "invoice-uuid",
      "invoiceId": "A1B2C3D4E5",
      "issuedAt": "2026-06-07T10:30:00.000Z",
      "encounterId": "encounter-uuid",
      "quantity": 2,
      "unitPrice": 1500,
      "amountPaid": 0,
      "purchaseItem": {
        "id": "purchase-item-uuid",
        "name": "Surgical Masks (Box of 50)",
        "sku": "SM-50"
      },
      "patient": {
        "id": "patient-uuid",
        "patientId": "P001",
        "name": "Jane Doe"
      },
      "purchasesLocation": {
        "id": "location-uuid",
        "name": "Main Warehouse",
        "locationType": "WAREHOUSE"
      },
      "issuedBy": {
        "id": "staff-uuid",
        "name": "John Smith"
      }
    }
  ],
  "total": 42,
  "skip": 0,
  "take": 20,
  "window": {
    "from": "2026-06-01T00:00:00.000Z",
    "to": "2026-06-07T23:59:59.999Z"
  }
}
```

`issuedAt` maps to the invoice line `createdAt` (when stock was issued).

---

## Return an unpaid purchase line

Restocks FIFO batches at the original purchases location.

```http
POST /invoice-purchases/{invoiceId}/items/{itemId}/return
Content-Type: application/json
Authorization: Bearer {token}

{
  "quantity": 1,
  "reason": "Wrong item selected"
}
```

### Allowed when

- Invoice status is **not** `PAID`
- Line `amountPaid` is **0**
- Line has **no** payment allocations
- `quantity` ≤ line quantity

### Response

```json
{
  "returnId": "return-uuid",
  "fullLineRemoved": false,
  "invoice": {
    "id": "invoice-uuid",
    "patient": { "..." : "..." },
    "invoiceItems": [ "..." ]
  }
}
```

When `quantity` equals the full line quantity, the line is deleted and `fullLineRemoved` is `true`.

### Errors

| Status | Message pattern |
|--------|-----------------|
| `400` | Invoice is paid |
| `400` | Cannot return a line that has a payment amount |
| `400` | Cannot return a line that has payment allocations |
| `400` | Return quantity exceeds line quantity |
| `404` | Invoice or purchase line not found |

---

## Flutter mapping

| Screen | Endpoint |
|--------|----------|
| Add purchase item to bill | `POST /invoices/:id/items` |
| Usage history (Purchases dashboard) | `GET /purchases/dashboard/usage-history` |
| Return unpaid line | `POST /invoice-purchases/:invoiceId/items/:itemId/return` |

Mirror existing **consumable return** and **pharmacy dispense history** UI patterns; purchases usage history uses `issuedAt` instead of `dispensedAt`.

---

## Remove or update lines

- **Delete line:** `DELETE /invoices/:invoiceId/items/:itemId` — restocks all allocated stock (same as consumables).
- **Update quantity/price:** `PATCH /invoices/:invoiceId/items/:itemId` — releases and re-applies FIFO for the new quantity.

Both are blocked on `PAID` invoices.
