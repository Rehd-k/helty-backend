# NestJS backend prompt: Nurse dashboard API (Helty Flutter)

Use this document as a **system or user prompt** when implementing the NestJS API that will feed `lib/src/nurses/dashboard.dart` (`NursesDashboardScreen`). The Flutter screen is currently **100% mock data**; it does not call the network yet. Your job is to define contracts that match the UI **exactly** so the mobile client can bind charts, KPIs, staff list, and alerts without redesign.

---

## Role and scope

- **Consumers**: authenticated users with nurse-related roles (`nurse`, `head_nurse`, `inpatient_nurse`, `outpatient_nurse` — align with the app’s auth claims).
- **Scope**: responses must be filtered to the **hospital / facility / tenant** implied by the JWT (same pattern as other modules).
- **Primary endpoint** (recommended): `GET /nurses/dashboard/overview`
- **Optional split** (if payloads are large):  
  - `GET /nurses/dashboard/kpis`  
  - `GET /nurses/dashboard/charts`  
  - `GET /nurses/dashboard/staff-on-duty`  
  - `GET /nurses/dashboard/alerts`  
  Prefer **one aggregated response** unless caching or load requires splitting.

---

## Query parameters

| Parameter   | Type   | Required | Description |
|------------|--------|----------|-------------|
| `timeRange`| string | yes      | Must accept exactly these values (match Flutter dropdown): `Today`, `Last 7 Days`, `This Month`, `This Year`. |
| `asOf`     | string | no       | ISO 8601 instant in UTC (e.g. `2026-04-12T14:30:00.000Z`). If omitted, server uses `now()`. Same idea as frontdesk `asOf`. |

Server must interpret `timeRange` + `asOf` to define the **reporting window** and all series/KPIs must use the **same window** for consistency.

---

## Response envelope (aggregated `GET /nurses/dashboard/overview`)

Return **JSON** with this top-level shape (camelCase for Flutter/Dart parity with existing services like `FrontdeskDashboardSummary`):

```json
{
  "asOf": "2026-04-12T14:30:00.000Z",
  "timeRange": "Today",
  "window": { "start": "2026-04-12T00:00:00.000Z", "end": "2026-04-12T23:59:59.999Z" },
  "header": { "title": "Hospital Overview", "subtitleTemplate": "Welcome back, {name}. Here's what's happening today.", "userDisplayName": "Jane" },
  "kpis": { ... },
  "admissionsDischargesSeries": { ... },
  "departmentLoad": [ ... ],
  "staffOnDuty": [ ... ],
  "criticalAlerts": [ ... ]
}
```

### `header`

- `title`: string — UI shows **"Hospital Overview"** (can be fixed on client; include for CMS/i18n later).
- `subtitleTemplate`: string — Flutter currently shows **"Welcome back, Admin. Here's what's happening today."** Support a template with `{name}` or return a fully resolved `subtitle` string.
- `userDisplayName`: string — replaces `{name}` in the subtitle (e.g. first name or preferred name).

### `kpis` (four cards — match labels and semantics)

The UI renders four KPI cards with **title**, **main value** (large text), and a **secondary** line that is either:

- a **percent delta** with sign, e.g. `+12%`, `-4m`, `+2%`, or  
- a **text status** e.g. `Optimal`, or  
- a **progress ring** for bed occupancy (0–1 fraction).

Provide **both machine-readable numbers** and **display hints** so the client does not guess formatting.

```json
"kpis": {
  "totalPatients": {
    "value": 1248,
    "valueFormatted": "1,248",
    "delta": { "kind": "percent", "value": 12.0, "label": "+12%", "direction": "up", "isPositive": true }
  },
  "bedOccupancy": {
    "ratio": 0.84,
    "valueFormatted": "84%",
    "delta": { "kind": "percent", "value": 2.0, "label": "+2%", "direction": "up", "isPositive": true }
  },
  "activeStaff": {
    "count": 142,
    "valueFormatted": "142",
    "delta": { "kind": "text", "label": "Optimal", "isPositive": true }
  },
  "averageWaitTime": {
    "minutes": 18,
    "valueFormatted": "18m",
    "delta": { "kind": "minutes", "value": -4, "label": "-4m", "direction": "down", "isPositive": true }
  }
}
```

**Semantics (critical for correct UI colors):**

- `totalPatients.delta`: higher is generally “good” → `isPositive: true` when count vs prior window increased.
- `bedOccupancy.delta`: define policy (e.g. up = strain); set `isPositive` according to whether **up** should show green or red on the client. Document the rule in a short comment in DTO.
- `activeStaff.delta`: often `kind: "text"` with `label: "Optimal" | "Understaffed" | ...`.
- `averageWaitTime.delta`: **lower wait is better**. When wait **decreases**, set `isPositive: true` even if `direction` is `down` (Flutter mock uses `isGoodNegative: true` for this card).

**Comparison baseline:** for each `delta`, compare current `window` to the **immediately previous window of equal length** (e.g. yesterday for Today, previous 7 days for Last 7 Days), unless product specifies otherwise — state the rule in API docs.

---

### `admissionsDischargesSeries` (line chart: “Patient Admissions vs Discharges”)

The Flutter chart uses **two series** over **seven X positions** with axis labels (mock uses Mon–Sun). Do **not** hardcode weekdays in the API; return **explicit labels** so “Today” can be **24 hours** and “This Month” can be **weeks or days**.

