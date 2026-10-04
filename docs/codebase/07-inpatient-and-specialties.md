# Inpatient care and specialties

Admission itself is in [Patient journey](./04-patient-journey.md). This chapter is what happens after the patient has a bed: the nursing chart, maternity, theatre, and dialysis.

## Nursing organisation

`src/modules/nursing` is rosters and assignments. The chart is `src/modules/inpatient-nursing`. The home screen is `src/modules/nurses-dashboard`.

`NursingUnit`: `INPATIENT_WARD`, `ICU`, `EMERGENCY`, `OPD`, `ONG`.

`ShiftType`: `MORNING`, `AFTERNOON`, `NIGHT`.

`/nursing/rosters` writes `NurseShiftRoster`. A matron can roster any unit. A charge nurse is limited to their own unit. A ward on the roster row must match the unit. This is why department-head generic rosters reject nurses.

`/nursing/assignments/inpatient` lists `NurseAssignment` rows (the write API is under the admission). `/nursing/assignments/outpatient` assigns a nurse to an OPD or O&G queue invoice. One assignment per invoice. The invoice must sit in the nursing queue (`assertInvoiceInNursingQueue`).

`GET /nurses/dashboard/me` tells the client which screen to open. Matron is hospital-wide. Charge views filter to the unit. Line nurses see their own assignments. OPD and O&G charge views use the outpatient assignments.

## The inpatient chart

Every write is under `/admissions/:admissionId/...`. The admission must be `ACTIVE` or `PENDING_BILLING_CLEARANCE`. `DISCHARGED`, `TRANSFERRED`, and `DECEASED` reject nursing writes.

| Path under the admission | Record | Notes |
|---|---|---|
| `nurse-assignments` | `NurseAssignment` | Unique on nurse + admission + shift date + shift type |
| `medication-orders` | `MedicationOrder` | Requires the admission’s encounter. Creates a dose schedule |
| `medication-dose-schedules` | `MedicationOrderSchedule` | Read only |
| `medication-administrations` | `MedicationAdministration` | `GIVEN`, `MISSED`, `REFUSED`, `DELAYED`. Update is the authoring nurse only |
| `iv-fluid-orders` | `IVFluidOrder` | `ACTIVE`, `COMPLETED`, `STOPPED` |
| `iv-fluid-orders/:orderId/monitorings` | `IVMonitoring` | Rate, site, complications |
| `intake-output-records` | `IntakeOutputRecord` | `INTAKE` or `OUTPUT`. Categories include oral, IV, urine, stool, drain, vomit, blood, other |
| `nursing-notes` | `NursingNote` | `GENERAL`, `INCIDENT`, `SHIFT_SUMMARY` |
| `procedure-records` | `ProcedureRecord` | |
| `wound-assessments` | `WoundAssessment` | Optional photo, served at `.../photo` |
| `care-plans` | `CarePlan` | Author-only update |
| `monitoring-charts` | `MonitoringChart` | `GCS`, `NEURO`, `CARDIAC`, `SEIZURE` as JSON |
| `handover-reports` | `HandoverReport` | Per shift |
| `alerts` | `AlertLog` | Create, list, and `PATCH .../resolve` |

A `GIVEN` administration that includes a dispensary `locationId` bills a settled drug line (`billSettledDrugDispenseLine`) and deducts FIFO stock. Quantity is rounded up. That is a second dispense path beside pharmacy settling a billed request. Both end in invoice drug stock movements.

Medication dose alerts are raised by `medication-schedule` (every five minutes) as `MEDICATION_DOSE_DUE`, `MEDICATION_DOSE_OVERDUE`, and `MEDICATION_COURSE_EXPIRED`. Nurses can also create a `GENERIC` alert. Severity is `LOW`, `MEDIUM`, `HIGH`, or `CRITICAL`.

Author-only updates apply to administrations, intake/output, nursing notes, care plans, and monitoring charts. The check is `existing.nurseId === actor` (or the equivalent field on that model).

`AuditTrail` is written from these services for chart changes.

## Obstetrics

`src/modules/obstetrics`. A `Pregnancy` belongs to the mother (`Patient`). Status is `ONGOING` (default), `DELIVERED`, `LOST`, or `TERMINATED`. Creating a labour record sets `DELIVERED`. Delivered, lost, and terminated are terminal for further pregnancy edits in the clinical helpers.

