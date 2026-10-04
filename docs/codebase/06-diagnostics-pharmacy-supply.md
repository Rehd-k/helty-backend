# Diagnostics, pharmacy, and supply

Two ideas show up in every department here.

**The clinician’s request** is what the encounter and the invoice know about (`LabRequest`, `RadiologyOrder`, `MedicationOrder` / `MedicationRequest`).

**The department’s work record** is what the bench, the scanner, or the dispensary actually does (`LabOrder`, radiology schedule/procedure/report, settled invoice drug line).

Free-text `LabReport` and `RadiologyReport` are a third, older document. They do not move order status and they are not built from structured results.

## Laboratory

### Catalog

`src/modules/lab`. Tests live in categories. Each test has numbered versions. Each version has fields (`LabTestFieldType`, reference ranges). Orders point at an **active version**, so later catalog edits do not rewrite old work.

| Path | Role |
|---|---|
| `/lab/categories` | Category CRUD |
| `/lab/tests` and `/lab/tests/:testId/version` | Tests and versions |
| `/lab/test-fields` | Fields on a version |
| `/lab/antibiotics`, `/lab/ast-result-options` | Culture and sensitivity setup |
| `GET /lab/config/export`, `POST /lab/config/import` | Super admin catalog transfer. This is why the JSON body limit is 10mb |

Deleting a test cascades versions, fields, results, samples, lines, and any order left with no lines.

### The clinician’s request

`POST /lab-requests` needs an `encounterId`, or a `pregnancyId` that resolves to an encounter. The patient must match. Status starts at `REQUESTED`. If `serviceId` is sent, a laboratory service line is added to the invoice (or an antenatal package line when one applies).

`LabRequestStatus`: `REQUESTED` → `COLLECTED` → `COMPLETED`, or `CANCELLED`.

Cancel and delete are blocked once a `LabOrder` exists for the invoice item, or once the request is `COMPLETED`. Cancel removes the unpaid billable line.

### The bench order

`POST /lab/orders` creates a `LabOrder` of active test versions against that invoice item. Creation sets matching requests to `COLLECTED` and copies the patient’s current admission and ward onto the order.

`LabOrderStatus`:

| Status | How it is reached |
|---|---|
| `PENDING` | Created |
| `SAMPLE_COLLECTED` | First `POST /lab/samples`. One sample per order line. `sampleCollectedAt` is stored |
| `PROCESSING` | On the enum. No service sets it |
| `COMPLETED` | Every required field on every line has a result, or a manual `PATCH /lab/orders/:id` |
| `VERIFIED` | Manual patch. Sets `verifiedAt` and completes the linked request |

`POST /lab/results` and `POST /lab/results/batch` upsert field values. The invoice line must be paid, or the patient must be on an active admission. Saving a result **settles** the invoice line. Numeric results are flagged `LOW` or `HIGH` against the reference range.

Antibiotic susceptibility is optional per line (`astRequested`). `POST /lab/ast-results/batch` is allowed only on flagged lines and also settles the invoice line. It does not by itself complete the order.

`GET /lab/investigations` and `.../summary` are a read model over **billed lab requests**, not over `LabOrder`.

`GET /patient/lab-reports` is the patient app’s view of these orders. See [Patient portal](./08-patient-portal.md).

## Radiology

`src/modules/radiology`. `POST /radiology/orders` creates the order and its items. An encounter plus `serviceId` bills a radiology service, or an antenatal package line. Linking an existing invoice line requires invoice id, item id, and service id together.

Item status (`RadiologyRequestStatus`):

```
PENDING → SCHEDULED → IN_PROGRESS or COMPLETED → REPORTED
                 └──────────────────┘
any item may be CANCELLED while removal is still allowed
```

- Schedule (`POST .../schedule`) only from `PENDING`.
- Procedure (`POST .../procedure`) from `PENDING` or `SCHEDULED`. No `endTime` means `IN_PROGRESS`. An `endTime` means `COMPLETED`.
- Study report (`POST .../report`) sets `REPORTED`. Severity is `NORMAL`, `ABNORMAL`, or `CRITICAL`.
- Images upload to `POST .../images` and download at `GET /radiology/images/:id/file`.

The parent order status is derived, not chosen:

