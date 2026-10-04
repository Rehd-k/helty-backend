# Architecture

## One process, many modules

`AppModule` (`src/app.module.ts`) imports infrastructure once, then every feature module. There is no microservice split. A request never leaves this process except for Postgres, Redis (optional), Postmark, Termii, and Firebase.

```
Client
  │  Bearer JWT, or no token on @Public() routes
  ▼
Express
  │  body limit, CORS, Handlebars for a few HTML pages
  ▼
JwtAuthGuard → AccessGuard → ApprovedDeviceGuard
  ▼
Controller  (DTO already validated)
  ▼
Service     (Prisma, sometimes another module's exported service)
  ▼
PostgreSQL
  │
  ▼
LocalTimestampInterceptor   (adds local time fields on JSON bodies)
```

Feature modules export services when another module must call them. The important shared ones are `InvoiceService` (billing, consultation credit, drug lines), `EncounterEditPolicyService`, pharmacy `DrugStockService`, and store stock services. Prefer calling the exported service over writing another module’s tables directly. Several clinical services still call `PrismaService` for those tables; when you do that, keep the status transitions described in the domain chapters.

## Module catalog

Paths are under `src/modules/` unless noted.

| Module | Responsibility |
|---|---|
| `auth`, `staff` | Staff identity, login, password reset |
| `patient-auth`, `patient-profile`, `patient-family`, `patient-cycle` | Patient app identity, profile, children, cycle tracker |
| `patient`, `frontdesk`, `appointment`, `waiting-patient`, `consulting-room` | Registration, desk dashboard, bookings, nursing queue, rooms |
| `encounter`, `encounter-template`, `clinical-specialty`, `icd10` | The visit note, templates, specialty forms, diagnosis codes |
| `admission`, `ward`, `department`, `department-head` | Stay, beds, org structure, generic shift roster |
| `patient-vitals`, `medical-history`, `doctor-report`, `ward-round-notes` | Observations and narrative notes |
| `patient-clinical-records` | Allergies and immunizations (staff) |
| `patient-archived-encounter` | Scanned historical visits |
| `invoice`, `payment`, `bank`, `hmo`, `discount`, `receivables`, `service`, `clinical-package` | Catalog, bills, cover, cash |
| `accounts`, `billing-analytics` | Finance back office and billing dashboards |
| `lab`, `lab-request`, `lab-report` | Bench catalog and orders, clinician requests, free-text reports |
| `radiology`, `radiology-report` | Imaging workflow and free-text reports |
| `pharmacy`, `prescription`, `medication-order`, `medication-request`, `medication-schedule` | Catalog, stock, clinical drug orders, dose timing |
| `store`, `purchases` | Consumables and non-drug procurement |
| `nursing`, `inpatient-nursing`, `nurses-dashboard` | Rosters, the inpatient chart, nurse home screens |
| `obstetrics`, `theatre`, `dialysis` | Maternity, surgery, dialysis sessions |
| `patient-appointments`, `patient-billing`, `patient-medications`, `patient-medical-records`, `patient-lab-reports`, `patient-radiology-reports`, `patient-feedback`, `patient-emergency` | Patient app reads and a few writes |
| `emergency-requests` | Staff emergency queue |
| `chat`, `fcm`, `mail`, `sms` | Staff chat, push, email, SMS |
| `health-content`, `system-announcements` | Published health content and banners |
| `reporting`, `cmac-analytics`, `cmd-analytics`, `quality-safety` | Exports, executive dashboards, safety registers |
| `housekeeping`, `hospital-assets` | Janitorial roster and department equipment |
| `db-backup` | Postgres backup files |
| `helty-desktop`, `imsh-android` | Installer distribution |
| `src/prisma`, `src/redis` | Database and cache/presence |

`AppController` serves `GET /` (Handlebars `views/index.hbs`) and `GET /server-time`. Both are public.

## A typical controller

```ts
@Controller('encounters')
export class EncounterController {
  @Post('outpatient/start')
  @AccountTypes('ONG', 'CONSULTANT', 'INPATIENT_DOCTOR')
  startOutpatient(@Body() dto: StartOutpatientEncounterDto, @Req() req) {
    return this.encounterService.startOutpatient(dto, req.user);
  }
}
```

- The class path plus the method path is the URL.
- `@AccountTypes` is metadata. `AccessGuard` reads it. It is not a Nest built-in.
- `@Public()` on a method or class skips all three global guards.
- The JWT payload is `req.user`. Staff id is `req.user.sub`.
- Services throw Nest HTTP exceptions (`BadRequestException`, `NotFoundException`, `ForbiddenException`). The exception filters shape the JSON.

