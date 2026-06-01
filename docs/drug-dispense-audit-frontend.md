# Drug dispense audit — frontend integration

When a pharmacy user dispenses a drug (marks an invoice drug line as settled), the backend now records **who** dispensed it, **which dispensary** stock was taken from, and **when** it happened.

## Dispense (settle) a line

**Endpoint:** `PATCH /invoice-drugs/:invoiceId/items/:itemId`

**Query (required when dispensing):**

| Param | Required | Description |
|-------|----------|-------------|
| `locationId` | Yes, when `settled: true` | UUID of the pharmacy location (dispensary) to deduct stock from |

**Body:**

```json
{ "settled": true }
```

**Auth:** Same JWT as other staff endpoints. The authenticated user (`req.user.sub`) is stored as the dispenser. If the token is missing when settling, the API returns `401` with message: `Authenticated staff id required to dispense this drug.`

**Errors when dispensing:**

| Status | When |
|--------|------|
| `400` | `locationId` omitted — `Dispensary location is required to dispense this drug.` |
| `400` | Insufficient stock at the chosen location |
| `400` | Unpaid invoice and patient not actively admitted (credit dispense rules) |
| `401` | No authenticated staff on settle |

**Example:**

```http
PATCH /invoice-drugs/a1b2c3d4-.../items/e5f6g7h8-...?locationId=loc-dispensary-uuid
Authorization: Bearer <token>
Content-Type: application/json

{ "settled": true }
```

## Response fields on drug invoice lines

After dispense (and on `GET /invoice-drugs/:id`), each line item may include:

| Field | Type | Description |
|-------|------|-------------|
| `dispensedAt` | ISO datetime or `null` | Set once at first dispense |
| `dispensedBy` | `{ id, firstName, lastName }` or `null` | Staff who dispensed |
| `dispensaryLocation` | `{ id, name, locationType }` or `null` | Location stock was taken from |

Legacy lines settled before this change have `null` for these fields.

## Choosing a dispensary

List locations with the existing pharmacy locations API. Filter by `locationType: DISPENSARY` in the UI so users pick a valid dispensary before calling settle.

```
GET /pharmacy/locations?locationType=DISPENSARY
```

(Exact path/query may match your existing pharmacy module client.)

## Dispense history (pharmacy dashboard)

**Endpoint:** `GET /pharmacy/dashboard/dispense-history`

**Behavior change:** History is filtered by each line’s `dispensedAt` (not invoice `updatedAt`). Only lines with a recorded dispense timestamp appear (`dispensedAt` not null).

**New fields per row:**

| Field | Type | Description |
|-------|------|-------------|
| `dispensedAt` | ISO datetime | From the invoice line |
| `dispensedBy` | `{ id, name }` or `null` | Dispenser display name |
| `dispensary` | `{ id, name, locationType }` or `null` | Dispensary used |

Existing fields (`invoiceItemId`, `invoiceId`, `patient`, `drug`, `quantity`, etc.) are unchanged.

## UI checklist

1. Before dispense, require the user to select a dispensary (pass as `locationId`).
2. Ensure the dispense action sends the staff JWT (same as drug returns).
3. Show `dispensedBy`, `dispensaryLocation`, and `dispensedAt` on invoice detail for settled drug lines.
4. Update dispense history table to show dispenser and dispensary columns.
5. Do not rely on pre-migration history rows for dispenser/location (they will be null until re-dispensed).

## Related: drug returns

Returns already require auth and record `performedBy` + `dispensaryLocation` on `InvoiceDrugReturn`. Dispense now mirrors that pattern on `InvoiceItem`.
