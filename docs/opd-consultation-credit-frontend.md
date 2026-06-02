# OPD consultation payment reuse (frontend)

One paid line in the **Consultations & Reviews** service category funds up to **2 completed outpatient (OPD) visits** within **14 calendar days** of payment. Emergency (`EMERGENCY`) encounters do not use this credit.

## Flow

1. Frontdesk creates an invoice and adds any consultation service line.
2. Patient pays the invoice (`POST /invoices/:id/payments`) until status is `PAID`.
3. Patient appears on the nursing queue (`GET /waiting-patients`) with credit metadata.
4. Doctor starts OPD (`POST /encounters/outpatient/start`) — consumes credit at **encounter completion**, not at start.
5. After the first completed visit, the same payment can fund a second visit if still within 14 days.

## Queue row fields

Each `consultationServices[]` entry on a waiting-patient / queue row includes:

| Field | Description |
|-------|-------------|
| `visitsConsumed` | Completed OPD visits charged to this line (0–2) |
| `visitsRemaining` | `2 - visitsConsumed` |
| `expiresAt` | ISO timestamp; credit invalid after this time |

## Patient consultation credits API

`GET /patients/:patientId/consultation-credits`

```json
{
  "credits": [
    {
      "invoiceItemId": "uuid",
      "invoiceId": "uuid",
      "invoiceID": "ABC123",
      "serviceName": "GP Consultation",
      "visitsConsumed": 1,
      "visitsRemaining": 1,
      "expiresAt": "2026-06-15T10:00:00.000Z",
      "expired": false,
      "settled": false,
      "consumable": true
    }
  ]
}
```

`consumable` is `true` when the credit can start a new OPD encounter now (paid, not expired, visits remaining, no invoice linked to an active encounter).

## OPD start errors

When `POST /encounters/outpatient/start` fails with `400`, the message distinguishes:

- No payment on file
- Payment expired (14 days)
- Both visits already used
- Consultation already in progress

## UI hints

- Show `visitsRemaining` and `expiresAt` on queue cards and billing screens.
- After first visit, patient may re-enter the queue without a new payment if `visitsRemaining > 0` and not expired.