## Validation and errors

`ValidationPipe` is global:

- `whitelist: true` drops properties that are not on the DTO.
- `transform: true` turns query strings into numbers and enum values when the DTO says so.

HTTP errors from `HttpException` are passed through `HttpExceptionShapeFilter`. If the exception body includes a string `code`, the response is:

```json
{
  "statusCode": 403,
  "error": "Forbidden",
  "code": "DEVICE_PENDING_APPROVAL",
  "message": "..."
}
```

Other HTTP exceptions keep Nest’s usual `{ statusCode, message, error }` shape. Prisma errors (unique violations, missing foreign keys) are translated by `PrismaExceptionFilter` so clients do not see raw driver errors.

## Time on responses

`LocalTimestampInterceptor` walks every JSON response and adds local-time companions for `Date` values via `appendLocalTimestamps` (`src/common/utils/datetime.ts`). Buffers (file downloads) and plain strings are left alone. The database session timezone is `Africa/Lagos`. Cron jobs that mean “6:00 in the hospital” use `APPOINTMENT_REMINDER_TIMEZONE`.

Some clinical dates are stored at UTC midnight (`WardRoundNote.roundDate`). Read the service before assuming a timestamp is a hospital-local civil date.

## IDs

| Kind | Example | Where |
|---|---|---|
| UUID primary key | `Patient.id`, `Invoice.id` | Almost every table |
| Human patient number | `Patient.patientId` | Generated on registration when a phone exists |
| Human invoice number | `Invoice.invoiceID` | Generated when an invoice is created |
| Human staff number | `Staff.staffId` | Set when the staff row is created |

`src/common/utils/human-readable-id.util.ts` builds the human ids. Search by person name uses `Patient.searchName`, a lowercased concatenation of the name parts, plus `patient-name-search.util.ts`.

## Files on disk

Uploads live under `uploads/` (Docker volume `/app/uploads`):

- Patient avatars, served publicly at `GET /uploads/patients/:patientId/avatar.jpg`
- Radiology images, wound photos, archived encounter scans
- Chat and ticket attachments
- Emergency voice and video
- Helty desktop and IMSH Android release binaries
- Database backup files from `db-backup`

Returned URLs are prefixed with `PUBLIC_API_BASE_URL` where the client must download them later. File reads check that the resolved path stays inside `uploads/`.

## Realtime

`ChatGateway` (`src/modules/chat/chat.gateway.ts`) is a Socket.IO gateway on the default namespace. It is the only websocket in the app. Presence and unread counts use Redis when `USE_REDIS=true`. With Redis off, that state is in memory and is correct only for a single Node process. More than one API instance without Redis will split chat presence and Socket.IO rooms.

## Background work

All of it is `@Cron` inside the API process. Nothing is queued.

| Cron | Schedule | Module |
|---|---|---|
| Day-of and day-before appointment reminders | 06:00 hospital time | `appointment` |
| Outpatient dose extension and FCM reminders | 06:00, and every 10 minutes | `patient-medications` |
| Inpatient medication dose alerts | every 5 minutes | `medication-schedule` |
| Nightly database backup | 23:59 hospital time | `db-backup` |
| Merge extra open invoices | 23:59 hospital time | `invoice` |

Each job has an env flag to turn it off. See [Setup](./01-setup-and-runtime.md).

## Logging

`LoggerModule` from `nestjs-pino` logs each HTTP request at info. In development the transport is `pino-pretty`. Services use Nest’s `Logger` for domain warnings (notification failures, skipped pushes). A failed email or SMS does not fail the HTTP request that triggered it.

## What is intentionally legacy

These still exist so old clients keep working. New money and new queue behaviour should not be built on them.

| Surface | Current behaviour |
|---|---|
| `POST` and `DELETE /waiting-patients` | `410 Gone`. The live queue is `GET /waiting-patients` over paid invoices. |
| `POST`, `PATCH`, `DELETE /payments` | `410 Gone`. Cash is `InvoicePayment`. `GET /payments` still reads the old `Payment` table. |
| `LabReport`, `RadiologyReport` | Free-text documents. Structured results are `LabResult` and `RadiologyStudyReport`. |
| `Dispensation` | Counted on the pharmacy dashboard. Live stock moves when an invoice drug line is settled. |
| `DrugCatalog`, `LegacyLabCatalog`, `LegacyLabOrder` | Older catalog tables kept in the schema. |
| `POST /encounters/start-outpatient` | Same handler as `POST /encounters/outpatient/start`. |
