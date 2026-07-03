# Pharmacy Head Dashboard & Sales Analytics — Backend Guide

This document specifies the backend work required to power the **Pharmacy Head Dashboard**, the **Sales Breakdown** report (with profit), and the **Inventory Valuation** report (worth of drugs per store, by batch and cost price).

Use this guide when building the pharmacy analytics endpoints and the schema changes that make batch-level profit possible.

---

## Why this needs schema changes

The head of pharmacy wants profit, not just revenue. Profit is `sales − cost of goods sold (COGS)`. The Flutter client already receives batch cost data when stock is received (`DrugBatch.costPrice`, `DrugBatch.quantityRemaining`), and revenue when medication is dispensed and billed. The gap is that **a dispensed sale line does not currently record which batch it came from or what that batch cost**. Without that link, profit cannot be calculated after the fact, because a drug's batch cost changes over time.

The agreed approach is **FIFO (first in, first out)**: when a drug is dispensed, deplete the oldest non-expired batch first, and snapshot that batch's unit cost onto the sale line at the moment of dispense.

```
Dispense 30 units of Drug X at Dispensary A
  ┌──────────────────────────────────────────────┐
  │ Batch B1 (received Jan): 20 left @ ₦50 cost   │ → take 20 (cost ₦1,000)
  │ Batch B2 (received Mar): 40 left @ ₦60 cost   │ → take 10 (cost ₦600)
  └──────────────────────────────────────────────┘
  COGS for this sale = ₦1,600
  A single sale line can split across multiple batch allocations.
```

---

## 1. Schema / data model changes

### 1.1 New table: `DispenseBatchAllocation`

Records the FIFO depletion of batches for each dispensed sale line. One dispensed line can produce several allocations.

| Field | Type | Notes |
|-------|------|-------|
| `id` | `String @id @default(cuid())` | |
| `invoiceItemId` | `String` | The billed drug line this allocation belongs to |
| `dispensationId` | `String?` | Link to `Dispensation` when available |
| `drugId` | `String` | Denormalized for fast reporting |
| `batchId` | `String` | The depleted `DrugBatch` |
| `locationId` | `String` | Dispensary/store the stock left from |
| `quantity` | `Int` | Units taken from this batch |
| `unitCost` | `Decimal` | Snapshot of `DrugBatch.costPrice` at dispense time |
| `unitSellingPrice` | `Decimal` | Snapshot of the price charged on the invoice line |
| `payerType` | `String?` | `CASH`, `INSURANCE`, `CORPORATE`, `HMO` (from invoice) |
| `dispensedById` | `String?` | Staff who dispensed |
| `dispensedAt` | `DateTime` | Used for all date-range filtering |
| `createdAt` | `DateTime @default(now())` | |

**Relations:** define both sides with `@relation` on `DrugBatch`, `Drug`, `PharmacyLocation`, and the invoice item / `Dispensation` models.

**Indexes (required for report performance):**

```prisma
@@index([dispensedAt])
@@index([locationId, dispensedAt])
@@index([drugId, dispensedAt])
@@index([batchId])
@@index([invoiceItemId])
```

Line-level values are derived:

- `lineCogs = quantity × unitCost`
- `lineSales = quantity × unitSellingPrice`
- `lineProfit = lineSales − lineCogs`

### 1.2 Dispense flow update (FIFO allocation)

When pharmacy dispenses a drug at a location, inside a single transaction:

1. Select candidate `DrugBatch` rows for that `drugId` at that `locationId` where `quantityRemaining > 0` and the batch is not expired, ordered by `expiryDate ASC` then `manufacturingDate ASC` (oldest first).
2. Walk the batches, taking units until the dispensed quantity is satisfied.
3. For each batch touched, create a `DispenseBatchAllocation` with the `unitCost` snapshot and decrement `DrugBatch.quantityRemaining`.
4. If stock is insufficient across batches, fail the dispense (do not allow negative stock).

### 1.3 Optional: `InventoryMovement` ledger entries

The client already models `InventoryMovement` (with `movementType = DISPENSE`) but no endpoint writes it. If you adopt the ledger, write a `DISPENSE` movement per allocation carrying `batchId` and `unitCost`, so movements and allocations reconcile.

### 1.4 Backfill strategy for historical sales

Dispensed lines created before this change have no allocation and therefore no cost. For those:

- Return `unitCost: null` and `profitUnknown: true` on detail rows.
- Exclude them from `totalCogs` / `grossProfit` aggregates (do not treat missing cost as zero cost, which would overstate profit).
- Surface a count of `profitUnknownCount` in summaries so the UI can warn that some history predates cost tracking.

Optionally, run a one-time best-effort backfill using each drug's most recent batch cost, flagged as estimated.

---

## 2. Authentication & authorization

All endpoints require a staff JWT:

```
Authorization: Bearer <token>
```

| Endpoint group | Allowed roles |
|----------------|---------------|
| Financial reports (profit, valuation, head summary) | `PHARMACY_HEAD`, `SUPER_ADMIN` (plus super-admin preview acting as pharmacy head) |
| Existing operational dashboard | Existing pharmacy roles (`PHARMACY`, `PHARMACY_STORE`, `PHARMACY_DISPENSARY`, `PHARMACY_HEAD`) |

Profit and cost figures are sensitive; do not expose the financial report endpoints to store or dispensary staff.

---

## 3. Endpoints

Shared query parameters (each endpoint documents which it accepts):

| Parameter | Type | Description |
|-----------|------|-------------|
| `fromDate` | ISO 8601 | Start of range (inclusive) |
| `toDate` | ISO 8601 | End of range (inclusive) |
| `storeId` | string | Restrict to one `STORE` location (source store) |
| `locationId` | string | Restrict to a dispensing/holding location |
| `payerType` | string | `Cash`, `Insurance`, `Corporate`, `HMO`; omit or `All` for everything |
| `groupBy` | string | `drug`, `therapeuticClass`, `payer`, `dispensary` (sales breakdown only) |
| `q` | string | Free-text search on detail rows (drug / patient / invoice) |
| `skip` / `take` | int | Pagination on detail endpoints (default `take` 50) |
| `expiryWithinDays` | int | Valuation filter: only batches expiring within N days (`0` = expired) |

Monetary values may be returned as numbers or Prisma `Decimal` objects; the client normalizes both.

### 3.1 Head summary

```
GET /pharmacy/dashboard/head-summary
```

Accepts `fromDate`, `toDate`, `storeId`, `payerType`.

```json
{
  "totalSales": 4850000,
  "totalQuantitySold": 12840,
  "totalCogs": 3120000,
  "grossProfit": 1730000,
  "grossMarginPercent": 35.67,
  "netCollections": 4610000,
  "transactionCount": 1904,
  "avgSellingPrice": 377.72,
  "avgProfitPerTransaction": 908.6,
  "inventoryValueAtCost": 18400000,
  "inventoryValueAtSellingPrice": 24950000,
  "nearExpiryValueAtCost": 640000,
  "expiredValueAtCost": 85000,
  "lowStockCount": 23,
  "outOfStockCount": 6,
  "profitUnknownCount": 41
}
```

Notes:
- `transactionCount` counts distinct dispensed invoice lines (or invoices) in range.
- `totalSales` and `totalCogs` exclude `profitUnknown` lines; `profitUnknownCount` reports how many were skipped.
- Inventory values are as-of "now" (not range-bound), optionally scoped by `storeId`.

### 3.2 Sales & profit time series

```
GET /pharmacy/dashboard/charts/sales-profit
```

Accepts `fromDate`, `toDate`, `storeId`, `payerType`. Buckets by day/week/month as appropriate for the range.

```json
[
  { "label": "2026-06-01", "grossSales": 162000, "cogs": 104000, "grossProfit": 58000, "quantitySold": 430 },
  { "label": "2026-06-02", "grossSales": 148500, "cogs": 96000,  "grossProfit": 52500, "quantitySold": 402 }
]
```

### 3.3 Sales breakdown (grouped, with profit)

```
GET /pharmacy/reports/sales-breakdown
```

Accepts `fromDate`, `toDate`, `storeId`, `payerType`, `groupBy`.

`groupKey` is the stable identifier used to drill down (e.g. `drugId`, therapeutic class name, payer code, `locationId`). `groupLabel` is the display name.

