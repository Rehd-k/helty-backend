# Purchases Department — Backend Specification

This document describes the API, database schema, and workflows required to support the **Purchases** department in the Helty hospital system. The Flutter client mirrors the existing **Pharmacy** module (`/pharmacy/*`) at a new prefix **`/purchases/*`**.

## Overview

- **Separate supplier master** — Purchases suppliers are **not** shared with Pharmacy suppliers.
- **Cross-department requisitions** — Any department (Pharmacy, Store, Lab, etc.) can send requisitions; Purchases staff review them in **Requisition History**.
- **Item catalog** — Simplified vs Pharmacy drugs: single `itemName`, no clinical fields (strength, ATC, controlled flags, ward pricing).
- **Optional batch dates** — `manufacturingDate` and `expiryDate` on batches are optional (nullable).

**Reference implementation:** Mirror the existing NestJS + Prisma pharmacy module (controllers, services, DTOs, guards, migrations).

---

## Architecture

```
[Pharmacy / Store / Lab / …] ──POST /purchases/requisitions──► [Purchases]
                                                                    │
                    ┌───────────────────────────────────────────────┘
                    ▼
            Requisition (PENDING)
                    │ approve / reject / convert-to-po
                    ▼
            PurchaseOrder ──► GoodsReceipt ──► PurchaseItemBatch ──► Inventory
                    │
                    └── StockTransfer ──► Transfer History
```

---

## Database Schema (Prisma-style)

### Enums

```prisma
enum PurchasesLocationType { STORE WAREHOUSE DEPARTMENT COLD_ROOM }
enum PurchaseOrderStatus { DRAFT PENDING APPROVED COMPLETED CANCELLED }
enum StockTransferStatus { PENDING APPROVED IN_TRANSIT COMPLETED REJECTED }
enum RequisitionStatus { PENDING APPROVED REJECTED FULFILLED CANCELLED }
enum RequestingDepartment { PHARMACY STORE PURCHASES LAB RADIOLOGY OTHER }
enum InventoryMovementType { PURCHASE TRANSFER_OUT TRANSFER_IN ADJUSTMENT RETURN EXPIRY_WRITEOFF }
```

### Core entities

#### `PurchaseItem` (mirrors `Drug`, simplified)

| Field | Type | Notes |
|-------|------|-------|
| id | String @id | cuid/uuid |
| itemName | String | **Required** — replaces genericName + brandName |
| sku | String? | |
| category | String? | |
| description | String? | |
| manufacturerId | String? | FK → PurchasesManufacturer |
| unitOfMeasure | String? | e.g. box, piece |
| reorderLevel | Int @default(0) | |
| reorderQuantity | Int @default(0) | |
| createdAt / updatedAt | DateTime | |

**Removed vs Drug:** genericName, brandName, strength, dosageForm, route, therapeuticClass, atcCode, isControlled, isRefrigerated, isHighAlert, maxDailyDose, DrugPrice/ward pricing.

#### `PurchaseItemBatch` (mirrors `DrugBatch`)

| Field | Type | Notes |
|-------|------|-------|
| id | String @id | |
| itemId | String | FK → PurchaseItem |
| purchaseOrderId | String? | |
| supplierId | String? | FK → PurchasesSupplier |
| batchNumber | String? | |
| manufacturingDate | DateTime? | **Optional** |
| expiryDate | DateTime? | **Optional** |
| quantityReceived | Int | |
| quantityRemaining | Int? | |
| costPrice | Decimal? | |
| sellingPrice | Decimal? | Optional; purchases may omit |
| fromLocationId / toLocationId | String? | FK → PurchasesLocation |
| grnId | String? | FK → GoodsReceipt |
| createdAt | DateTime | |

#### `PurchasesSupplier` (separate from Pharmacy `Supplier`)

Same fields as pharmacy Supplier: `name`, `licenseNumber`, `contactInfo` (JSON), `creditTerms`, `leadTimeDays`, `rating`, `isBlacklisted`.

**Do not migrate** pharmacy suppliers into this table.

#### `PurchasesManufacturer`

Same as pharmacy `Manufacturer`: `name`, `country`, `contactInfo`.

#### `PurchasesLocation`

Same pattern as `PharmacyLocation`: `name`, `locationType` (STORE | WAREHOUSE | DEPARTMENT | COLD_ROOM), `description`, `staffId`, `isActive`.

#### `PurchaseOrder` / `PurchaseOrderLine`

Header: `supplierId`, `status`, `totalAmount`, `createdById`, timestamps.

**Add line items** (recommended; client currently sends header-only like pharmacy):

| PurchaseOrderLine | |
|-------------------|---|
| purchaseOrderId | FK |
| itemId | FK |
| quantity | Int |
| unitCost | Decimal |
| lineTotal | Decimal |

#### `GoodsReceipt`

`purchaseOrderId`, `receivedById`, `receivedAt`, `notes` — same as pharmacy.

#### `StockTransfer` / `StockTransferLine`

Header: `fromLocationId`, `toLocationId`, `status`, `requestedById`, `approvedById`, `createdAt`, `completedAt`.

Lines (CreateStockTransferDto): `{ batchId, quantity }[]`.

