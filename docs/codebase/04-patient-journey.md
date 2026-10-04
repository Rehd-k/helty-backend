# Patient journey

This chapter is the path from the front door to the ward. Billing details are in [Billing](./05-billing-and-finance.md). Orders placed during the visit are in [Diagnostics and pharmacy](./06-diagnostics-pharmacy-supply.md).

## Registration

Module: `src/modules/patient`. Controller: `PatientController` at `/patients`.

`POST /patients` creates the chart. Rules that surprise people:

- A ward whose name is `OPD` must exist. If `wardId` is omitted, the patient is attached to it. Status defaults to `OUTPATIENT`.
- Phone numbers are unique. `forceCreate` does not bypass a phone clash.
- The same name and date of birth returns **409** with code `PATIENT_SIMILAR_MATCHES` unless `forceCreate` is true. Search that set with `GET` or `POST /patients/similar-matches`.
- A phone number is what makes the row a registered patient. `PatientService` generates `patientId` only when a phone is present. No phone means the hospital number is cleared and the row is a one-time patient.
- `searchName` is maintained for multi-word name search.

`GET /patients` is public. `GET /patients/search` matches name, hospital number, email, and phone, and returns at most 10 rows. `GET /patients/:id/chart` is the longitudinal chart. The `include` query picks sections: encounters, admissions, medications, labs, radiology, vitals, allergies, appointments, invoices, payments, wallet, histories, doctor reports, archived encounters.

`POST /patients/merge` moves foreign keys from a duplicate onto a survivor. Front desk and medical records may only merge a one-time duplicate into a registered survivor. Super admin may merge any pair. Two wallets have their balances added. Devices that would collide are deleted. A circular family link is dropped.

`DELETE /patients/:id` is super admin only and fails with 409 if any dependent row remains.

Moving a patient onto the ward named `OPD` forces `status = OUTPATIENT`.

## Appointments

Staff API: `src/modules/appointment`, `/appointments`.

`Appointment.status` is a **string**, not an enum. The patient app uses `REQUESTED`, `CONFIRMED`, `PENDING`, `CANCELLED`, `COMPLETED`. Older rows also use `scheduled`, `rescheduled`, and `no_show`. The portal mapper treats `scheduled` and `rescheduled` as confirmed, and `no_show` as completed.

Staff `POST /appointments` stores the status the client sends and notifies the patient (push, email, SMS). Notification failure is logged and does not fail the request. Reschedule and cancel notify as well. Delete does not notify.

Patient-app bookings arrive as `REQUESTED` with no doctor. Medical records or front desk lists them at `GET /appointments/requests` and then:

- `POST /appointments/:id/confirm` — only from `REQUESTED`. Assigns an active physician. Location is that doctor’s consulting room (`location`, otherwise `name`). Status becomes `CONFIRMED`.
- `POST /appointments/:id/deny` — sets `CANCELLED`.

Confirm and deny do **not** put the patient on the nursing queue. The queue starts when a consultation is paid.

`GET /appointments/upcoming` looks for raw status `scheduled` or `rescheduled` with a date in the future. It does not list `CONFIRMED`. Clients that only write portal statuses will not see those rows here.

An appointment may point at an encounter. The encounter’s patient must match.

## The nursing queue

Module: `src/modules/waiting-patient`.

`GET /waiting-patients` returns paid invoices, and the row id **is the invoice id**. A row is included when all of these are true:

- Patient status is `OUTPATIENT` and `patientId` is set (`unregisteredOnly` flips that).
- Invoice status is `PAID`.
- Some line is still unsettled, in category `Consultations & Reviews`, with `consultationVisitsConsumed < 2` and `consultationCreditExpiresAt` in the future.

`seen` is true when `Invoice.encounterId` is set. Patching the queue cannot set `seen`.

`POST /waiting-patients/:id/send-to-room` requires vitals already linked to that invoice, then sets `Invoice.consultingRoomId`.

