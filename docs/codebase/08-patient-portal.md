# Patient portal

The patient app is a second set of controllers, not a second copy of the clinical modules. Routes live under `/patient-auth` and `/patient`. They read the same tables the hospital writes. Writes are limited to profile, appointments, medication adherence, feedback, emergencies, the cycle tracker, and push tokens.

Every `/patient/...` route requires `accountType=PATIENT` and an approved device, except the few marked `@AllowPendingDevice()` (session and device status). Staff tokens are rejected. Details of login and device approval are in [Authentication](./03-authentication-and-access.md).

## Family scope

Front desk creates `PatientFamilyLink` (`POST /frontdesk/patients/:parentId/children`). The app only lists them: `GET /patient/family`.

`resolveSubjectPatientId` allows a `forPatientId` query when that id is the token patient or a linked child. Otherwise the response is `FAMILY_ACCESS_DENIED`.

Modules that honour `forPatientId` on **reads**: appointments list and detail, medications, medical records, lab reports, radiology reports.

Modules that do **not** switch to the child: profile, billing, cycle tracker, feedback, and appointment create / reschedule / cancel (those use `user.sub`).

Medication reminder pushes go to principal parents. If no parent is flagged principal, they go to every linked parent.

## Profile

| Method | Path | |
|---|---|---|
| GET | `/patient/profile` | Portal profile |
| PUT | `/patient/profile` | Email, phone, and/or address. At least one field. Deceased patients cannot update |
| POST | `/patient/profile/photo` | Upload |
| DELETE | `/patient/profile/photo` | Remove |
| GET | `/uploads/patients/:patientId/avatar.jpg` | Public file. No token |

## Appointments

`src/modules/patient-appointments`.

The patient does not choose the doctor. `POST /patient/appointments` creates status `REQUESTED` with `staffId` null. `createdBy` is `PATIENT_PORTAL_SYSTEM_STAFF_ID` from the environment. That staff row must exist.

Supporting reads: `/patient/appointments/dashboard`, `.../specialties`, `.../doctors`, `.../availability`. Slots are 30 minutes from 08:00 to 17:00.

The date must be today or later. `REQUESTED` can be rescheduled or cancelled any time before the visit. Other upcoming statuses need more than 24 hours’ notice (`MIN_HOURS_BEFORE_CHANGE`). `COMPLETED` and `CANCELLED` cannot be changed. Staff confirm or deny on `/appointments/:id/confirm` and `.../deny`, which is not a patient route.

Create, reschedule, and cancel notify through the same appointment notification service as staff bookings (FCM, Postmark, Termii).

## Billing

Read only. Scoped to `user.sub`, not to a child.

| Path | Returns |
|---|---|
| `GET /patient/billing/summary` | Unpaid balance on `PENDING` and `PARTIALLY_PAID` |
| `GET /patient/invoices` | List |
| `GET /patient/invoices/:id` | Items and payments |
| `GET /patient/payments` | Payment history |
| `GET /patient/receipts/:paymentId` | One receipt |

There is no pay endpoint. Cash is taken at the hospital.

## Medications

`src/modules/patient-medications`. This is the outpatient adherence calendar, not the inpatient MAR.

An active medication is an outpatient prescription in `PENDING`, `PARTIALLY_DISPENSED`, or `COMPLETED`, with at least one drug line whose `quantityDispensed` is greater than zero, and whose `endDate` has not passed.

| Path | |
|---|---|
| `GET /patient/medications/dashboard` | Active meds and streak |
| `GET /patient/medications/calendar` | Doses in a range |
| `GET /patient/medications/prescriptions/:id/doses` | Dose log |
| `POST /patient/medications/doses/:doseId/taken` | Mark taken |
| `DELETE .../taken` | Undo |
| `PATCH /patient/medications/prescriptions/:id/schedule-start` | Set when the schedule starts |
| `POST .../confirm-schedule` | Confirm |
| `POST /patient/medications/prescriptions/:id/refill-request` | `PrescriptionRefillRequest` in `PENDING` |

Two crons in this module, both skipped when `PATIENT_MEDICATION_DOSE_CRON_ENABLED=false`:

- 06:00 hospital time extends outpatient dose logs.
- Every 10 minutes marks missed doses and sends FCM, throttled to one nag per 10 minutes.

Pharmacy approves refills on `/pharmacy/refill-requests`. The app does not approve them.

## Chart reads

`/patient/medical-records` lists encounters. `GET /patient/medical-records/:id` adds diagnoses, latest vitals, prescriptions, labs, and radiology. Dashboard and vitals-trend and diagnoses are separate GETs. Allergies and immunizations appear on the dashboard; staff edit them at `/patients/:patientId/allergies` and `.../immunizations`, which is not a patient route.

`/patient/lab-reports` and `/patient/lab-reports/:id` read `LabOrder` plus result fields, units, ranges, and abnormal flags.

`/patient/radiology-reports` hides cancelled items. Detail includes findings, impression, recommendations, and images. Image bytes are `GET /patient/radiology-reports/:reportId/images/:imageId/file`, checked against the same patient or linked child.

`GET /patient/theatre/schedules` is documented with theatre.

## Feedback

`POST /patient/feedback` opens a `PatientFeedback` (`kind`, subject, message, status `OPEN`). The owner can edit or close it only while `OPEN`. Delete sets `CLOSED`; it does not remove the row. Staff reply on `/frontdesk/feedback`, which can set `staffResponse`.

## Emergencies

Signed-in: `POST /patient/emergency-requests` with latitude and longitude. Optional voice (max 5 MB) and video (max 25 MB). The patient can list, open, stream their own media, and cancel only from `SUBMITTED`.

Anonymous: `POST /public/emergency-requests` is public. Name and phone are optional. `patientId` is null.

Staff work the same rows at `/emergency/requests` (nurses, physicians, emergency roles, matron, super admin, CMD):

```
SUBMITTED → ACKNOWLEDGED → DISPATCHED → CLOSED
     └────────── CANCELLED from any non-terminal state ──────────┘
```

Status changes push FCM when `patientId` is set.

## Cycle tracker

`/patient/cycle` is the token patient only. Settings default to a 28-day cycle and a 5-day period. Periods cannot overlap. An ongoing pregnancy sets `pregnancyPaused` and stops predictions. Flow is `LIGHT`, `MEDIUM`, or `HEAVY`.

## Devices and push

| Path | Pending device allowed? |
|---|---|
| `GET /patient/devices` | No |
| `GET /patient/devices/status` | Yes |
| `PATCH /patient/devices/current/fcm-token` | Yes. Token is unique; the previous owner is cleared |
| `DELETE /patient/devices/:id` | Yes, if it is one of mine |

Staff broadcast is `POST /notifications/custom` (CMAC, CMD, or super admin), stored as `CustomPushNotification`. Targets are all devices or a list of patient ids.

`FcmService.sendToPatient` only sends to `APPROVED` devices that have a token. `sendToDevice` can reach a still-pending device, which is how approval notifications work. Invalid tokens are cleared.

## Health content and announcements

Patients: `GET /patient/health/campaigns` and `GET /patient/health/news` return rows that are published and not expired.

Staff edit them at `/health-content/campaigns` and `/health-content/news` (medical records, CMD, CMAC, super admin).

`GET /system-announcements/active` is public so a client can show banners before login. Other announcement routes are super admin, CMD, CMAC, or `ADMIN`.
