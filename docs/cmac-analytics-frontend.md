# CMAC Analytics — Frontend Integration Guide

This document is the contract between the hospital backend and the CMAC oversight dashboard frontend. All routes require a valid JWT (`Authorization: Bearer <token>`) and staff with account type **CMAC** or **SUPER_ADMIN** (`accountType` or `staffRole` on the JWT).

Base URL: same host as the API (no global prefix). Swagger: `/api`.

---

## Global query parameters

Used on every `GET /cmac/analytics/*` endpoint:

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `period` | `today` \| `week` \| `month` \| `quarter` \| `year` | Yes | Window for metrics; compared to the immediately previous period of equal length |
| `asOf` | ISO 8601 datetime | No | Anchor instant (defaults to now). Useful for tests and backdated reports |
| `departmentId` | UUID | No | Reserved for future drill-down filters |
| `limit` | 1–50 | No | Top-N lists (default 10) |

Example:

```
GET /cmac/analytics/overview?period=month
GET /cmac/analytics/clinical?period=week&asOf=2026-05-15T12:00:00.000Z&limit=5
```

---

## Response conventions

### KPI metric

```json
{
  "key": "newPatients",
  "label": "New patients",
  "value": 42,
  "unit": "days",
  "comparison": {
    "current": 42,
    "previous": 38,
    "percentChange": 10.53,
    "direction": "up",
    "isPositive": true
  }
}
```

- `isPositive`: whether the trend is good for hospital operations (e.g. wait time **down** is positive).
- `percentChange`: `null` only when both current and previous are 0.

### Series point (charts)

```json
{
  "label": "Mon",
  "value": 12,
  "start": "2026-05-12T00:00:00.000Z",
  "end": "2026-05-12T23:59:59.999Z"
}
```

Use with line/bar charts (`fl_chart`, Chart.js, Recharts, etc.).

### Alert

```json
{
  "severity": "critical",
  "code": "LAB_CRITICAL_COUNT",
  "message": "3 critical lab result(s) in period",
  "metric": "laboratory"
}
```

Severity: `info` | `warning` | `critical`.

### Insight

```json
{
  "id": "lab-tat-high",
  "message": "Lab results median turnaround is 18 hours",
  "category": "laboratory",
  "severity": "warning"
}
```

### Audit flag

```json
{
  "entityType": "Encounter",
  "entityId": "uuid",
  "patientId": "uuid",
  "rule": "MISSING_DIAGNOSIS",
  "severity": "warning"
}
```

Drill-down: open patient chart at `/patients/:patientId/chart` (existing patient module).

---

## Refresh intervals

| Widget | Endpoint | Suggested poll |
|--------|----------|----------------|
| Executive landing | `/cmac/analytics/overview` | 60s |
| Domain dashboards | `/cmac/analytics/{domain}` | 120s |
| Insights strip | `/cmac/analytics/insights` | 60s |
| Quality capture lists | `/quality-safety/*` | On demand / pull-to-refresh |

---

## Analytics endpoints

### `GET /cmac/analytics/overview`

**UI:** Landing dashboard — headline KPI cards, alert banner, top insights.

**Chart mapping:** KPI cards from `headlineKpis[]`; alert list; insight cards.

```json
{
  "period": "month",
  "asOf": "2026-05-27T10:00:00.000Z",
  "generatedAt": "2026-05-27T10:00:01.000Z",
  "headlineKpis": [ "..." ],
  "alerts": [ "..." ],
  "insights": [ "..." ]
}
```

---

### `GET /cmac/analytics/insights`

**UI:** “System-generated insights” panel.

**Chart mapping:** Ordered list (critical first). No chart required.

---

### `GET /cmac/analytics/patient-activity`

**UI:** Patient activity summary.

| Field | Widget |
|-------|--------|
| `kpis[]` | Stat cards (total, new, OPD, admissions, discharges, referrals) |
| `series.newPatients` | Line chart |
| `series.referralsIn` / `referralsOut` | Dual line or grouped bar |

**OPD visits:** distinct patients with **paid** invoices in category `Consultations & Reviews`.

---

### `GET /cmac/analytics/clinical`

**UI:** Clinical performance indicators.

| Field | Widget |
|-------|--------|
| `topDiagnoses[]` | Horizontal bar / table |
| `treatmentOutcomes.current` | Donut (discharge outcomes) |
| `readmissions.current` | Stat + spark context |
| `kpis` (readmission rate, ALOS) | KPI cards |

**Readmission window:** 30 days after prior discharge (`READMISSION_DAYS` constant).

---

### `GET /cmac/analytics/laboratory`

**UI:** Laboratory reports dashboard.

| Field | Widget |
|-------|--------|
| `pendingVsCompleted` | Stacked bar or two KPIs |
| `statusBreakdown[]` | Donut by `LabOrderStatus` |
| `topTests[]` | Bar chart |
| `criticalAlerts[]` | Alert table with patient names |
| `kpis` (TAT, critical count) | KPI cards |

**Source of truth:** dynamic `LabOrder` pipeline only (not legacy free-text `LabReport`).

---

