# CMD Analytics - Frontend Integration Guide

This document defines the API contract required by the CMD module (`lib/src/cmd/`) to render dashboards accurately with live backend data.

All routes are relative to the same API base URL configured in `ApiService`.  
Auth: `Authorization: Bearer <token>` (CMD/admin level access expected).

---

## Global conventions

- **Dates:** ISO 8601 UTC strings (for example `2026-05-28T07:45:00.000Z`).
- **Currency fields:** numeric in naira (do not return formatted strings).
- **Empty states:** return empty arrays and zero values, not `null`.
- **Error model:** standard API errors with HTTP status + message.

Optional common query params for all GET analytics endpoints:

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `period` | `today \| week \| month \| quarter \| year` | No | Window for summary cards/charts |
| `asOf` | ISO datetime | No | Anchor time for reproducible reports |
| `departmentId` | UUID | No | Department-level filtering when supported |
| `limit` | number | No | Cap list endpoints where relevant |

---

## Endpoint inventory

### 1) Executive dashboard

**GET** `/cmd/dashboard`

Used by `cmdExecutiveDashboardProvider` and `CMDDashboardScreen`.

```json
{
  "kpis": [
    {
      "id": "opd_today",
      "label": "OPD today",
      "value": "128",
      "trendLabel": "+6.2%",
      "direction": "up",
      "iconKey": "people",
      "severity": "info"
    }
  ],
  "alerts": [
    { "id": "a1", "message": "ICU occupancy above threshold", "level": "critical" }
  ],
  "activityFeed": [
    {
      "id": "f1",
      "at": "2026-05-28T07:44:00.000Z",
      "category": "Admissions",
      "message": "4 emergency admissions in last hour",
      "actorLabel": "Emergency Desk"
    }
  ],
  "revenueWeek": [
    { "dayIndex": 0, "revenueInpatient": 2600000, "revenueOutpatient": 1300000 }
  ],
  "capacity": {
    "totalBeds": 220,
    "occupiedBeds": 176,
    "occupancyPercent": 80,
    "icuPercent": 22,
    "generalWardPercent": 61,
    "maternityPercent": 17,
    "erLoadLabel": "High",
    "icuLoadPercent": 84
  },
  "clinical": {
    "surgerySuccessRate": 0.94,
    "readmission30d": 0.07,
    "infectionRate": 0.03,
    "patientSatisfaction": 0.89
  },
  "staff": {
    "doctorsOnDuty": 42,
    "nursesOnDuty": 118,
    "absenteeismPercent": 2.4,
    "overtimeHoursWeek": 173
  },
  "pharmacy": {
    "lowStockCount": 13,
    "expiringBatches": 9,
    "topDispensed": ["Paracetamol 500mg", "Ceftriaxone 1g", "Metformin 500mg"]
  },
  "lab": {
    "testsToday": 487,
    "pendingCount": 39,
    "avgTurnaroundHours": 7.4,
    "machineUptimePercent": 96.8,
    "redoRatePercent": 1.3
  },
  "revenueToday": 5900000,
  "revenueWeekTotal": 37100000,
  "revenueMonthTotal": 149300000,
  "patientsTodayOpd": 128,
  "patientsTodayAdmitted": 31,
  "pendingLabResults": 39
}
```

---

### 2) Hospital overview

**GET** `/cmd/hospital/overview`

Used by `cmdHospitalOverviewProvider` and `CMDHospitalOverviewScreen`.

```json
{
  "departments": [
    {
      "departmentId": "uuid",
      "name": "Internal Medicine",
      "patientsSeen": 124,
      "revenueDummy": 1840000,
      "slaBreaches": 2,
      "status": "OK"
    }
  ],
  "flow": [
    { "stage": "Triage", "patientsInStage": 16, "avgMinutes": 22 }
  ],
  "waitTimes": [
    { "area": "OPD", "p50Minutes": 34, "p90Minutes": 89, "trendLabel": "-5m vs last week" }
  ],
  "dailySummary": "OPD throughput improved compared to yesterday.",
  "weeklySummary": "Admissions remain stable with pressure in ICU."
}
```