`POST` and `DELETE /waiting-patients` return **410 Gone**.

The front-desk dashboard (`GET /frontdesk/dashboard/queue`) still reads the legacy `WaitingPatient` table plus today’s ongoing outpatient encounters. It is a different list from `GET /waiting-patients`.

## Consulting rooms

`/consulting-rooms` is a small catalog: name, location, capacity, and the doctor (`staffId`). Confirming an appointment copies the room onto the appointment. Sending a queue invoice to a room stores the room id on the invoice. Deleting a room is blocked while any legacy `WaitingPatient` still points at it. Invoices that reference the room do not block the delete.

## Vitals

`/patient-vitals`. A reading must be tied to **exactly one** of: a legacy waiting-patient row, an admission, an invoice, or an encounter. The nursing queue uses the invoice link. If that invoice already has vitals, a second create updates the same row. The body patient id must match the parent record. The service stores BMI as sent; it does not calculate it.

## Encounters

Module: `src/modules/encounter`. This is the clinical document: history, exam, SOAP, procedures, diagnoses.

`EncounterStatus`: `ONGOING` (default) → `COMPLETED`. `CANCELLED` cannot be edited. A completed encounter cannot be moved back to `ONGOING` through update.

`EncounterType`: `OUTPATIENT`, `EMERGENCY`, `INPATIENT_REVIEW`, `TELEMEDICINE`, `FOLLOW_UP`.

Starting care:

- `POST /encounters/outpatient/start` (and the legacy `POST /encounters/start-outpatient`) requires a consumable consultation credit. It links the invoice and consumes the visit when the encounter is completed.
- `POST /encounters` with `encounterType: OUTPATIENT` does the same. Other types do not consume consultation credit.
- If an `ONGOING` encounter already exists for the same patient, type, and admission (both null for outpatient), the call returns **200** and that row instead of creating another.

`PATCH /encounters/:id/complete` sets `COMPLETED` and, for outpatient encounters, settles the consultation lines.

Who may edit (`EncounterEditPolicyService`):

- The treating doctor.
- On a shared inpatient encounter (admission still `ACTIVE`), any physician except `MEDICAL_STUDENT`.
- Super admin and CMD.
- After completion, clinical edits write `EncounterEditHistory` with the snapshot from **before** the edit. List those at `GET /encounters/:id/edit-history`.

`proceduresJson` can bill services and consumables. Consumable lines need a `storeLocationId`.

Diagnoses are `EncounterDiagnosis` rows (code strings, not a foreign key to `Icd10Code`). Add, list, update, and delete them under `/encounters/:encounterId/diagnoses`.

`GET /encounters/:id?expand=` loads medication orders, lab orders, the appointment, specialty modules, and clinical sections. `expand=*` loads all of them.

`DELETE /encounters/:id` returns 200 with a message. It does not check the edit policy.

### Templates and specialty forms

`/encounter-templates` is a doctor’s private prefill (history, SOAP, ICD, specialty JSON). Names are unique per doctor. Nothing copies a template onto an encounter automatically; the client does that.

`GET /clinical/specialties` is a static catalog in code, not a table. On an encounter:

- `PUT /encounters/:id/specialty-modules` replaces the enabled specialties and their section keys.
- `PUT /encounters/:id/clinical-sections/:specialty/:sectionKey` writes the JSON for a section that is already enabled.

Writes use the encounter edit policy. Reads are wider (nursing and medical records included).

`/icd10` is read-only. Seed it with `pnpm run seed:icd10`. Search by code prefix or description. Encounter diagnoses store the code text; they do not reference `Icd10Code.id`.

## Admission and discharge

Module: `src/modules/admission`. Wards and beds: `src/modules/ward`.

`POST /admissions` requires an encounter for that patient that is not already linked to an admission. In one transaction it:

