# Inpatient nursing — Flutter client guide

This document describes REST endpoints for the inpatient (admission-scoped) nursing workflow. Base URL and global auth match the rest of the Helty Hospital API (see Swagger at `/api` when the server is running).

## Authentication

- Send `Authorization: Bearer <JWT>` on every request.
- The API uses global JWT validation and role/account checks (`AccessGuard`). Super-admin users bypass route-level restrictions.
- **`sub` in the JWT is the Staff user id** (`Staff.id`). There is **no separate `Nurse` table** — every user lives in `Staff`, and a nurse is any Staff with `accountType === 'NURSE'`. `staffRole` distinguishes nurse tiers (`HEAD_NURSE`, `INPATIENT_NURSE`, `OUTPATIENT_NURSE`).
- For nurse-performed writes (medication administration, IV monitoring, intake/output, nursing notes, procedure/wound/care plan records, monitoring charts, handover reports), Flutter should **not** send a nurse identifier — the server stores `req.user.sub` as the `nurseId`/`administeredByNurseId` (which is a `Staff.id`). Non-nurse accounts will be rejected with 403.
- The `NurseAssignment` endpoint is the one exception that accepts a `nurseId` in the body — it is the **`Staff.id`** of the nurse to assign (the staff must have `accountType === 'NURSE'`).

## Existing endpoints to reuse

| Purpose | Method | Path | Notes |
|--------|--------|------|--------|
| Admission detail (aggregate) | GET | `/admissions/:id` | Includes `medicationOrders` (with `prescribedBy`), `nurseAssignments` (with `nurse` as Staff), nested `medicationAdministrations` (with `medicationOrder` + `nurse` as Staff), plus other inpatient relations. All nurse fields resolve directly to `Staff` (`id`, `firstName`, `lastName`, `staffRole`). |
| Ward round (doctor SOAP) notes | POST | `/ward-round-notes` | Body: `admissionId`, `doctorId`, `roundDate`, SOAP fields. |
| Ward round notes list | GET | `/ward-round-notes` | Query: `admissionId`, optional `doctorId`, `fromDate`, `toDate`. |
| Nurse home / alerts overview | GET | `/nurses/dashboard/overview` | Query: `timeRange`, optional `asOf`. Requires nurse account. |

## New admission-scoped routes

Replace `:admissionId` with the admission UUID. All paths are relative to the API root (no trailing slash).

### Medication orders (inpatient MAR — prescribe)

| Method | Path | Who | Body |
|--------|------|-----|------|
| GET | `/admissions/:admissionId/medication-orders` | Nurse, doctor | — |
| POST | `/admissions/:admissionId/medication-orders` | Doctor / head nurse | `CreateAdmissionMedicationOrderDto` |
| PATCH | `/admissions/:admissionId/medication-orders/:orderId` | Doctor / head nurse | `UpdateAdmissionMedicationOrderDto` |
| DELETE | `/admissions/:admissionId/medication-orders/:orderId` | Doctor / head nurse | — (fails if administrations exist) |

**POST/PATCH fields (see DTOs in repo):** `drugName`, `dose`, `route` (`MedicationRoute`: `IV`, `ORAL`, `IM`, `SC`), `frequency`, `startDateTime`, optional `endDateTime`, optional `notes`. Prescriber on create is taken from JWT (`sub`). `status` on update: `ACTIVE` | `STOPPED`.

### Medication administrations (nurse)

| Method | Path | Who | Body |
|--------|------|-----|------|
| GET | `/admissions/:admissionId/medication-administrations` | Nurse, doctor | — |
| POST | `/admissions/:admissionId/medication-administrations` | Nurse | `CreateMedicationAdministrationDto` |
| PATCH | `/admissions/:admissionId/medication-administrations/:administrationId` | Nurse (same recorder) | `UpdateMedicationAdministrationDto` |