---

### 3) Financial overview

**GET** `/cmd/financial/overview`

Used by `cmdFinancialOverviewProvider` and `CMDFinancialCommandScreen`.

```json
{
  "outstandingPayments": 32100000,
  "profitMarginPercent": 18.7,
  "forecastNextMonthDummy": 164500000,
  "byDepartment": [
    { "department": "Surgery", "amount": 52400000, "percentOfTotal": 35.4 }
  ],
  "paymentMix": {
    "insuranceAmount": 60100000,
    "cashAmount": 22700000,
    "corporateAmount": 15200000
  },
  "expenses": [
    { "category": "Consumables", "amount": 20300000, "budget": 19000000, "variancePercent": 6.8 }
  ],
  "leaks": [
    {
      "id": "l1",
      "description": "Unmatched procedure charges in surgery",
      "estimatedExposureDummy": 2800000,
      "status": "Open"
    }
  ]
}
```

---

### 4) Staff oversight

**GET** `/cmd/staff/oversight`

Used by `cmdStaffOversightProvider` and `CMDStaffOversightScreen`.

```json
{
  "attendance": { "onDuty": 160, "scheduled": 171, "late": 8, "absent": 3 },
  "byDepartment": [
    { "department": "Emergency", "requiredHeadcount": 30, "present": 27, "gap": 3 }
  ],
  "performance": [
    { "role": "Nursing", "nameOrTeam": "Ward B Team", "patientsHandled": 63, "efficiencyScore": 0.91 }
  ],
  "alerts": [
    { "id": "sa1", "message": "Night shift shortage in ICU" }
  ]
}
```

---

### 5) Beds snapshot

**GET** `/cmd/beds/snapshot`

Used by `cmdBedsSnapshotProvider` and beds/facilities screen.

```json
{
  "wards": [
    { "wardName": "ICU", "totalBeds": 24, "occupied": 22, "acuityMix": "High" }
  ],
  "recentEvents": [
    { "at": "2026-05-28T07:31:00.000Z", "type": "admission", "ward": "Maternity", "patientRef": "P-10029" }
  ],
  "overcrowdingMessages": ["ER overflow risk for next 6 hours"]
}
```

---

### 6) Lab monitoring

**GET** `/cmd/lab/monitoring`

Used by `cmdLabMonitoringProvider` and lab monitoring screen.

```json
{
  "pendingRows": [
    { "testCode": "CBC", "count": 22, "oldestHours": 5.5 }
  ],
  "delayedCount": 14,
  "avgTatHours": 7.4,
  "redoPercent": 1.3,
  "machines": [
    { "name": "Analyzer A", "uptimePercent": 98.1, "backlog": 3 }
  ]
}
```

---

### 7) Alerts and incidents

**GET** `/cmd/alerts`

Used by `cmdIncidentsProvider` and alerts/incidents screen.

```json
[
  {
    "id": "i1",
    "severity": "critical",
    "category": "Safety",
    "title": "Oxygen manifold pressure drop",
    "detail": "Pressure below threshold in Block C",
    "createdAt": "2026-05-28T07:26:00.000Z",
    "owner": "Facilities Unit",
    "status": "Investigating"
  }
]
```

Allowed severity values: `critical | high | medium | low`.

---

### 8) Report templates

**GET** `/cmd/reports/templates`

Used by `cmdReportTemplatesProvider`.

```json
[
  {
    "id": "r1",
    "name": "Daily Executive Brief",
    "cadence": "daily",
    "lastGeneratedAt": "2026-05-28T06:05:00.000Z",
    "formatsSupported": ["pdf", "csv"]
  }
]
```

---

### 9) Audit and compliance

**GET** `/cmd/audit/logs`