| Route | Record |
|---|---|
| `/obstetrics/pregnancies` | `Pregnancy`. `GET .../:id/clinical-orders` and `.../clinical-results` collect medication, lab, and radiology for that pregnancy |
| `POST /obstetrics/pregnancies/:pregnancyId/visits` | `AntenatalVisit` |
| `POST /obstetrics/pregnancies/:pregnancyId/labour-deliveries` | `LabourDelivery`. May point at an `Admission`. Fetch by admission at `GET /obstetrics/admissions/:admissionId/labour-delivery` |
| `POST /obstetrics/labour-deliveries/:id/partogram` | `PartogramEntry` |
| `POST /obstetrics/labour-deliveries/:id/babies` | `Baby` |
| `POST /obstetrics/babies/:id/register-patient` | Creates a `Patient` for the baby and links `Baby.registeredPatient` |
| `/obstetrics/postnatal-visits` | `PostnatalVisit` type `MOTHER` or `BABY` |
| `/obstetrics/gynae-procedures` | `GynaeProcedure` |

Enums you will see on the labour record: presentation (`CEPHALIC`, `BREECH`, `TRANSVERSE`, `UNKNOWN`), mode (`SVD`, `ASSISTED_VAGINAL`, `CS_ELECTIVE`, `CS_EMERGENCY`, `BREECH`, `TWIN`, `OTHER`), outcome (`LIVE_BIRTH`, `STILLBIRTH`, `OTHER`), baby sex (`M`, `F`, `U`).

Antenatal billing uses the default clinical package (`GET /clinical-packages/default-antenatal`) and invoice helpers `createAntenatalPackageServiceItem` / `createAntenatalPackageDrugItem`. Those lines carry `clinicalPackageItemId`. Lab requests, medication orders, and radiology orders may set `pregnancyId` so they show up on the pregnancy chart without a separate encounter-only query.

The patient cycle tracker treats an ongoing pregnancy as a pause. That lives in the patient app, not in this module.

## Theatre

`src/modules/theatre`.

```
REQUESTED → SCHEDULED → IN_PROGRESS → COMPLETED → BILLED
                └──────────── CANCELLED (before the case starts) ────────────┘
```

`POST /surgery-requests` books from an encounter. Priority is `ROUTINE`, `URGENT`, or `EMERGENCY`.

`POST /theatre/schedules` puts a `REQUESTED` case into a `TheatreRoom` and sets `SCHEDULED`. Rooms are `/theatre/rooms`.

`POST /theatre/cases/:surgeryRequestId/start` requires `SCHEDULED` and sets `IN_PROGRESS`.

`PATCH /theatre/cases/:surgeryRequestId` updates findings, notes, and the team. Staff roles on the case are `SURGEON`, `ASSISTANT`, `SCRUB`, `CIRCULATING`, `ANAESTHETIST`.

Operative notes can be added while `IN_PROGRESS` or `COMPLETED`.

`POST .../complete` requires `IN_PROGRESS`.

Consumables can be recorded while `IN_PROGRESS` or `COMPLETED`. An unbilled consumable line can be deleted. Billing (`POST .../bill`) requires `COMPLETED`, refuses a second service invoice line, creates the surgery service line through `InvoiceService.createWithServiceItem`, then bills billable consumables that are not yet invoiced. Status becomes `BILLED`.

`POST .../transfer` moves the patient to a recovery ward or bed.

`GET /patient/theatre/schedules` is the patient app’s view of their own bookings (and linked children’s, through the family helper).

## Dialysis

`src/modules/dialysis`. One controller: `/dialysis/sessions`.

`DialysisSessionStatus`: `PENDING` → `IN_PROGRESS` → `COMPLETED`, or `CANCELLED` from `PENDING` or `IN_PROGRESS`.

If the create body includes any of `invoiceId`, `invoiceItemId`, or `serviceId`, all three are required. The line must be a dialysis category service (`Dialysis` or `Dialysis Services`) and not already consumed. An active admission can use an unpaid line. Outpatients need it paid.

`POST /dialysis/sessions/:id/consumables` is allowed on `IN_PROGRESS` or `COMPLETED`. It deducts store stock. Billable consumables attach to the session invoice when that invoice is still `PENDING` or `PARTIALLY_PAID` for the same patient. Otherwise a new open invoice is used.

A session linked to an invoice line blocks a refund request on that line. Deleted invoices are excluded from session lists.

## How these modules share a patient

```
Encounter ──creates──► SurgeryRequest ──schedule──► TheatreCase ──bill──► InvoiceItem
    │
    ├── LabRequest ──bench──► LabOrder
    ├── RadiologyOrder
    ├── MedicationOrder ──admission──► administrations, IV, I/O, notes
    └── Pregnancy ──labour──► Baby ──register──► new Patient

Admission (ACTIVE) unlocks unpaid consumption of lab, radiology, dialysis, and drug lines.
```
