# Flutter Inpatient Nursing + Billing Integration Guide

This guide is for Cursor handling your Flutter frontend app and wiring it to the backend endpoints for:
- nursing inpatient service entry
- recurring inpatient billing
- wallet deposits and invoice payments
- discharge blocking when invoices are unpaid

It is designed so you can plug it into your Flutter project with minimal changes.

---

## 1) Base API Rules

- Base URL: `https://<your-api-host>`
- Auth: Bearer token
  - Header: `Authorization: Bearer <token>`
- Content-Type: `application/json`
- IDs are UUID strings.
- Money fields should be handled as `num`/`double` in UI and formatted properly for display.

---

## 2) Core Endpoints for Inpatient Billing

### Admissions

- `GET /admissions/active`
  - Use for active inpatient list.
- `GET /admissions/:id`
  - Use for inpatient profile detail page.
- `PATCH /admissions/:id`
  - Use for discharge.
  - If any linked invoice is not paid, backend throws error and discharge is blocked.

Request (discharge):
```json
{
  "dischargeDate": "2026-03-27T14:30:00.000Z"
}
```

Failure response example:
```json
{
  "statusCode": 400,
  "message": "Cannot discharge patient while linked invoices are unpaid.",
  "error": "Bad Request"
}
```

---

### Invoices (Inpatient Billing Source of Truth)

- `GET /invoices/patient/:patientId`
  - Fetch all invoices for patient.
- `GET /invoices/:id`
  - Fetch single invoice with computed totals, items, payments, and amount due.
- `POST /invoices`
  - Create invoice if needed.
- `POST /invoices/:id/items`
  - Add service to invoice (one-time or recurring daily).
- `PATCH /invoices/:id/items/:itemId`
  - Update quantity/unit price.
- `DELETE /invoices/:id/items/:itemId`
  - Remove item.
- `POST /invoices/:id/items/:itemId/pause`
  - Pause recurring item (close open segment).
- `POST /invoices/:id/items/:itemId/resume`
  - Resume recurring item (create new segment).
- `POST /invoices/:id/payments`
  - Record payment from wallet/cash/transfer.
- `GET /invoices/:id/payments`
  - List invoice payments.

Create invoice request:
```json
{
  "patientId": "3f2c9f8d-4f2a-48b7-b67f-893f4e5d3d11",
  "staffId": "6a7344f7-e347-4d7e-b5ce-0ec5db4f9232",
  "encounterId": "2f7d5416-5db3-4311-a7ea-2e1f58cd95c4"
}
```

Add invoice item request (one-time):
```json
{
  "serviceId": "8eb9b0f6-45ec-4ab1-8fa5-2d6f983d2718",
  "unitPrice": 3000,
  "quantity": 2,
  "isRecurringDaily": false
}
```

Add invoice item request (recurring daily nursing/inpatient service):
```json
{
  "serviceId": "8eb9b0f6-45ec-4ab1-8fa5-2d6f983d2718",
  "unitPrice": 5000,
  "quantity": 1,
  "isRecurringDaily": true,
  "recurringSegmentStartAt": "2026-03-27T08:00:00.000Z"
}
```

`recurringSegmentStartAt` is optional (ISO 8601). If omitted, the first usage segment starts at server **now**.

Record payment request:
```json
{
  "amount": 10000,
  "source": "WALLET",
  "reference": "invoice_payment"
}
```

Invoice response (important fields):
```json
{
  "id": "invoice-uuid",
  "patientId": "patient-uuid",
  "status": "PARTIALLY_PAID",
  "totalAmount": "25000.00",
  "amountPaid": "10000.00",
  "amountDue": "15000.00",
  "invoiceItems": [
    {
      "id": "item-uuid",
      "serviceId": "service-uuid",
      "quantity": 1,
      "unitPrice": "5000.00",
      "isRecurringDaily": true,
      "usageSegments": [
        {
          "id": "segment-uuid",
          "startAt": "2026-03-26T12:00:00.000Z",
          "endAt": null
        }
      ]
    }
  ],
  "payments": [
    {
      "id": "payment-uuid",
      "amount": "10000.00",
      "source": "WALLET",
      "createdAt": "2026-03-27T10:00:00.000Z"
    }
  ]
}
```

---

### Wallet (Patient Deposits)

- `POST /invoices/wallets/:patientId/deposits`
  - CREDIT wallet.
- `GET /invoices/wallets/:patientId`
  - Read wallet balance.
- `GET /invoices/wallets/:patientId/transactions`
  - Full wallet transaction history (audit trail).

Deposit request:
```json
{
  "amount": 15000,
  "reference": "deposit"
}
```

Wallet response:
```json
{
  "id": "wallet-uuid",
  "patientId": "patient-uuid",
  "balance": "25000.00",
  "createdAt": "2026-03-26T08:00:00.000Z",
  "updatedAt": "2026-03-27T09:10:00.000Z"
}
```

Wallet transaction response entry:
```json
{
  "id": "wallet-txn-uuid",
  "walletId": "wallet-uuid",
  "type": "DEBIT",
  "amount": "10000.00",
  "reference": "invoice_payment",
  "invoiceId": "invoice-uuid",
  "createdAt": "2026-03-27T10:00:00.000Z"
}
```

---

## 3) Nursing Module Integration (Frontend Behavior)

In the inpatient nursing section:

1. Select active admission and patient.
2. Get or create invoice.
3. Add inpatient service item:
   - use recurring daily for bed/nursing/inpatient consultation services
   - use one-time for procedures/single services