```json
"admissionsDischargesSeries": {
  "points": [
    { "label": "Mon", "admissions": 40, "discharges": 30 },
    { "label": "Tue", "admissions": 60, "discharges": 45 }
  ],
  "meta": {
    "yAxisMax": 100,
    "yAxisSuggested": true
  }
}
```

- `points`: ordered array; length **7** for week-style ranges, or **24** for hourly “Today”, etc. Client maps index → X.
- Counts are **non-negative numbers** (integers preferred).
- `yAxisMax`: optional; if omitted, client can auto-scale. Flutter mock used max Y = 100 — if real counts exceed 100, either raise `yAxisMax` or set `yAxisSuggested: false` and let the client compute max.

---

### `departmentLoad` (bar chart: “Department Load (Patients)”)

Flutter mock: five departments with a **0–100** vertical scale (`maxY: 100`). Return either **percent load** (0–100) or **raw counts** plus `chartMax` so the client can normalize.

```json
"departmentLoad": {
  "chartMax": 100,
  "bars": [
    { "departmentId": "uuid-or-code", "shortLabel": "Cardio", "load": 85 },
    { "departmentId": "...", "shortLabel": "Ortho", "load": 45 }
  ]
}
```

- `shortLabel`: short string for bottom axis (mock: Cardio, Ortho, ICU, Gen, Pediatrics).
- `load`: number; if `chartMax` is 100, `load` should be on that scale (e.g. % of staffed bed capacity or % of max census — **document the business definition**).

---

### `staffOnDuty` (right panel: “Staff on Duty”)

Mock rows: avatar initial from `name`, **role** subtitle, **status** pill with color. **Do not send Flutter `Color` hex from backend as the only signal**; send a **severity/token** the app maps to theme colors.

```json
"staffOnDuty": [
  {
    "id": "staff-uuid",
    "name": "Dr. Alan Grant",
    "role": "Head of Cardiology",
    "status": "In Surgery",
    "statusTone": "busy"
  }
]
```

Suggested `statusTone` enum: `success` | `warning` | `danger` | `neutral` | `busy` | `break` (extend as needed). Client maps tones to red/green/orange etc.

Optional: `photoUrl` for real avatars later.

---

### `criticalAlerts` (panel: “Critical Alerts”)

Mock shows **location**, **message**, and **relative time** (“10m ago”). Prefer **server UTC** + client localization; still provide a **relative label** for quick display.

```json
"criticalAlerts": [
  {
    "id": "alert-uuid",
    "location": "ICU Ward",
    "message": "Approaching max capacity (92%)",
    "severity": "critical",
    "occurredAt": "2026-04-12T14:20:00.000Z",
    "relativeLabel": "10m ago"
  }
]
```

- `severity`: at least `critical` | `warning` (mock uses red vs orange).
- Cap list length (e.g. **10**) and order by **most recent first** or **severity then time** — document.

---

## HTTP and errors

- **200** with body as above when authorized.
- **401** unauthenticated, **403** wrong role or tenant.
- **400** invalid `timeRange` or `asOf`.
- Validation: use `class-validator`; expose consistent `{ "statusCode", "message", "error" }` (Nest default) or your app’s standard error DTO.

---

## NestJS implementation checklist (for the coding agent)

1. Add `NursesDashboardModule`, controller `NursesDashboardController`, service aggregating inpatient census, appointments, staff roster/shifts, wait-time metrics, and alert engine (or read from existing tables).
2. DTOs for query (`timeRange`, `asOf`) and response (nested classes + `@ApiProperty` if Swagger is used).
3. Single transactional **read** path per request; document SQL or ORM queries and indexes for `window` filters.
4. Unit tests for `timeRange` → `window` boundaries (timezone: **hospital timezone** vs UTC — pick one, store UTC, convert for “Today”).
5. E2E test: `GET /nurses/dashboard/overview?timeRange=Today` with auth returns 200 and validates JSON schema.

---

## Flutter binding note (for parity)

File: `lib/src/nurses/dashboard.dart`

- KPI titles: **Total Patients**, **Bed Occupancy**, **Active Staff**, **Avg. Wait Time**.
- Chart titles: **Patient Admissions vs Discharges**, **Department Load (Patients)**.
- Side panels: **Staff on Duty**, **Critical Alerts**.
- Time dropdown values: **Today**, **Last 7 Days**, **This Month**, **This Year**.

When the API exists, add `NurseDashboardService` + models mirroring this JSON (same approach as `FrontdeskDashboardService` / `FrontdeskDashboardSummary.fromJson`).

---

## Copy-paste prompt (short version)

```
You are implementing a NestJS API for the Helty hospital app nurse dashboard.

Implement GET /nurses/dashboard/overview secured for nurse roles, scoped by hospital from JWT.

Query: timeRange enum Today | Last 7 Days | This Month | This Year; optional asOf ISO UTC.

Return one JSON object: asOf, timeRange, window {start,end}, header {title, subtitleTemplate, userDisplayName}, kpis { totalPatients, bedOccupancy, activeStaff, averageWaitTime } each with value, valueFormatted, and delta { kind, label, direction, isPositive, value } where isPositive encodes UI green/red including “lower wait is better”, bedOccupancy includes ratio 0-1 for a circular progress, admissionsDischargesSeries.points[] { label, admissions, discharges }, departmentLoad { chartMax, bars[] { departmentId, shortLabel, load } }, staffOnDuty[] { id, name, role, status, statusTone }, criticalAlerts[] { id, location, message, severity, occurredAt, relativeLabel }.

Use camelCase, ISO8601 UTC, class-validator, and document comparison baseline for deltas (previous equal-length window). Add tests for time windows.
```