```json
{
  "totals": {
    "quantitySold": 12840,
    "grossSales": 4850000,
    "cogs": 3120000,
    "grossProfit": 1730000,
    "marginPercent": 35.67,
    "transactionCount": 1904
  },
  "rows": [
    {
      "groupKey": "drug-uuid-1",
      "groupLabel": "Amoxicillin 500mg Cap",
      "quantitySold": 1820,
      "grossSales": 546000,
      "cogs": 327600,
      "grossProfit": 218400,
      "marginPercent": 40.0,
      "transactionCount": 302,
      "percentOfTotalSales": 11.26
    }
  ]
}
```

### 3.4 Sales breakdown details (paginated FIFO lines)

```
GET /pharmacy/reports/sales-breakdown/details
```

Accepts `fromDate`, `toDate`, `storeId`, `payerType`, `groupBy`, `groupKey`, `q`, `skip`, `take`.

Pass the parent `groupBy` + `groupKey` to scope the detail list to a single breakdown row (e.g. all sale lines for one drug). Each row is a `DispenseBatchAllocation` (so a multi-batch sale shows one row per batch).

```json
{
  "total": 302,
  "rows": [
    {
      "dispensedAt": "2026-06-14T10:22:00.000Z",
      "drugName": "Amoxicillin 500mg Cap",
      "batchNumber": "AMX-2406",
      "quantity": 20,
      "unitSellingPrice": 300,
      "unitCost": 180,
      "lineSales": 6000,
      "lineCogs": 3600,
      "lineProfit": 2400,
      "profitUnknown": false,
      "patientName": "John Doe",
      "payerType": "Cash",
      "dispensaryName": "Main Dispensary",
      "dispensedByName": "P. Ade",
      "invoiceId": "invoice-uuid"
    }
  ]
}
```

For historical lines with no allocation, return `unitCost: null`, `lineCogs: null`, `lineProfit: null`, `profitUnknown: true`.

### 3.5 Inventory valuation (per store summary)

```
GET /pharmacy/reports/inventory-valuation
```

Accepts `storeId` (optional; omit for all locations), `expiryWithinDays` (optional). Valuation is as-of now.

For each holding location, sum over its batches with `quantityRemaining > 0`:

- `valueAtCost = Σ(quantityRemaining × costPrice)`
- `valueAtSellingPrice = Σ(quantityRemaining × sellingPrice)`
- `nearExpiryValueAtCost = Σ(quantityRemaining × costPrice)` for batches expiring within the near-expiry window

```json
{
  "totals": {
    "batchCount": 512,
    "totalQuantity": 84200,
    "valueAtCost": 18400000,
    "valueAtSellingPrice": 24950000,
    "nearExpiryValueAtCost": 640000
  },
  "stores": [
    {
      "locationId": "loc-uuid-1",
      "locationName": "Central Store",
      "locationType": "STORE",
      "batchCount": 210,
      "totalQuantity": 41000,
      "valueAtCost": 9600000,
      "valueAtSellingPrice": 13100000,
      "nearExpiryValueAtCost": 210000
    }
  ]
}
```

### 3.6 Inventory valuation batches (paginated detail)

```
GET /pharmacy/reports/inventory-valuation/batches
```

Accepts `locationId` (optional), `q` (drug search), `expiryWithinDays`, `skip`, `take`.

```json
{
  "total": 210,
  "rows": [
    {
      "batchId": "batch-uuid",
      "drugId": "drug-uuid",
      "drugName": "Amoxicillin 500mg Cap",
      "batchNumber": "AMX-2406",
      "expiryDate": "2027-03-01T00:00:00.000Z",
      "quantityRemaining": 400,
      "unitCost": 180,
      "unitSellingPrice": 300,
      "lineValueAtCost": 72000,
      "lineValueAtSelling": 120000,
      "locationName": "Central Store",
      "supplierName": "PharmaSupply Ltd"
    }
  ]
}
```

---

## 4. Profit & valuation formulas (authoritative)

| Metric | Formula |
|--------|---------|
| Line COGS | `quantity × unitCost` (FIFO snapshot) |
| Line sales | `quantity × unitSellingPrice` (net of line discounts if applied) |
| Gross profit | `lineSales − lineCogs` |
| Gross margin % | `grossProfit / lineSales × 100` (guard against divide-by-zero) |
| Inventory value at cost | `Σ(quantityRemaining × costPrice)` over batches at the location |
| Inventory value at selling | `Σ(quantityRemaining × sellingPrice)` over batches at the location |

Aggregate margin uses summed sales and summed COGS, not an average of per-line margins.

---

## 5. Edge cases to handle