Used by `cmdAuditComplianceProvider` and audit/compliance screen.

```json
{
  "logs": [
    {
      "id": "al1",
      "at": "2026-05-28T05:55:00.000Z",
      "user": "cmd.admin@hospital",
      "action": "APPROVE_DISCOUNT",
      "entity": "invoice:INV-00283",
      "metadata": "approved 7% override"
    }
  ],
  "compliance": [
    {
      "code": "NDPR-ACCESS-001",
      "description": "Quarterly access review completed",
      "status": "Compliant",
      "evidenceUrl": "https://..."
    }
  ]
}
```

Note: `CmdEndpoints.complianceChecklist` exists but current service parses compliance from `/cmd/audit/logs`.

---

### 10) Approvals pending

**GET** `/cmd/approvals/pending`

Used by `cmdPendingApprovalsProvider` and system control flows.

```json
[
  {
    "id": "ap1",
    "type": "Purchase Request",
    "amountDummy": 980000,
    "requester": "Pharmacy",
    "status": "pending",
    "submittedAt": "2026-05-27T17:42:00.000Z"
  }
]
```

---

### 11) Communications list

**GET** `/cmd/communications`

Used by `cmdAnnouncementsProvider`.

```json
[
  {
    "id": "c1",
    "title": "Power maintenance window",
    "body": "Generator switch test tonight 11:00 PM",
    "audience": "all_staff",
    "priority": "high",
    "scheduledFor": "2026-05-28T21:00:00.000Z",
    "sentAt": null
  }
]
```

---

### 12) Broadcast communication

**POST** `/cmd/communications/broadcast`

Used by `CmdCommandService.sendBroadcast()`.

Request body:

```json
{
  "title": "Message title",
  "body": "Message body",
  "audience": "all_staff",
  "priority": "high"
}
```

Response: `200` or `201` with standard success payload (frontend currently ignores body).

---

### 13) Patient experience

**GET** `/cmd/patient-experience`

Used by `cmdPatientExperienceProvider`.

```json
{
  "metrics": [
    { "label": "Overall Satisfaction", "score": 4.3, "benchmark": 4.0, "trendLabel": "+0.1 vs last month" }
  ],
  "complaints": [
    {
      "id": "pc1",
      "department": "Outpatient",
      "summary": "Long wait before consultation",
      "status": "open",
      "openedAt": "2026-05-27T12:10:00.000Z"
    }
  ],
  "departmentRatings": [
    { "department": "Radiology", "stars": 4.1, "responseCount": 98 }
  ],
  "waitTimeInsight": "P90 waiting time dropped by 12 minutes week-over-week."
}
```

---

### 14) Settings overview

**GET** `/cmd/settings/overview`

Used by `cmdSettingsOverviewProvider` and `cmdSystemControlProvider`.

```json
{
  "integrations": [
    { "name": "LIS", "status": "healthy", "lastSyncAt": "2026-05-28T07:30:00.000Z" }
  ],
  "rolesSummary": "4 admin roles, 19 unit-level manager roles",
  "bannerDraft": "Remember to complete incident close-outs before Friday."
}
```

---

## Suggested polling cadence

| UI surface | Endpoint | Poll interval |
|------------|----------|---------------|
| CMD executive dashboard | `/cmd/dashboard` | 60-120s |
| Live incidents panel | `/cmd/alerts` | 30-60s |
| Beds and lab operational widgets | `/cmd/beds/snapshot`, `/cmd/lab/monitoring` | 60-120s |
| Financial/staff/overview pages | corresponding endpoints | 2-5 min or manual refresh |

---

## Status codes

| Code | Meaning |
|------|---------|
| 200 | OK |
| 201 | Created (broadcast or future create actions) |
| 400 | Bad request / invalid filter |
| 401 | Missing or invalid JWT |
| 403 | User lacks CMD permission |
| 404 | Resource not found |
| 422 | Validation error |
| 500 | Server error |