Response should include nested `item`, `fromLocation`, `toLocation`, `requestedByName` for Transfer History UI.

#### `Requisition` / `RequisitionLine` (**new**)

```prisma
model Requisition {
  id                    String @id
  requestingDepartment  RequestingDepartment
  requestedById         String
  status                RequisitionStatus @default(PENDING)
  notes                 String?
  lines                 RequisitionLine[]
  createdAt             DateTime
  updatedAt             DateTime
}

model RequisitionLine {
  id             String @id
  requisitionId  String
  itemType       String   // Drug | Consumable | PurchaseItem
  itemId         String
  itemName       String
  quantity       Int
  priority       String   // Normal | Urgent | Critical
  notes          String?
}
```

#### `InventoryMovement`

Audit ledger: `batchId`, `itemId`, `fromLocationId`, `toLocationId`, `movementType`, `quantity`, `referenceType`, `referenceId`.

---

## REST API Catalog

Base path: **`/purchases`**

Pagination convention (match pharmacy/store):

- Query: `page`, `pageSize`, `sortBy`, `sortOrder` (`asc`|`desc`), `search` / `q`
- Batches also support: `limit`, `skip`
- Response: `{ data: [], total, page, pageSize }` or `{ items, totalCount }`

Errors: `{ statusCode, message, error? }` via shared exception filter.

### Items — `/purchases/items`

| Method | Path | Body / Query |
|--------|------|--------------|
| GET | `/items` | SearchPurchaseItemParams: itemName, search, manufacturerId, supplierId, manufacturing/expiry date ranges, inStock, lowStock, expiringSoon, page, pageSize |
| GET | `/items/:id` | |
| POST | `/items` | PurchaseItem JSON |
| PATCH | `/items/:id` | Partial update |
| DELETE | `/items/:id` | Soft or hard delete |

**Example POST body:**

```json
{
  "itemName": "Surgical Masks (Box of 50)",
  "sku": "SM-50",
  "category": "Medical Supplies",
  "manufacturerId": "mfg_123",
  "unitOfMeasure": "box",
  "reorderLevel": 10,
  "reorderQuantity": 50
}
```

### Manufacturers — `/purchases/manufacturers`

Standard CRUD (mirror `/pharmacy/manufacturers`).

### Suppliers — `/purchases/suppliers`

Standard CRUD (mirror `/pharmacy/suppliers`). **Separate table** from pharmacy.

### Batches — `/purchases/batches`

| Method | Path | Notes |
|--------|------|-------|
| GET | `/batches` | limit, skip, sortBy, filters (supplierId, itemId, date ranges) |
| POST | `/batches` | manufacturingDate, expiryDate **optional** |
| PATCH | `/batches/:id` | |
| PATCH | `/batches/:id/quantity-correction` | `{ quantityReceived, quantityRemaining }` — purchases_head + 24h rule (mirror pharmacy) |
| DELETE | `/batches/:id` | |

### Purchase orders — `/purchases/purchase-orders`

CRUD; status workflow: DRAFT → PENDING → APPROVED → COMPLETED | CANCELLED.

### Goods receipts — `/purchases/goods-receipts`

POST creates receipt; optionally creates/links batches and updates stock.

### Stock transfers — `/purchases/stock-transfers`

| Method | Path | Body |
|--------|------|------|
| GET | `/stock-transfers` | filters: status, fromDate, toDate, itemId |
| GET | `/stock-transfers/history` | TransferHistoryQuery: fromDate, toDate, itemId?, status?, skip, take |
| POST | `/stock-transfers` | CreateStockTransferDto |
| PATCH | `/stock-transfers/:id` | status updates, approve |

**CreateStockTransferDto:**

```json
{
  "fromLocationId": "loc_1",
  "toLocationId": "loc_2",
  "items": [{ "batchId": "batch_1", "quantity": 10 }]
}
```

### Locations — `/purchases/locations`

CRUD + `GET /locations/item/:itemId/quantity` → `[{ locationName, quantity }]`.

### Requisitions — `/purchases/requisitions` (**new**)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/requisitions` | List all (Purchases inbox). Filters: status, requestingDepartment, fromDate, toDate |
| GET | `/requisitions/:id` | Detail with lines |
| POST | `/requisitions` | Create from any department |
| POST | `/requisitions/:id/approve` | PURCHASES_HEAD |
| POST | `/requisitions/:id/reject` | body: `{ reason? }` |
| POST | `/requisitions/:id/convert-to-po` | Creates PurchaseOrder from lines |

**POST /requisitions body (used by Pharmacy Create Requisition):**

```json
{
  "requestingDepartment": "PHARMACY",
  "requestedById": "staff_abc",
  "notes": "Urgent restock",
  "lines": [
    {
      "itemType": "Drug",
      "itemId": "drug_123",
      "itemName": "Amoxicillin 250mg",
      "quantity": 100,
      "priority": "Urgent",
      "notes": "Low stock"
    }
  ]
}
```

**Requisition state machine:**

```
PENDING ──approve──► APPROVED ──convert-to-po / fulfill──► FULFILLED
   │                      │
   └──reject──► REJECTED  └──cancel──► CANCELLED
```