- Any item `IN_PROGRESS` → order `IN_PROGRESS`.
- Every non-cancelled item finished → `REPORTED` if any item is reported, otherwise `COMPLETED`.
- Otherwise `SCHEDULED` if any item is scheduled, else `PENDING`.
- All items cancelled → order `CANCELLED`.

An item cannot be removed once a procedure or report exists, or once it is `IN_PROGRESS`, `COMPLETED`, or `REPORTED`. Cancel drops the billable line only while removal is still allowed.

Machines (`/radiology/machines`) are read-only in this API. Worklist, dashboard, investigations, and patient history are GET routes under `/radiology`.

`/radiology-reports` is the free-text document, same shape as `/lab-reports`. The signed study is `RadiologyStudyReport` under the order item, not this module.

Priority is `ROUTINE`, `URGENT`, or `EMERGENCY`. Modality is the `RadiologyModality` enum.

## Pharmacy

`src/modules/pharmacy` owns the catalog, locations, batches, purchasing, transfers, refill review, and dashboards. It does not own the button that takes stock off the shelf. That button is settling an invoice drug line. See [Billing](./05-billing-and-finance.md).

### Catalog and locations

- `/pharmacy/drugs` — CRUD. Delete is soft.
- `/pharmacy/drug-prices` — price per ward.
- `/pharmacy/drug-interactions` — pairs of drugs.
- `/pharmacy/manufacturers` and `/pharmacy/suppliers`.
- `/pharmacy/locations` — `STORE` or `DISPENSARY`.
- `GET /pharmacy/locations/drug/:drugId/quantity` — quantity by location.

### Stock in

Purchase orders: `DRAFT` → `APPROVED` → `RECEIVED`, or `CANCELLED`. A received or cancelled order cannot change status. `POST /pharmacy/goods-receipts` creates batches at a location and syncs ward prices from cost. Receipt is refused for a `CANCELLED` order. It does not require the order to be `APPROVED` first. Any receipt sets the order to `RECEIVED`.

Transfers: `PENDING` → `APPROVED` → `COMPLETED`. `POST /pharmacy/stock-transfers` runs all three steps in one call. Complete decrements the source batch and creates a batch at the destination. Locations must differ. The batch must sit at the source and have enough quantity.

`PATCH /pharmacy/batches/:id/quantity-correction` adjusts remaining quantity. A batch cannot be deleted after it has movements, transfers, or dispensations.

### Prescribe, request, bill, dispense

```
Doctor                         Nurse                         Pharmacy                        Cashier / invoice
POST /medication-orders        POST /medication-requests     POST /medication-requests/bill  PATCH /invoice-drugs/.../items/...
status Prescribed              (inpatients only)             REQUESTED → BILLED              settled: true
                               status REQUESTED              order → Pending Dispense        FIFO stock out
                                                                                              request → DISPENSED
                                                                                              order → Dispensed
```

`MedicationOrder.status` is a string, default `Prescribed`. The values the services write are `Prescribed`, `Pending Dispense`, `Dispensed`, and `Cancelled`. Administration lifecycle is separate: `ACTIVE` or `STOPPED`.

`POST /medication-orders` cannot target a cancelled encounter. The drug must exist in `Drug`.

- **Outpatients.** The order creates a `MedicationRequest` immediately. Nurses cannot create another request for an outpatient.
- **Inpatients.** No request is created with the order. A nurse posts `POST /medication-requests` for a quantity. If the order has an `admissionId`, a dose schedule is created. Nurses chart administrations on the admission; a `GIVEN` dose can also bill a settled drug line. See [Inpatient](./07-inpatient-and-specialties.md).

`POST /medication-requests/bill` turns `REQUESTED` lines into drug invoice lines (or antenatal package drug lines), sets them `BILLED`, and moves the order to `Pending Dispense` unless it is already `Dispensed` or `Cancelled`.

`GET /pharmacy/medication-requests` is that queue, default status `REQUESTED`.

Cancel rules:

- A `REQUESTED` line can be cancelled by the prescriber, the requesting nurse, or pharmacy.
- A `BILLED` line can be changed or cancelled by the prescriber only while it is unpaid, unsettled, and unallocated.
- Cancelling the last billed request moves the order from `Pending Dispense` back to `Prescribed`.
- Delete of the order is blocked when administrations exist, when any request is `BILLED` or `DISPENSED`, or when the order is already `Dispensed`. `Cancelled` removes the invoice line. The drug cannot be changed after `Dispensed`.

