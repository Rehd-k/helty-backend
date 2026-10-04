# Billing and finance

Every charge in the hospital becomes an `InvoiceItem` on an `Invoice`. Departments do not keep their own bills. Lab, radiology, pharmacy, dialysis, theatre, and nursing all call `InvoiceService` or the drug, consumable, and purchase services it exports.

Code lives in `src/modules/invoice`. Related modules: `payment`, `hmo`, `discount`, `receivables`, `bank`, `service`, `clinical-package`, `accounts`, `billing-analytics`.

## The open invoice

`POST /invoices` creates a `PENDING` invoice with a generated `invoiceID`, **or** returns the patient’s existing `PENDING` or `PARTIALLY_PAID` invoice after updating its header (staff, encounter, consulting room, vitals). After an invoice is `PAID`, the next create starts a new one.

A nightly job (`invoice-consolidation.scheduler.ts`, 23:59 hospital time) merges extra open invoices for the same patient into the oldest. Set `INVOICE_CONSOLIDATION_ENABLED=false` to skip it.

`InvoiceStatus`:

| Status | When |
|---|---|
| `DELETED` | Left as deleted. Soft-delete sets this. |
| `PAID` | `totalAmount > 0` and cash plus non-reversed coverage is at least the total |
| `PARTIALLY_PAID` | Some cash or some coverage, but not enough to pay the total |
| `PENDING` | Nothing paid and nothing covered |

`totalAmount` is the sum of line totals. `amountPaid` is cash and wallet on `InvoicePayment` only. Coverage is **not** added to `amountPaid`. Both count toward `PAID`.

Lines cannot be added to a `PAID` invoice.

## Lines

`POST /invoices/:id/items` adds one line. A line is a service, a drug, a billable consumable, or a purchase item. It cannot be more than one of the stock types at once.

| Line | Price | Stock |
|---|---|---|
| Service | `HmoServicePrice.fullCost` when the patient has that HMO and a tariff row exists, otherwise `Service.cost` | None |
| Drug | Ward price for the drug, with the ward’s `drugPricePercentage` | Held until the line is settled (dispense) |
| Billable consumable | Catalog price | FIFO out of the given store location immediately |
| Purchase item | Selling price | FIFO out of the given purchases location immediately |

Recurring daily lines accrue by usage-segment days (`InvoiceItemUsageSegment`), not by quantity. Pause and resume them with `POST /invoices/:id/items/:itemId/pause` and `.../resume`.

`POST /invoices/:id/split` moves selected lines onto a new invoice.

Category names are part of the business rules. Billing checks these `ServiceCategory.name` values:

- `Consultations & Reviews` — outpatient visit credit
- `Laboratory` or `Laboratory Tests`
- `Radiology & Imaging`
- `Dialysis` or `Dialysis Services`
- Procedure categories used from encounter procedures: `Therapy & Rehabilitation`, `Physiotherapy`, `Surgical Procedures`, `General Procedures`, `Cardiology Procedures`, `Orthopaedics`

The catalog itself is `/services` and `/service-categories`. The code field on `Service` is `searviceCode`.

## Consultation credit

When an invoice becomes `PAID`, unsettled lines in `Consultations & Reviews` receive:

- `consultationCreditExpiresAt` = 14 days after payment
- a visit counter, maximum 2 (`consultationVisitsConsumed`)

The nursing queue and `POST /encounters/outpatient/start` consume that credit. Completing the outpatient encounter settles the line. Reversing HMO cover that drops the invoice back to unpaid clears unused credit.

`GET /patients/:id/consultation-credits` lists them. `GET /invoices/paid-without-encounter` lists paid invoices that are ready for a visit.

## Inpatient credit

An admission in `ACTIVE` lets lab, radiology, dialysis, and pharmacy consume a line before the invoice is `PAID`. Outpatients must be paid first. This check is `assertPaidInvoiceItemConsumable` and the drug-dispense equivalent. It is per line, not a separate account.

## Payments

Record money with either:

- `POST /invoices/:id/payments`
- `POST /invoices/payments` with `invoiceId` in the body

Both call `InvoiceService`. The amount must be greater than zero and cannot exceed `totalAmount − covered − amountPaid`.