4. For recurring items:
   - Pause when service should stop billing
   - Resume when service restarts
5. Show current computed totals in real-time:
   - total amount
   - amount paid
   - amount due
6. Allow instant payment:
   - wallet / cash / transfer
7. Before discharge button:
   - attempt `PATCH /admissions/:id` with dischargeDate
   - if backend rejects unpaid invoices, show blocking message and navigate user to bill settlement flow

---

## 4) Flutter Data Models (Suggested)

```dart
class InvoiceModel {
  final String id;
  final String patientId;
  final String status; // PENDING, PARTIALLY_PAID, PAID
  final double totalAmount;
  final double amountPaid;
  final double amountDue;
  final List<InvoiceItemModel> invoiceItems;
  final List<InvoicePaymentModel> payments;
}

class InvoiceItemModel {
  final String id;
  final String? serviceId;
  final int quantity;
  final double unitPrice;
  final bool isRecurringDaily;
  final List<UsageSegmentModel> usageSegments;
}

class UsageSegmentModel {
  final String id;
  final DateTime startAt;
  final DateTime? endAt;
}

class InvoicePaymentModel {
  final String id;
  final double amount;
  final String source; // WALLET, CASH, TRANSFER
  final DateTime createdAt;
}

class WalletModel {
  final String id;
  final String patientId;
  final double balance;
}
```

---

## 5) Suggested API Client Methods (Flutter)

- `Future<List<AdmissionModel>> getActiveAdmissions()`
- `Future<List<InvoiceModel>> getPatientInvoices(String patientId)`
- `Future<InvoiceModel> getInvoice(String invoiceId)`
- `Future<InvoiceItemModel> addInvoiceItem(String invoiceId, AddItemPayload payload)`
- `Future<void> pauseRecurringItem(String invoiceId, String itemId)`
- `Future<void> resumeRecurringItem(String invoiceId, String itemId)`
- `Future<InvoiceModel> recordPayment(String invoiceId, PaymentPayload payload)`
- `Future<WalletModel> getWallet(String patientId)`
- `Future<void> depositToWallet(String patientId, DepositPayload payload)`
- `Future<List<WalletTxnModel>> getWalletTransactions(String patientId)`
- `Future<void> dischargeAdmission(String admissionId, DateTime dischargeDate)`

---

## 6) Inpatient Bills Page (Modern + Fast UX Blueprint)

Use this structure for a modern page that performs well:

- Header summary cards:
  - Total billed
  - Amount paid
  - Outstanding
  - Wallet balance
- Two-tab layout:
  - `Charges` tab (invoice items)
  - `Payments` tab (invoice payments + wallet transactions)
- Sticky bottom action bar:
  - Add Service
  - Pause/Resume recurring
  - Pay Bill
  - Deposit Wallet
  - Discharge
- Filters:
  - recurring only
  - active recurring only
  - one-time only
- Optimistic UI:
  - update list immediately, rollback on API failure
- Pagination/lazy loading for history lists
- Cached invoice state and selective refresh (avoid full page reload)
- Debounce refresh actions from frequent nursing updates
- Use skeleton loading placeholders and empty-state components

Performance notes:
- Render list with `ListView.builder`
- Keep API parsing off main thread if payload becomes heavy
- Avoid rebuilding full page; use segmented state (summary, items, payments)
- Cache invoice detail by `invoiceId` and invalidate only touched sections

---

## 7) Workflow Mapping (Nursing -> Bills Sync)

1. Nurse adds/updates service in inpatient nursing screen.
2. Frontend calls invoice item endpoint.
3. Frontend immediately refetches invoice detail (`GET /invoices/:id`).
4. Inpatient Bills page consumes same invoice state/store.
5. UI updates automatically with new totals and status.
6. Payment/deposit/discharge actions all mutate this same source and refetch.

This ensures all nursing updates reflect immediately in Inpatient Bills.

---

## 8) Error Handling Rules for Frontend

- If `400` from wallet payment due to insufficient balance:
  - Show action: "Deposit to wallet" and "Pay via cash/transfer".
- If `400` on discharge due to unpaid invoices:
  - Show blocking toast/dialog and deep-link to bills tab.
- If payment amount exceeds due:
  - Auto-clamp amount input to max due before submit.
- Keep all server messages visible in debug logs for support.

---

## 9) Quick Cursor Prompt You Can Use in Flutter Repo

Use this in your Flutter project Cursor chat:

```text
Build an Inpatient Nursing + Billing feature integrated with these backend endpoints:
- admissions: GET /admissions/active, GET /admissions/:id, PATCH /admissions/:id
- invoices: GET /invoices/patient/:patientId, GET /invoices/:id, POST /invoices, POST /invoices/:id/items, PATCH /invoices/:id/items/:itemId, POST /invoices/:id/items/:itemId/pause, POST /invoices/:id/items/:itemId/resume, POST /invoices/:id/payments, GET /invoices/:id/payments
- wallet: POST /invoices/wallets/:patientId/deposits, GET /invoices/wallets/:patientId, GET /invoices/wallets/:patientId/transactions

Requirements:
- Modern inpatient bills page with summary cards, charges/payments tabs, sticky actions.
- Nursing section can add recurring and one-time services.
- All updates reflect in bills page from shared invoice state.
- Handle discharge block when invoices unpaid.
- Use clean architecture, typed models, repository layer, and robust error handling.
```

