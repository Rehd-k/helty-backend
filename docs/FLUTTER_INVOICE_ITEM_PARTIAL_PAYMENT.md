# Flutter / client: invoice line-item (partial) payments

This backend links **billing** `Transaction` receipts to **invoice lines** via `InvoiceItemPayment`. Use this when the cashier applies cash/transfer/card to specific services on an invoice, including **partial pay on one line**.

## Concepts

| Field / model | Meaning |
|---------------|---------|
| `Invoice.amountPaid` | Header total paid on the invoice (wallet/cash `InvoicePayment` **and** allocated item payments both increase this over time). |
| `InvoiceItem.amountPaid` | Running total applied to that line from **allocated** payments only. |
| `InvoiceItemPayment` | One row: “this much of billing `Transaction` X went to invoice line Y.” Multiple rows over time = multiple partial payments on the same line. |
| `GET /invoices/:id` | Each item includes `amountPaid`, `lineTotal`, and `lineAmountDue` (server-computed; same rules as recurring daily billing). |

Legacy invoices may have `amountPaid` on the invoice from `POST /invoices/:id/payments` (wallet/cash) while line `amountPaid` stays `0` until you use allocation.

---

## Endpoint

`POST /invoices/:invoiceId/allocate-item-payments`

**Headers:** `Authorization: Bearer <token>`, `Content-Type: application/json`

### Request body

```json
{
  "staffId": "<staff-uuid-recording-payment>",
  "billingTransactionId": null,
  "amount": 1500,
  "method": "CASH",
  "reference": "RCP-1042",
  "notes": null,
  "bankAccountNumber": null,
  "allocations": [
    {
      "invoiceItemId": "<invoice-item-uuid>",
      "amount": 1500
    }
  ]
}
```

- `method`: same enum as billing: `CASH`, `CARD`, `TRANSFER`, `INSURANCE`, `WAIVER` (`TransactionPaymentMethod` in Prisma).
- `amount`: must equal the **sum** of `allocations[].amount`.
- `allocations`: at least one line. Duplicate `invoiceItemId` entries in one request are merged (amounts summed).
- `billingTransactionId`: optional. If omitted, the server uses the latest non-cancelled billing `Transaction` linked to this invoice, or **creates** one (linked to the invoice, totals aligned for payment caps).
- `bankAccountNumber`: optional; must match a registered bank account if you use it (same as transaction record payment).

### Partial payment on a single item

1. `GET /invoices/:id` — read `invoiceItems[].id`, `lineAmountDue`, `lineTotal`, `amountPaid`.
2. Choose `amount` ≤ `lineAmountDue` for that line (and ≤ overall invoice amount due if you prefer).
3. POST with one allocation:

```json
{
  "staffId": "<staff-uuid>",
  "amount": 500,
  "method": "CASH",
  "reference": "partial-line-1",
  "allocations": [
    { "invoiceItemId": "<that-line-uuid>", "amount": 500 }
  ]
}
```

### One payment, multiple lines

```json
{
  "staffId": "<staff-uuid>",
  "amount": 3000,
  "method": "TRANSFER",
  "reference": "TRF-88331",
  "allocations": [
    { "invoiceItemId": "<uuid-a>", "amount": 1000 },
    { "invoiceItemId": "<uuid-b>", "amount": 2000 }
  ]
}
```

### Success response (shape)

JSON includes:

- `payment` — created `TransactionPayment`
- `billingTransactionId`
- `allocations` — created `InvoiceItemPayment` rows
- `invoice` — updated invoice after totals/status recalculation
- `transactionOutstanding`, `transactionStatus`

### Typical errors (400)

- Sum of allocations ≠ `amount`
- Allocation would exceed **line** total (`lineTotal` vs `amountPaid` + allocation)
- Payment exceeds **invoice** outstanding (`totalAmount - amountPaid`)
- Payment exceeds **billing transaction** outstanding
- Billing transaction not linked to this invoice / wrong patient
- Cancelled billing transaction

---

## Copy-paste prompt for Cursor (Flutter)

Use the block below as a single message to your Flutter/Cursor agent so it wires partial line payment correctly.

```
You are integrating a Flutter app with a NestJS hospital API.

Task: Implement “partial payment for one invoice line item”.

API:
- Base URL: https://<host> (use app config).
- Auth: Authorization: Bearer <accessToken>.
- Load invoice: GET /invoices/<invoiceId> — use each invoiceItems[] entry’s:
  - id → invoiceItemId
  - lineAmountDue → max the user can pay on that line in one allocation (or split across multiple API calls)
  - lineTotal, amountPaid for display
- Submit payment: POST /invoices/<invoiceId>/allocate-item-payments
  Body JSON:
  {
    "staffId": "<current staff user id uuid>",
    "amount": <number>,   // must equal sum of allocations amounts
    "method": "CASH",     // or CARD, TRANSFER, INSURANCE, WAIVER — match backend TransactionPaymentMethod
    "reference": "<optional receipt ref>",
    "allocations": [
      { "invoiceItemId": "<selected line uuid>", "amount": <number> }
    ]
  }
  Omit billingTransactionId unless the backend already returned a billing transaction id you must reuse.

Rules:
- amount must be > 0 and ≤ lineAmountDue for that line (client-side guard); server enforces line cap and invoice outstanding.
- For partial pay, use a single allocation pointing at the chosen invoiceItemId.
- After success, refresh GET /invoices/<invoiceId> to show updated amountPaid / lineAmountDue / invoice status.
- Handle 400 errors: show message from response body.

Deliver: a small service/repository method allocateInvoiceItemPayment(invoiceId, staffId, invoiceItemId, amount, method, {reference}), and UI to pick a line and enter amount ≤ lineAmountDue.
```

---

## Related

- Wallet / unallocated invoice header payments: `POST /invoices/:id/payments` (unchanged).
- Full billing transaction APIs: `/transaction` module.
