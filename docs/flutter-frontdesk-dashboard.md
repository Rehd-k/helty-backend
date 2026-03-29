# Flutter frontdesk dashboard — API integration

This document describes the backend endpoints for the frontdesk dashboard (KPI cards and live patient queue). Use the same **base URL** and **Bearer token** (JWT from `POST /auth/login`) as the rest of the hospital API.

## Authentication

Every request:

```http
Authorization: Bearer <access_token>
Content-Type: application/json
```

On `401`, refresh login; on `403`, the user’s role is not allowed (any authenticated staff user can access these routes unless you add role restrictions later).

## Optional query parameter

Both endpoints accept:

| Query | Type   | Description |
|-------|--------|-------------|
| `asOf` | ISO 8601 string (optional) | Anchor time used to compute **today** (local calendar day via server `startOfDay` / `endOfDay` on that instant). Defaults to **now**. Useful for tests and consistent dashboards across timezones. |

Example: `GET /frontdesk/dashboard/summary?asOf=2026-03-29T10:00:00.000Z`

---

## 1. Dashboard summary

**`GET /frontdesk/dashboard/summary`**

### Response shape

| Field | Type | Meaning |
|-------|------|--------|
| `asOf` | string (ISO) | Anchor instant echoed back |
| `window.start` / `window.end` | string (ISO) | Start/end of the computed “today” window |
| `appointmentsToday` | int | `Appointment.date` falling on that calendar day |
| `appointmentsYesterday` | int | Same for the previous calendar day |
| `appointmentsChange.percentChange` | number \| null | Day-over-day % change (see below) |
| `appointmentsChange.direction` | `"up"` \| `"down"` \| `"flat"` | Trend vs yesterday |
| `checkInsToday` | int | `WaitingPatient` rows with `createdAt` in today’s window (OPD check-in) |
| `waitingRoomCount` | int | Distinct patients with a **fully paid** invoice line for service category **Consultations & Reviews** on an invoice **created today**, and **no** ongoing outpatient encounter |
| `dischargesToday` | int | Admissions with `status = DISCHARGED` and discharge timestamp in today’s window (`dischargeDateTime`, or legacy `dischargeDate` if `dischargeDateTime` is null) |

### Percent change rules

- If previous day count is **0** and current is **0**: `percentChange: 0`, `direction: flat`.
- If previous is **0** and current **> 0**: `percentChange: 100`, `direction: up`.
- Otherwise: \((\text{today} - \text{yesterday}) / \text{yesterday} \times 100\), rounded to two decimals.

### Example JSON

```json
{
  "asOf": "2026-03-29T10:00:00.000Z",
  "window": {
    "start": "2026-03-29T00:00:00.000Z",
    "end": "2026-03-29T23:59:59.999Z"
  },
  "appointmentsToday": 24,
  "appointmentsYesterday": 20,
  "appointmentsChange": {
    "percentChange": 20,
    "direction": "up"
  },
  "checkInsToday": 18,
  "waitingRoomCount": 7,
  "dischargesToday": 3
}
```

---

## 2. Live patient queue

**`GET /frontdesk/dashboard/queue`**

Returns a single ordered list for the table: **still waiting** (`seen = false` today) and **in consultation** (outpatient encounter ongoing, started today). If a patient appears in both, the **encounter** row wins (one row per patient).

### Row fields

| Field | Type | UI column |
|-------|------|-----------|
| `id` | string | Stable list key: `wp:<uuid>` or `en:<uuid>` |
| `patientId` | string | Internal |
| `patientName` | string | **Patient Name** |
| `time` | string (ISO) | **Time** — format in local timezone in Flutter |
| `doctor` | object \| null | **Doctor** — `{ id, firstName, lastName }` |
| `status` | string | **Status** — see enum below |
| `assignedRoom` | object \| null | **Assigned Room** — `{ id, name }` |
| `waitingPatientId` | string \| null | For actions tied to the queue row |
| `encounterId` | string \| null | For actions tied to the visit |

### Status enum (for display)

| Value | Meaning |
|-------|--------|
| `Waiting` | In lobby — no consulting room yet |
| `InRoom` | Assigned to a consulting room; doctor has not started the encounter |
| `InConsultation` | Outpatient encounter is **ongoing** |

**Doctor column:** For `Waiting` / `InRoom`, the API uses the **consulting room’s** assigned staff when present (`consultingRoom.staff`); otherwise `null`. For `InConsultation`, it uses the encounter’s doctor.

### Example JSON

```json
[
  {
    "id": "wp:a1b2c3d4-0000-0000-0000-000000000001",
    "patientId": "p-uuid",
    "patientName": "Jane Doe",
    "time": "2026-03-29T08:15:00.000Z",
    "doctor": null,
    "status": "Waiting",
    "assignedRoom": null,
    "waitingPatientId": "a1b2c3d4-0000-0000-0000-000000000001",
    "encounterId": null
  },
  {
    "id": "en:e5f6-0000-0000-0000-000000000099",
    "patientId": "p-uuid-2",
    "patientName": "John Smith",
    "time": "2026-03-29T08:45:00.000Z",
    "doctor": {
      "id": "staff-uuid",
      "firstName": "Ada",
      "lastName": "Orji"
    },
    "status": "InConsultation",
    "assignedRoom": {
      "id": "room-uuid",
      "name": "OPD 2"
    },
    "waitingPatientId": "wp-uuid-if-any",
    "encounterId": "e5f6-0000-0000-0000-000000000099"
  }
]
```

---

## Flutter implementation notes

### Suggested Dart models

You can use `json_serializable` or `freezed`; keep field names aligned with the JSON above.

### Refresh / polling

- Poll **`/frontdesk/dashboard/queue`** every **10–30 seconds** while the dashboard is visible (or use a `Timer.periodic` / Riverpod `Stream.periodic`).
- Poll **`/frontdesk/dashboard/summary`** less often (e.g. on load and every 1–5 minutes) unless you need near-real-time KPIs.

### UI formatting

- **Time:** `DateTime.parse(row.time).toLocal()` then `DateFormat.jm()` or hospital preference.
- **Percent:** Show `appointmentsChange.percentChange` with a `+` or `−` prefix and `%`; if `null`, show `—` or hide the delta.
- **Empty queue:** Show an empty state when the list is `[]`.

### Errors

| Status | Action |
|--------|--------|
| 401 | Redirect to login |
| 403 | Show “no permission” (if you add role checks later) |
| 500 | Retry with backoff; show generic error |

---

## OpenAPI / Swagger

With the backend running, see **`/api`** (or your configured Swagger path) under tag **Frontdesk** for interactive documentation.