`InvoicePaymentSource`: `WALLET`, `CASH`, `TRANSFER`, `CARD`, `INSURANCE`, `WAIVER`.

`WALLET` debits `PatientWallet` and writes a `DEBIT` `WalletTransaction`. Deposits are `POST /invoices/wallets/:patientId/deposits`. Adjustments are `POST /invoices/wallets/:patientId/adjustments`.

A bank account number on the payment must match `Bank.accountNumber`. Banks are `/banks`. Delete is refused while any payment still points at the bank.

`POST /invoices/:id/allocate-item-payments` records a payment and applies it to chosen lines. When the invoice becomes `PAID`, allocations are rebuilt: invoice-level coverage is spread across lines by line total, each line’s cash due is `line total − coverage`, and payments are applied in time order into `InvoiceItemPayment`.

`DELETE /invoices/payments/:id` voids a payment: reverses allocations and `amountPaid`, puts a wallet debit back, and recalculates status. `PATCH` on a payment changes metadata only (`reference`, `notes`, `paidAt`, `receivedById`, `bankId`).

The `/payments` controller is the legacy `Payment` table. Writes return 410. Reads remain for old rows.

## HMO

Master data is `/hmos`: name, `defaultCoveragePercent` (0–100), and per-service prices. Each `HmoServicePrice` stores `fullCost`, `hmoPays`, and `patientPays`. Those two shares must add up to `fullCost`. The invoice uses `fullCost` as the unit price. The percent on the price row is not what `POST .../coverages/hmo` applies.

Applying cover:

`POST /invoices/:invoiceId/coverages/hmo`

- The patient must have `hmoId`.
- Only one non-reversed HMO coverage may exist on the invoice.
- Percent is the request body, otherwise `Hmo.defaultCoveragePercent`.
- Amount is `totalAmount × percent / 100`, capped at the outstanding balance.
- The row is `InvoiceCoverage` kind `HMO`, mode `PERCENT`, scope `INVOICE`, status `APPLIED`.

That can mark the invoice `PAID` with `amountPaid` still zero.

`DELETE /invoices/:invoiceId/coverages/:coverageId` reverses an applied coverage within 24 hours, including after it paid the invoice. `SETTLED` coverage cannot be reversed.

Patients registered to an HMO are `GET /hmos/:id/patients`. An HMO cannot be deleted while any patient still points at it.

## Discounts

`/discount-policies` holds policies owned by a staff member. Create and update are limited to CMD, CMAC, and super admin. `DiscountReason` is `CMD`, `CMAC`, or `SUPER_ADMIN`. Mode is `PERCENT` or `FIXED`. Value must be positive. Percent cannot exceed 100.

`POST /invoices/:invoiceId/coverages/discount` applies an **active** policy to the whole invoice or to `itemIds`. Several discounts can stack with HMO cover until the outstanding balance is zero. The coverage’s payer is the policy owner. That owner later shows up in receivables.

A policy cannot be deleted while a non-reversed coverage still references it. Deactivate it instead.

## Receivables

Coverage stays `APPLIED` until someone records that the insurer or the discount owner paid the hospital.

`POST /receivables/remittances` creates `CoverageRemittance` and lines. Each line amount must equal the coverage amount. The coverage must still be `APPLIED` and must belong to that HMO or staff payer. Those rows become `SETTLED`. This does not increase `amountPaid`.

Lists and statements:

- `GET /receivables/hmo` and `GET /receivables/hmo/:hmoId/statement`
- `GET /receivables/discount` and `GET /receivables/discount/owner/:staffId/statement`
- Analytics under `/receivables/analytics/...`

`InsuranceClaim` (`POST /invoices/:id/insurance-claims`) is a separate tracking row with a string status, default `PENDING`. It does not change `Invoice.status`. A payment whose source is `INSURANCE` does.

## Refunds and returns

These are different operations.

**Return** (`POST /invoice-drugs/.../return`, `POST /invoice-consumables/.../return`, `POST /invoice-purchases/.../return`) is allowed on an unpaid invoice and an unpaid line. It restocks and shrinks or deletes the line. It is not cash movement.

**Refund** is an approval workflow:

1. `POST /invoices/:invoiceId/items/:itemId/refund-requests` creates `InvoiceItemRefundRequest` in `pending`.
2. The line is rejected when it is a recurring daily line, already settled, has used consultation credit, has a lab order, a dialysis session, a performed or reported radiology study, a dispensed drug, or any medication administration. Only one pending request per line.
3. The requester, account head, CMD, or super admin can cancel it while pending.
4. Account head or billing head approves or rejects at `POST /accounts/refund-requests/:id/approve` and `.../reject`.
5. Approval reverses that line’s payments, reduces `amountPaid`, credits the wallet when the original source was `WALLET`, reverses coverages, releases consumable or purchase stock, removes the line, writes `InvoiceRefund` when cash moved, and recalculates the invoice.

Soft-delete (`POST /invoices/soft-delete`, billing head or account head) marks a non-pending invoice `DELETED`, drops pending department work, and credits wallet payments back. Hard `DELETE /invoices/:id` is the path for invoices that were never paid.

## Drug lines and dispensing

`/invoice-drugs` is the pharmacy’s view of invoices that contain drugs. Settling a line is dispensing:

`PATCH /invoice-drugs/:invoiceId/items/:itemId` with `settled: true` and a pharmacy `locationId`.

That walks batches FIFO at the location, writes an `InventoryMovement` of type `DISPENSE` and a `DispenseBatchAllocation`, and stamps who dispensed it and when. The linked medication request becomes `DISPENSED`. When the order has no `BILLED` requests left, the order becomes `Dispensed` and a prescription snapshot is synced.

Outpatients need a paid invoice. An `ACTIVE` admission may be dispensed on credit. A settled line cannot be substituted. Unpaid returns go back to the first pharmacy location whose name contains “dispensary”.

The full prescribe → bill → dispense path is in [Diagnostics and pharmacy](./06-diagnostics-pharmacy-supply.md).

## Clinical packages

`/clinical-packages` is a named bundle of services and drugs. Only one package may have `isDefaultAntenatal`. Obstetrics and invoice helpers expand that package onto bills. Lines created that way store `clinicalPackageItemId` and skip the usual category check when a department consumes them.

## Accounts back office

`src/modules/accounts` does not take patient payments. It reports and controls them.

| Area | Routes | What it stores |
|---|---|---|
| Dashboard | `GET /accounts/dashboard` | KPIs from billing analytics |
| Reports | `/accounts/reports/...` | Collections, aging, efficiency, revenue, profit and loss, cash flow, budget variance, period comparison |
| Audit | `/accounts/audit/...` | Finance audit logs, compliance checklist, invoice changes, leak detection, staff activity |
| Wallets | `GET /accounts/wallets/summary` | Float sitting in patient wallets |
| Reconciliation | `/accounts/reconciliation/daily-cash` and `.../bank` | Counted cash vs expected, book vs statement |
| Approvals | `/accounts/approvals` | `FinanceApproval` for refund, write-off, journal adjustment, other |
| Periods | `POST /accounts/periods/:id/close` | `FiscalPeriod` open → closed |
| Ledger | `/accounts/journal-entries`, `/accounts/chart-of-accounts` | Double entry. A journal needs two active accounts and a unique reference. Debit increases the debit account balance; credit decreases the credit account balance |
| Refunds | `/accounts/refund-requests` | The approval step described above |

`billing-analytics` (`/billing/analytics/...`) is read-only. Revenue is non-deleted invoice lines. “Overdue” means an open invoice whose `createdAt` is more than 30 days before the anchor. There is no due date on `Invoice`.

## Audit

Invoice mutations write `InvoiceAuditLog` (`InvoiceAuditAction` covers payments, voids, refunds, wallet deposits, line edits, returns, coverage, and delete). Finance compliance items are `FinanceComplianceItem`, acknowledged by code.

## Who can call these routes

Cashier-style payment routes allow accounting, billing, CMD, CMAC, and super admin. HMO and discount master data are limited to the desks that own them. Refund execution is account head, billing head, or super admin. CMD and super admin also pass the global guard on every protected route; service-level checks still apply where the code calls `assertRefundReviewer` or similar.