**POST:** `medicationOrderId` (must belong to this admission), `scheduledTime`, optional `actualTime`, `status` (`MedicationAdminStatus`: `GIVEN`, `MISSED`, `REFUSED`, `DELAYED`), optional `reasonIfNotGiven`, optional `remarks`. Nurse from JWT.

### IV fluid orders

| Method | Path | Who | Body |
|--------|------|-----|------|
| GET | `/admissions/:admissionId/iv-fluid-orders` | Nurse, doctor | — |
| POST | `/admissions/:admissionId/iv-fluid-orders` | Doctor / head nurse | `CreateIvFluidOrderDto` |
| PATCH | `/admissions/:admissionId/iv-fluid-orders/:orderId` | Nurse, doctor | `UpdateIvFluidOrderDto` |

**POST:** `fluidType`, `volume`, `rate`, `startTime`, `expectedEndTime`. Ordering clinician from JWT. **PATCH:** optional `status` (`IVOrderStatus`: `ACTIVE`, `COMPLETED`, `STOPPED`), `rate`, `expectedEndTime`.

### IV monitoring (per order)

| Method | Path | Who | Body |
|--------|------|-----|------|
| GET | `/admissions/:admissionId/iv-fluid-orders/:orderId/monitorings` | Nurse, doctor | — |
| POST | `/admissions/:admissionId/iv-fluid-orders/:orderId/monitorings` | Nurse | `CreateIvMonitoringDto` |

**POST:** `currentRate`, `insertionSiteCondition`, optional `complications`, optional `stoppedAt`, optional `reasonStopped`. Nurse from JWT.

### Intake & output

| Method | Path | Who | Body |
|--------|------|-----|------|
| GET | `/admissions/:admissionId/intake-output-records` | Nurse, doctor | — |
| POST | `/admissions/:admissionId/intake-output-records` | Nurse | `CreateIntakeOutputRecordDto` |
| PATCH | `/admissions/:admissionId/intake-output-records/:recordId` | Nurse (owner) | `UpdateIntakeOutputRecordDto` |

**Types:** `IntakeOutputType` — `INTAKE`, `OUTPUT`. **Categories:** `ORAL`, `IV`, `URINE`, `STOOL`, `DRAIN`, `VOMIT`, `BLOOD`, `OTHER`.

### Nursing notes

| Method | Path | Who | Body |
|--------|------|-----|------|
| GET | `/admissions/:admissionId/nursing-notes` | Nurse, doctor | — |
| POST | `/admissions/:admissionId/nursing-notes` | Nurse | `CreateNursingNoteDto` |

**Note types:** `NursingNoteType` — `GENERAL`, `INCIDENT`, `SHIFT_SUMMARY`.

### Procedure records

| Method | Path | Who | Body |
|--------|------|-----|------|
| GET | `/admissions/:admissionId/procedure-records` | Nurse, doctor | — |
| POST | `/admissions/:admissionId/procedure-records` | Nurse | `CreateProcedureRecordDto` |

### Wound assessments

| Method | Path | Who | Body |
|--------|------|-----|------|
| GET | `/admissions/:admissionId/wound-assessments` | Nurse, doctor | — |
| POST | `/admissions/:admissionId/wound-assessments` | Nurse | `CreateWoundAssessmentDto` |

### Care plans

| Method | Path | Who | Body |
|--------|------|-----|------|
| GET | `/admissions/:admissionId/care-plans` | Nurse, doctor | — |
| POST | `/admissions/:admissionId/care-plans` | Nurse | `CreateCarePlanDto` |
| PATCH | `/admissions/:admissionId/care-plans/:carePlanId` | Nurse (owner) | `UpdateCarePlanDto` |

### Monitoring charts (structured JSON)

| Method | Path | Who | Body |
|--------|------|-----|------|
| GET | `/admissions/:admissionId/monitoring-charts` | Nurse, doctor | — |
| POST | `/admissions/:admissionId/monitoring-charts` | Nurse | `CreateMonitoringChartDto` |
| PATCH | `/admissions/:admissionId/monitoring-charts/:chartId` | Nurse (owner) | `UpdateMonitoringChartDto` |