| Case | Expected behavior |
|------|-------------------|
| **Returns / reversals** | Reverse the matching allocations (restore `quantityRemaining`) and subtract their sales/COGS from the range totals, or record negative allocations. Do not leave profit overstated. |
| **Stock transfers between stores** | Cost follows the batch. Valuation reflects the batch's current `locationId`; transfers do not create sales or profit. |
| **Partial dispense across batches** | Emit one allocation per batch touched; the detail report shows each. |
| **Expired batch write-offs** | Reduce inventory value; they are not sales, so they never appear in COGS/profit. Track separately as `expiredValueAtCost`. |
| **Insurance vs cash attribution** | Derive `payerType` from the invoice/payer on the encounter and snapshot it on the allocation so payer breakdowns stay stable. |
| **Missing cost (pre-tracking history)** | `profitUnknown: true`; excluded from profit aggregates and counted in `profitUnknownCount`. |
| **Zero-sales denominator** | Return margin `0` (not `NaN`) when `lineSales` is `0`. |

---

## 6. Implementation checklist (backend team)

- [ ] Add `DispenseBatchAllocation` model + relations + indexes
- [ ] Migration for the allocation table
- [ ] Update the dispense service to allocate FIFO and snapshot cost inside the dispense transaction
- [ ] (Optional) Write `DISPENSE` `InventoryMovement` entries per allocation
- [ ] Implement the six endpoints above with `PHARMACY_HEAD` / `SUPER_ADMIN` guards
- [ ] Add aggregation queries with indexes on `dispensedAt`, `locationId`, `batchId`
- [ ] Return `profitUnknown` / `profitUnknownCount` for pre-tracking history
- [ ] Decide and implement the returns/reversal handling
- [ ] (Optional) One-time estimated backfill of historical costs

---

## 7. Flutter integration (Helty)

| Layer | File |
|-------|------|
| Permissions | `isPharmacyHead`, `canViewPharmacyFinancialReports` in `lib/src/pharmacy/auth/pharmacy_permissions.dart` |
| Models | `lib/src/pharmacy/models/pharmacy_reports_model.dart` |
| Head dashboard service | `lib/src/pharmacy/services/pharmacy_head_dashboard_service.dart` (`/pharmacy/dashboard/head-summary`, `/pharmacy/dashboard/charts/sales-profit`) |
| Reports service | `lib/src/pharmacy/services/pharmacy_reports_service.dart` (`/pharmacy/reports/*`) |
| Head dashboard screen | `lib/src/pharmacy/ui/pharmacy_head_dashboard_screen.dart` |
| Reports hub | `lib/src/pharmacy/ui/pharmacy_reports_hub_screen.dart` |
| Sales breakdown | `lib/src/pharmacy/ui/pharmacy_sales_breakdown_screen.dart` |
| Sales detail | `lib/src/pharmacy/ui/pharmacy_sales_breakdown_detail_screen.dart` |
| Inventory valuation | `lib/src/pharmacy/ui/pharmacy_inventory_valuation_screen.dart` |
| Routes | `PharmacyHeadDashboardRoute`, `PharmacyReportsHubRoute`, `PharmacySalesBreakdownRoute`, `PharmacySalesBreakdownDetailRoute(groupBy:, groupKey:, groupLabel:, ...)`, `PharmacyInventoryValuationRoute(locationId:)` |
| Landing | `pharmacy_head` → `PharmacyHeadDashboardRoute` in `lib/src/routing/initial_route_for_role.dart` |
| Menu | `pharmacyHeadExtraMenu` in `lib/src/ui/home/account_types.dart`, wired for `pharmacy_head` in `home_screen.dart` |

**Checklist (frontend)**

- [x] Head dashboard with executive KPIs, sales/profit charts, and per-store inventory worth
- [x] Reports hub launcher
- [x] Sales breakdown with `groupBy` selector, totals footer, drill-down
- [x] Paginated sales detail with FIFO cost and profit
- [x] Inventory valuation by store and batch with expiry filter
- [x] Head-only access gate and landing route
- [ ] Wire to live endpoints once the backend ships (client currently degrades to empty states on error)

The client tolerates endpoints returning either a bare list/object or a `{ data: ... }` / `{ items: ... }` wrapper, and parses Prisma `Decimal` objects. Until the endpoints exist, screens show empty/zero states rather than crashing.