- Requisition does **not** deduct stock until PO/GRN completes.
- `convert-to-po` maps lines to PurchaseOrderLine(s) for the purchases catalog or creates placeholder PO for external procurement.

### Dashboard — `/purchases/dashboard/*`

| GET | Path | Returns |
|-----|------|---------|
| `/dashboard/summary` | fromDate, toDate, storeId? | pendingRequisitions, approvedRequisitions, openPurchaseOrders, completedPurchaseOrders, totalPurchaseValue, inventoryValue, lowStockCount, outOfStockCount, nearExpiryCount, expiredCount |
| `/dashboard/orders-status` | | `[{ status, count, percentage? }]` |
| `/dashboard/top-items` | | `[{ itemName, quantityPurchased, totalCost, avgCostPrice, stockRemaining }]` |
| `/dashboard/charts/purchase-value` | | `[{ label, purchaseValue, orderCount }]` |
| `/dashboard/supplier-performance` | | `[{ supplierName, orderCount, onTimeDeliveries, avgLeadTimeDays }]` |

---

## Auth / RBAC

New staff roles (register via `/staff`):

| Role | Account type | Permissions |
|------|--------------|-------------|
| PURCHASES_STORE | purchases | CRUD items, batches, transfers, suppliers; view requisitions |
| PURCHASES_STAFF | purchases | Same as PURCHASES_STORE (client-facing role name) |
| PURCHASES_HEAD | purchases | All store permissions + approve/reject requisitions, quantity correction, PO approval |

Route guards: mirror `@Roles('PHARMACY_HEAD')` patterns with `PURCHASES_HEAD` / `PURCHASES_STORE` / `PURCHASES_STAFF`.

Cross-department: `POST /purchases/requisitions` allowed for authenticated staff from any department (PHARMACY_STORE, STOREKEEPER, etc.).

---

## Pharmacy vs Purchases endpoint map

| Pharmacy | Purchases |
|----------|-----------|
| GET /pharmacy/drugs | GET /purchases/items |
| GET /pharmacy/batches | GET /purchases/batches |
| GET /pharmacy/suppliers | GET /purchases/suppliers (**separate DB**) |
| GET /pharmacy/manufacturers | GET /purchases/manufacturers |
| GET /pharmacy/locations | GET /purchases/locations |
| GET /pharmacy/stock-transfers | GET /purchases/stock-transfers |
| GET /pharmacy/purchase-orders | GET /purchases/purchase-orders |
| GET /pharmacy/goods-receipts | GET /purchases/goods-receipts |
| GET /pharmacy/dashboard/* | GET /purchases/dashboard/* |
| — | GET/POST /purchases/requisitions (+ approve/reject/convert) |
| GET /pharmacy/dashboard/dispense-history | GET /purchases/stock-transfers/history |

---

## Aggregation hints (dashboard)

- **pendingRequisitions:** `COUNT(Requisition WHERE status = PENDING AND createdAt BETWEEN ...)`
- **totalPurchaseValue:** `SUM(PurchaseItemBatch.quantityReceived * costPrice)` or PO totals in range
- **lowStockCount:** items where aggregated batch quantity ≤ reorderLevel
- **nearExpiryCount:** batches with expiryDate within 90 days (ignore null expiry)
- **top-items:** group batches/PO lines by itemId, order by quantity DESC

---

## Migration notes

1. Create new tables; **do not** alter pharmacy tables.
2. Seed optional demo PurchasesLocation (main warehouse).
3. No data migration from pharmacy suppliers or drugs.
4. Add `RequestingDepartment` enum values as new departments onboard.

---

## Client files (Flutter reference)

| Area | Path |
|------|------|
| Models | `lib/src/purchases/models/purchases_model.dart` |
| Dashboard models | `lib/src/purchases/models/purchases_dashboard_model.dart` |
| API service | `lib/src/purchases/services/purchases_service.dart` |
| Dashboard service | `lib/src/purchases/services/purchases_dashboard_service.dart` |
| Requisition sender (Pharmacy) | `lib/src/pharmacy/ui/create_requisition.dart` → `POST /purchases/requisitions` |

---

## Acceptance checklist

- [ ] All CRUD endpoints mirror pharmacy pagination and error shapes
- [ ] Batch create accepts null manufacturingDate and expiryDate
- [ ] Separate PurchasesSupplier table; no FK to pharmacy suppliers
- [ ] Requisition CRUD + approve/reject/convert-to-po with RBAC
- [ ] GET /requisitions returns requisitions from all requestingDepartment values
- [ ] Stock transfer history endpoint returns COMPLETED transfers with item/location names
- [ ] Dashboard endpoints return fields matching `PurchasesDashboardSummary` and related DTOs
- [ ] Pharmacy Create Requisition successfully creates requisition visible in Purchases Requisition History
- [ ] Integration tests parity with existing `/pharmacy` test suite structure

---

## Example error response

```json
{
  "statusCode": 400,
  "message": "Item name is required",
  "error": "Bad Request"
}
```

---

*Generated for backend team — implement by cloning the pharmacy NestJS module and applying the field/menu differences above.*