**`MonitoringChartType`:** `GCS`, `NEURO`, `CARDIAC`, `SEIZURE`. **`value`:** JSON object — shape is not enforced by the DB; agree per type in the app (e.g. GCS: `{ "eye": 4, "verbal": 5, "motor": 6 }`).

### Handover reports

| Method | Path | Who | Body |
|--------|------|-----|------|
| GET | `/admissions/:admissionId/handover-reports` | Nurse, doctor | — |
| POST | `/admissions/:admissionId/handover-reports` | Nurse | `CreateHandoverReportDto` |

**`shiftType`:** `ShiftType` — `MORNING`, `AFTERNOON`, `NIGHT`.

### Nurse assignments (roster)

| Method | Path | Who | Body |
|--------|------|-----|------|
| GET | `/admissions/:admissionId/nurse-assignments` | Nurse, doctor | — |
| POST | `/admissions/:admissionId/nurse-assignments` | Head nurse, doctor | `CreateNurseAssignmentDto` |
| DELETE | `/admissions/:admissionId/nurse-assignments/:assignmentId` | Head nurse, doctor | — |

**POST:** `nurseId` (**`Staff.id`** of a staff whose `accountType === 'NURSE'`), `shiftDate` (ISO date/datetime; server normalizes to UTC midnight), `shiftType`. Unique per (`nurseId`, `admissionId`, `shiftDate`, `shiftType`). Response includes `nurse: { id, firstName, lastName, staffRole }`.

### Alerts

| Method | Path | Who | Body |
|--------|------|-----|------|
| GET | `/admissions/:admissionId/alerts` | Nurse, doctor | Query: optional `unresolvedOnly=true` |
| POST | `/admissions/:admissionId/alerts` | Nurse, doctor | `CreateAlertLogDto` |
| PATCH | `/admissions/:admissionId/alerts/:alertId/resolve` | Nurse, doctor | optional `ResolveAlertLogDto` |

**Severity:** `AlertSeverity` — `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`. Resolve sets `resolvedById` to JWT `sub` and `resolvedAt` (default now).

## Nurse identity model

- There is no separate `Nurse` table. Every user is a `Staff`.
- `Staff.accountType` includes `NURSE`; `Staff.staffRole` refines it with `HEAD_NURSE`, `INPATIENT_NURSE`, `OUTPATIENT_NURSE` (and other, non-nurse roles).
- On nursing records, the column historically called `nurseId` (or `administeredByNurseId`, `recordedByNurseId`) now stores a **`Staff.id`** directly.
- Response shape of the `nurse` relation on nursing records: `{ id, firstName, lastName, staffRole }`.

## Writes and admission status

Create/update endpoints that record clinical work **reject** if the admission is not `ACTIVE` (`AdmissionStatus`), with a clear error message.

## Flutter screen mapping (suggested)

| Screen | Data source |
|--------|-------------|
| Patient / admission header | `GET /admissions/:id` |
| MAR (orders + given) | `medication-orders` + `medication-administrations` lists or aggregate from admission detail |
| IV management | `iv-fluid-orders` + monitorings sub-resource |
| I/O chart | `intake-output-records` |
| Notes & ward documentation | `nursing-notes`, `procedure-records`, `handover-reports` |
| Wounds & care planning | `wound-assessments`, `care-plans` |
| Neurological / special charts | `monitoring-charts` |
| Assignments | `nurse-assignments` |
| Alerts | `alerts` + optional dashboard `GET /nurses/dashboard/overview` |
| Doctor ward rounds | `GET/POST /ward-round-notes` (separate module) |

## Source of truth

DTO field lists and enums are defined in TypeScript under `src/modules/inpatient-nursing/dto/` and in `prisma/schema.prisma`. Regenerate the OpenAPI document from the running app (`/api`) for the most accurate schema.