`MedicationRequestStatus`: `REQUESTED` → `BILLED` → `DISPENSED`, or `CANCELLED`.

### Prescriptions and refills

`/prescriptions` is a chart document: patient, optional encounter, date range, doctor, type (`OUTPATIENT` or `INPATIENT`), status string. The service does not enforce `PrescriptionStatus` unless the client sends it. Creating one stamps the patient’s current admission and ward.

When a medication order is fully dispensed, `medication-order-prescription.sync` copies lines onto `PrescriptionItem` (`quantityPrescribed`, `quantityDispensed`). The patient app’s dose calendar reads those dispensed outpatient prescriptions.

Refills (`PrescriptionRefillRequest`):

`PENDING` → `APPROVED` or `REJECTED` (a note is required to reject) → `FULFILLED`.

`POST /pharmacy/refill-requests/:id/bill` is allowed only when the request is `APPROVED`, not yet billed, the prescription is still active, and `refillsAllowed` is greater than zero. Settling that drug line fulfills the refill. The enum includes `CANCELLED`; this service does not set it.

`GET /medication-orders/:id/dose-schedule` is the inpatient schedule. The schedule module has no controller of its own. Status is computed: `NOT_STARTED`, `ACTIVE`, `DUE_SOON`, `OVERDUE`, `EXPIRED`, `STOPPED`. A job every five minutes refreshes it and raises admission alerts (`MEDICATION_DOSE_DUE`, `MEDICATION_DOSE_OVERDUE`, `MEDICATION_COURSE_EXPIRED`). Doctors extend a finished course with `POST /medication-orders/:id/beyond-duration-consent`.

### Dashboards

`/pharmacy/dashboard/*` and `/pharmacy/reports/*` are read models: sales, valuation, top drugs, purchase orders, insurance claims, productivity, interactions, controlled substances, and dispense history. Dispense history reads settled invoice drug lines. The dashboard also counts `Dispensation` rows (`DRAFT`, `COMPLETED`, `REVERSED`). No controller creates those rows.

## Store

`src/modules/store` is general supplies and clinical consumables. It is not the drug catalog.

`/store/categories`, `/store/items`, `/store/locations`, `/store/stock` are the supply book. Movements:

- `POST /store/movements/issue`
- `POST /store/movements/receive`
- `POST /store/movements/transfer`

Issue and transfer require enough quantity.

Consumables (`/store/consumables`) have batches at a store location. `Consumable.isBillable` decides the path:

- Billable items are added as invoice lines (which decrement stock immediately).
- Non-billable use is `POST /store/consumables/usage` with source `NURSING`, `ENCOUNTER_PROCEDURE`, or `THEATRE`. Returns are `POST /store/consumables/usage/:usageEventId/return`.

Usage may name an encounter and an admission; both must belong to the patient. That link is for the chart. It does not create an invoice line.

## Purchases

`src/modules/purchases` is procurement for non-drug `PurchaseItem` rows. Drug procurement stays on `/pharmacy/purchase-orders`. The tables are prefixed `Purchases*` or named `PurchaseItem` so they do not collide with pharmacy `PurchaseOrder`.

The shape mirrors pharmacy: items, manufacturers, suppliers, locations, batches, purchase orders, goods receipts, stock transfers, dashboards.

Differences that matter:

- PO status is `DRAFT`, `PENDING`, `APPROVED`, `COMPLETED`, `CANCELLED`. A goods receipt sets the PO to `COMPLETED` (pharmacy sets `RECEIVED`).
- Approval of a purchases PO requires `PURCHASES_HEAD`, `SUPER_ADMIN`, or `CMD`.
- Requisitions: `POST /purchases/requisitions`, then `approve`, `reject`, or `convert-to-po`. Only `APPROVED` converts, and that sets the requisition to `FULFILLED`. Lines are `DRUG`, `CONSUMABLE`, or `PURCHASE_ITEM`. Departments include pharmacy, store, lab, and radiology. Priority is `NORMAL`, `URGENT`, or `CRITICAL`.
- Transfer create stays `PENDING` until approve and complete. Pharmacy’s create endpoint completes immediately; this one does not.

`PurchasesMovementReferenceType` includes `INVOICE_ITEM`, so a stock movement can point at a billed purchase line. This module does not create encounters or dispense drugs.