- Creates `Admission` as `ACTIVE`.
- Sets `Encounter.admissionId` and completes the encounter.
- Sets `Patient.status` to `ADMITED` and `Patient.wardId`.
- Writes `AdmissionWardHistory` with reason `Admission`.

`Encounter.admissionId` is unique: one encounter, one admission. Later inpatient reviews are new `INPATIENT_REVIEW` encounters or ward-round notes. They are not a second admission link.

`PATCH /admissions/:id` without `dischargeDate` can change ward and bed and writes history reason `Ward/bed change`. The service does **not** set `Bed.status`. Bed flags (`AVAILABLE`, `OCCUPIED`, `CLEANING`, `RESERVED`) change only through `PATCH /wards/beds/:id`.

Discharge is `PATCH` with `dischargeDate` and `outcome`, and only from `ACTIVE`:

| Outcome | Result |
|---|---|
| `Death` | Status `DECEASED`, patient `DECEASED`, ward cleared. Both clearance timestamps are stamped immediately. |
| Anything else | Status `PENDING_BILLING_CLEARANCE`, bed unlinked. If every linked invoice is already paid, `billingClearedAt` is set in the same update. |

Then:

- `POST /admissions/:id/nurses-clearance` stamps `nursesClearedAt`.
- `POST /admissions/:id/billing-clearance` stamps `billingClearedAt` only when invoices are paid.

When **both** timestamps exist, status becomes `DISCHARGED` and the patient returns to `OUTPATIENT` on the ward named `OPD`. The enum also contains `TRANSFERRED`; this service never sets it.

`GET /admissions/active` filters `dischargeDate: null`, not `status: ACTIVE`. `DELETE /admissions/:id` is a hard delete with no status check.

Wards have a type (`GENERAL`, `ICU`, `ISOLATION`) and optional price multipliers (`drugPricePercentage`, `servicePricePercentage`). The OPD ward is found by name, compared case-insensitively after trim. There is no ward delete endpoint.

## Ward rounds and other notes

`POST /ward-round-notes` writes SOAP against an admission. The author is the logged-in doctor. Update is limited to that doctor. At least one SOAP field must be non-empty. `GET /ward-rounds/today?doctorId=` lists that doctor’s active admissions and the latest note for the UTC day.

`/medical-histories` is free-text past history on the patient, separate from the encounter. `/doctor-reports` is a narrative report, optionally linked to an encounter. On an encounter whose admission is still `ACTIVE`, the report’s `doctorId` is forced to the logged-in physician.

## Departments

`/departments` is a unique name plus an optional head (`Staff`). Staff, wards, and services point at a department. Deleting a department fails at the database if those rows remain.

`/department-head` lets a department head list staff of their `accountType` and maintain `DepartmentShiftRoster`. Nurses and janitors are rejected with “this department uses its own shift roster” because they have `NurseShiftRoster` and `HousekeepingShiftRoster`.

## Front desk extras

`/frontdesk/dashboard/summary` and `/queue` are the desk home screen. Summary counts use a mix of appointments, legacy waiting rows, paid consultation lines, and admissions that moved today.

The same controller family approves patient devices and links parents to children (`PatientFamilyLink`). A person cannot be linked as their own child, and the reverse link is rejected. Patient-app family reads are in [Patient portal](./08-patient-portal.md).

Feedback from the app is reviewed at `/frontdesk/feedback` (`OPEN` → `IN_REVIEW` → `RESOLVED` or `CLOSED`).

## Status picture

```
Patient.status
  OUTPATIENT ──admit──► ADMITED ──discharge finalized──► OUTPATIENT
                └─ outcome Death ─► DECEASED

Encounter.status
  ONGOING ──complete or admit──► COMPLETED
  (CANCELLED is terminal for edits)

Admission.status
  ACTIVE ──dischargeDate──► PENDING_BILLING_CLEARANCE
                              │ both clearances
                              ▼
                           DISCHARGED
  ACTIVE ──outcome Death──► DECEASED
```
