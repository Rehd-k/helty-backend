# Frontend Integration: Invoice-Backed Nursing Queue

This document describes how the frontend should use the new backend flow where nursing queue entries are derived from paid invoices (not `WaitingPatient` creation).

## 1) Core Behavior

- Queue source is now **Invoice**.
- A queue row appears only when all are true:
  - `invoice.status = PAID`
  - Invoice has at least one line item under service category **`Consultations & Reviews`**
  - Patient is registered (`patient.patientId` is not null/empty)
- Queue metadata is stored on invoice:
  - `consultingRoomId` (optional)
  - `vitalsId` (optional, one vitals per invoice)
  - `encounterId` (used as seen/in-consultation signal)

## 2) Endpoints You Should Use

### A. Load nursing waiting queue

`GET /waiting-patients`

#### Query params
- `consultingRoomId` (optional)
- `unassignedOnly` (optional boolean)
- `seen` (optional boolean)
- `patientId` (optional UUID)
- `skip`, `take` (pagination)
- `fromDate`, `toDate` (optional; if both omitted, no date filter is applied)

#### Response shape
```json
{
  "data": [
    {
      "id": "invoice-uuid",
      "invoiceId": "invoice-uuid",
      "invoiceID": "HUMAN_BILL_NO",
      "patientId": "patient-uuid",
      "consultingRoomId": "room-uuid-or-null",
      "seen": false,
      "createdAt": "2026-04-08T09:00:00.000Z",
      "updatedAt": "2026-04-08T09:00:00.000Z",
      "patient": {
        "id": "patient-uuid",
        "firstName": "Jane",
        "surname": "Doe",
        "email": "x@y.com",
        "patientId": "HP-000123"
      },
      "consultingRoom": { "id": "room-uuid", "name": "Room A" },
      "vitals": { "id": "vitals-uuid" },
      "encounter": null,
      "consultationServices": [
        {
          "invoiceItemId": "item-uuid",
          "serviceId": "service-uuid",
          "name": "Consultation - General Medicine"
        }
      ],
      "invoice": { "...": "full included invoice payload" }
    }
  ],
  "total": 1,
  "skip": 0,
  "take": 20
}
```

> Use `consultationServices[0].name` (or list all) for displaying the paid consultation name.

### B. Assign to consulting room

`POST /waiting-patients/:invoiceId/send-to-room`

Body:
```json
{
  "consultingRoomId": "room-uuid",
  "staffId": "optional-staff-uuid"
}
```

Rules:
- Invoice must still qualify as queue entry.
- Invoice must already have linked vitals (`vitalsId` present).

### C. Update queue assignment

`PATCH /waiting-patients/:invoiceId`

Body:
```json
{
  "consultingRoomId": "room-uuid",
  "staffId": "optional-staff-uuid"
}
```

Notes:
- `seen` cannot be manually set here.
- `seen` is encounter-driven (`invoice.encounterId != null`).

### D. Get one queue entry

`GET /waiting-patients/:invoiceId`

### E. Deprecated operations

- `POST /waiting-patients` -> deprecated (`410 Gone`)
- `DELETE /waiting-patients/:id` -> deprecated (`410 Gone`)

## 3) Linking vitals to invoice (required before send-to-room)

Use:

`POST /patient-vitals`

Body (invoice flow):
```json
{
  "invoiceId": "invoice-uuid",
  "patientId": "patient-uuid",
  "systolic": 120,
  "diastolic": 80,
  "temperature": 36.8,
  "pulseRate": 76,
  "spo2": 98
}
```

Rules:
- Exactly one of `waitingPatientId`, `admissionId`, `invoiceId` must be provided.
- In invoice flow:
  - If invoice already has vitals linked, vitals record is updated.
  - Else a new vitals row is created and linked to invoice.

## 4) Invoice category filtering endpoint (paid waiting lists)

`GET /invoices/by-service-categories`

For consultations list, pass:
- `category=Consultations & Reviews`
- `status=PAID` (or `FULLY_PAID`, alias accepted)

Other supported filters:
- `search`
- `transactionId`
- `invoiceId` / `invoiceID`
- `patientName`
- `fromDate`, `toDate`, `skip`, `take`

## 5) Recommended frontend flow

1. Bill consultation service item.
2. Complete payment (invoice becomes `PAID`).
3. Record vitals with `POST /patient-vitals` using `invoiceId`.
4. Load queue via `GET /waiting-patients`.
5. Assign room via `POST /waiting-patients/:invoiceId/send-to-room`.
6. Start consultation encounter and set invoice `encounterId` where applicable, so queue shows as `seen=true`.

## 6) Common reasons queue looks empty

- Invoice is not `PAID`.
- Service category is not exactly `Consultations & Reviews`.
- Patient is not registered (`patient.patientId` null/empty).
- Frontend was reading deprecated waiting-patient creation flow.