### `GET /cmac/analytics/pharmacy`

**UI:** Pharmacy / drug usage.

| Field | Widget |
|-------|--------|
| `topPrescribed[]` | Bar chart |
| `antibioticTrend[]` | Line chart (ATC prefix `J01`) |
| `kpis` (stockouts, low stock, expired, antibiotics, waste) | KPI cards |

Dispense data from `InventoryMovement` type `DISPENSE`. Prescribing from `PrescriptionItem` where linked to `Drug`.

---

### `GET /cmac/analytics/operations`

**UI:** Appointments & workflow performance.

| Field | Widget |
|-------|--------|
| `kpis` (no-shows, no-show rate, avg wait) | KPI cards |
| `doctorWorkload[]` | Bar chart |
| `departmentUtilization[]` | Bar chart (billable services by department) |
| `peakVisitingHours[]` | 24-bar histogram |

**No-show status:** appointment `status = no_show`.

---

### `GET /cmac/analytics/quality`

**UI:** Quality & safety indicators.

| Field | Widget |
|-------|--------|
| `incidentsByType[]` | Bar chart |
| `complaintsByCategory[]` | Bar chart |
| `auditFlags[]` | Exception table with drill-down |
| `kpis` | KPI cards |

Audit rules (derived, not stored):

- `MISSING_DIAGNOSIS` — completed outpatient encounter without `EncounterDiagnosis`
- `MISSING_DISCHARGE_SUMMARY` — discharged admission with empty summary

---

### `GET /cmac/analytics/staff`

**UI:** Staff performance overview.

| Field | Widget |
|-------|--------|
| `patientsPerDoctor[]` | Bar chart (unique patients per doctor) |
| `labWorkloadPerTechnician[]` | Bar chart (results entered) |
| `departmentEfficiency[]` | Table with `score` column (volume − complaints − wait) |

---

## Quality capture endpoints (`/quality-safety/*`)

Authenticated staff (any role with JWT). Used to **log** data that feeds quality analytics.

Shared list query: `from`, `to`, `departmentId`, `status`, `skip`, `take`.

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/quality-safety/referrals` | Register referral in/out |
| GET | `/quality-safety/referrals` | List referrals |
| GET/PATCH | `/quality-safety/referrals/:id` | Detail / update |
| POST | `/quality-safety/complaints` | Log patient complaint |
| GET | `/quality-safety/complaints` | List complaints |
| GET/PATCH | `/quality-safety/complaints/:id` | Detail / update |
| POST | `/quality-safety/incidents` | Report safety incident |
| GET | `/quality-safety/incidents` | List incidents |
| GET/PATCH | `/quality-safety/incidents/:id` | Detail / update |
| POST | `/quality-safety/infections` | Register infection case |
| GET | `/quality-safety/infections` | List infection cases |
| GET/PATCH | `/quality-safety/infections/:id` | Detail / update |

### Create referral body (example)

```json
{
  "patientId": "uuid",
  "direction": "OUT",
  "referringFacility": "General Hospital",
  "receivingFacility": "Specialist Centre",
  "reason": "Cardiology review",
  "departmentId": "uuid"
}
```

### Create complaint body (example)

```json
{
  "patientId": "uuid",
  "category": "Waiting time",
  "description": "Waited over 3 hours",
  "severity": "HIGH",
  "departmentId": "uuid"
}
```

---

## Error handling

| Code | Meaning |
|------|---------|
| 401 | Missing or invalid JWT |
| 403 | Not CMAC / SUPER_ADMIN (analytics) or insufficient access |
| 422 | Invalid query (`period`, dates, UUIDs) |
| 404 | Quality-safety record not found |

Empty states: return zero values and empty arrays — do not treat as errors.

---

## Known limitations

1. **Legacy prescriptions:** string-only `Prescription.drug` rows are not included in `topPrescribed`; prefer `PrescriptionItem` with `drugId`.
2. **Lab scope:** metrics use `LabOrder` / `LabResult` only.
3. **Readmissions:** 30-day window; not adjusted for planned readmissions.
4. **Department on encounters:** OPD encounters are not directly linked to departments; utilization uses invoice service → department.
5. **Critical lab flags:** persisted on result entry; historical results before migration may lack flags until re-saved.
6. **Migration:** run `pnpm exec prisma migrate deploy` for `20260527160000_cmac_quality_analytics` before using quality/analytics features.

---

## Suggested dashboard layout

```
┌─────────────────────────────────────────────────────────┐
│  Overview KPIs (from /overview)          Alerts banner   │
├─────────────────────────────────────────────────────────┤
│  Insights (from /insights or overview.insights)        │
├──────────────┬──────────────┬──────────────┬───────────┤
│ Patient      │ Clinical     │ Laboratory   │ Pharmacy  │
│ activity     │              │              │           │
├──────────────┼──────────────┼──────────────┼───────────┤
│ Operations   │ Quality      │ Staff        │           │
└──────────────┴──────────────┴──────────────┴───────────┘
```

Each tile loads its domain endpoint with the same `period` / `asOf` query params so comparisons stay aligned.
