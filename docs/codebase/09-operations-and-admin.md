# Operations, analytics, and admin

These modules do not create the clinical record. They read it, export it, or run the hospital around it.

## Reporting

`GET /reports/...` returns JSON. `?format=csv` or `?format=xlsx` returns a file (`reporting-export.util.ts`).

| Path | Contents |
|---|---|
| `/reports/ward-admissions` | Admissions in a date range, ward history, length of stay |
| `/reports/requests-by-ward` | Lab, radiology, or pharmacy requests grouped by ward. A null ward is reported as OPD |
| `/reports/discharge-history` | Discharged or deceased admissions that have both `billingClearedAt` and `nursesClearedAt` |
| `/reports/medical-records/attendance` | Encounters with diagnosis, lab and radiology requests, and doctor |
| `/reports/medical-records/admissions` | Counts by reason and ward |

Access: medical records, CMD, CMAC, super admin, billing, nursing charge, laboratory, radiology, pharmacy.

## CMAC analytics

`GET /cmac/analytics/...` is read-only. The query is a period plus an `asOf` date. Services are split under `src/modules/cmac-analytics/services/`.

| Path | Focus |
|---|---|
| `overview` | Landing numbers |
| `insights` | Rule-based insights (`limit` default 10) |
| `patient-activity` | Registrations, OPD, admissions, referrals |
| `clinical` | Diagnoses, outcomes, readmissions, length of stay |
| `laboratory` | Volume, turnaround, critical results |
| `pharmacy` | Prescribing, stock, antibiotics, waste |
| `operations` | Appointments, waits, workload, utilisation |
| `quality` | Incidents, infections, complaints, audit flags |
| `staff` | Doctor and lab workload |

The controller lists `CMAC` and `SUPER_ADMIN`. CMD still gets through `AccessGuard` because of the global bypass.

## CMD analytics

`GET /cmd/...` is the hospital command view: dashboard, hospital overview, financial overview, staff oversight, bed snapshot, lab monitoring, alerts, report templates, audit logs, pending approvals, communications, patient experience, and settings overview.

The one write is `POST /cmd/communications/broadcast`, which stores a `CmdCommunication`.

Access on the controller: `CMD`, `CMAC`, `SUPER_ADMIN`.

Related tables that this module reads and writes: `CmdCommunication`, `CmdReportTemplate`, `CmdIntegrationStatus`, `CmdComplianceItem`.

## Quality and safety

`/quality-safety` has four registers. Each supports create, list, get, and patch. There is no `@AccountTypes` list, so any staff token can call them. Patient tokens cannot.

| Path | Model | Typical link |
|---|---|---|
| `/quality-safety/referrals` | `Referral` | Inbound or outbound. Status defaults to `PENDING` |
| `/quality-safety/complaints` | `PatientComplaint` | Patient, severity, status |
| `/quality-safety/incidents` | `SafetyIncident` | Type, severity, status |
| `/quality-safety/infections` | `InfectionCase` | Tied to an admission |

Creates store `req.user.sub` as the author. CMAC quality analytics reads these tables.

## Staff chat and tickets

`src/modules/chat`. Any staff JWT. Patients are denied. There is no account-type list.

HTTP is the history and the file store. Live delivery is Socket.IO (`ChatGateway`).

Connection: the socket sends the staff JWT as `handshake.auth.token` or `handshake.query.token`. The gateway verifies it with `JWT_SECRET` and loads `Staff` by `payload.sub`. The socket joins `conv:{id}` for each conversation the staff member belongs to. A heartbeat runs every 120 seconds.

Guest sockets (`auth.username`, no JWT) exist only when `ALLOW_CHAT_GUEST=true`, or when `NODE_ENV` is not production and the flag is not `false`. Guests cannot emit staff events.

Staff events: `joinConversation`, `leaveConversation`, `sendMessage`, `typing`, `markRead`, `presenceHeartbeat`, `joinTicket`, `sendTicketMessage`. The live message event is `receiveMessage`. Legacy event names (`send_message`, `message_delivered`, `message_read`, `typing_start`, `typing_stop`) are still accepted.

| HTTP | Purpose |
|---|---|
| `GET /chat/online-users`, `/chat/presence/roster`, `/chat/presence/:staffId` | Presence |
| `POST /chat/conversations/direct` and `.../group` | Open a DM or create a group |
| `GET/PATCH /chat/conversations/:id` | Detail and rename |
| Members and admins | `POST/DELETE .../members`, `POST .../admins` |
| `GET/POST .../messages`, `POST .../read` | History, send, mark read |
| `POST /chat/upload/conversation/:id` and `.../ticket/:ticketId` | Attach a file |
| `GET /chat/files/...` | Download. Paths must stay under `uploads/` |

Uploads allow jpeg, png, gif, webp, mp4, webm, pdf, doc, and docx, capped by `CHAT_MAX_FILE_BYTES`.

Tickets (`/tickets`): create, list what this staff member can see, read the thread, post, change status, assign, unassign. Tables are `SupportTicket`, `SupportTicketAssignment`, `SupportTicketMessage`, `SupportTicketAuditLog`. Socket room is `ticket:{id}`.

With `USE_REDIS=false`, presence and Socket.IO rooms stay inside one Node process. A second instance will not see the first instance’s online users.

## Housekeeping

`/housekeeping` is workers, areas, which worker covers which area, shift rosters, and supply logs.

Access: `JANITOR`, `JANITOR_HEAD`, super admin, and CMD through the global bypass. The controller also mounts `JwtAuthGuard` and `AccessGuard` itself; that duplicates the global guards and does not change the result.

Models: `HousekeepingWorker`, `HousekeepingArea`, `HousekeepingAssignment`, `HousekeepingShiftRoster`, `HousekeepingSupplyLog`.

Janitors are excluded from `/department-head/rosters` so shifts are not double-booked in two tables.

## Hospital assets

`/hospital-assets` is department equipment (`HospitalAsset`, logs, access grants). The controller does not list account types. `HospitalAssetsService` enforces scope:

- Operational departments see their own `accountType`.
- `canView` is required to read.
- `canLog` is required to append usage, movement, or maintenance logs.
- Manage rights are required to register an asset, grant access, and transfer it to another department or hospital.

`GET /hospital-assets/me` returns the caller’s grants. `POST /hospital-assets/:id/transfer` moves the asset. `POST /hospital-assets/:id/logs` appends a log (`HospitalAssetLogType`). Status is `HospitalAssetStatus`. Kind is `HospitalAssetKind`.

## Database backup

`src/modules/db-backup`.

- `POST /admin/db-backups` creates a backup now.
- `GET /admin/db-backups` lists files.
- `GET /admin/db-backups/:filename` downloads one.

The controller requires `SUPER_ADMIN`. The service calls `assertSuperAdminOnly`, so CMD does not pass even though the global guard would have allowed the route.

A cron at 23:59 hospital time writes the nightly file unless `DB_BACKUP_ENABLED=false`. The cron does not go through HTTP auth; it runs inside the process.

Command-line equivalents live in `prisma/backup-restore/` (`pnpm run db:backup`, `db:restore`, `db:reset-restore`). Those scripts are separate from the HTTP module. Read `prisma/backup-restore/lib/insert-order.ts` before restoring: insert order has to follow foreign keys.

## Desktop and Android distribution

Both controllers are `@Public()`. Downloads do not need a token. Uploads and deletes need a shared password, not a staff JWT.

| | Windows desktop | Android |
|---|---|---|
| Prefix | `/helty-desktop` | `/imsh-android` |
| Password env | `HELITY_DESKTOP_UPLOAD_PASSWORD` | `IMSH_ANDROID_UPLOAD_PASSWORD` |
| Default password in code | `vesselinc` | `vesselinc` |
| Password sent as | Body `password` or header `x-helty-upload-password` | The Android module’s equivalent field |
| Extra | External executables under `/helty-desktop/assets` | Releases only |

Update checks are `GET .../update/latest` and `GET .../update/manifest`. HTML upload pages are `GET .../ui/upload` and `GET .../ui/downloads`. Large files use a chunked upload (`init`, `chunk/:index`, `complete`). The HTTP server timeout must stay disabled (`HTTP_REQUEST_TIMEOUT_MS=0`) or slow uploads die at Node’s default five minutes.

Change the default password before any public deploy. The route is unauthenticated apart from that secret.

## Mail and SMS

Neither module has a controller.

`MailService` (`src/modules/mail`) sends staff password-reset codes and appointment emails through Postmark. If `POSTMARK_SERVER_TOKEN` or `POSTMARK_FROM` is missing, it logs and returns skipped. Password reset still stores the code.

`SmsService` (`src/modules/sms`) sends appointment SMS through Termii (`POST {TERMII_BASE_URL}/api/sms/send`). Phone numbers are normalised to `234…`. Channel defaults to `dnd`. SMS is not used for password reset or medication reminders (those are email and FCM).

## Audit logs outside finance

`AuditLog` is the general-purpose log. `AuditTrail` is the inpatient chart trail. `InvoiceAuditLog` is billing. `SupportTicketAuditLog` is tickets. `EncounterEditHistory` is the clinical snapshot before a post-completion edit. Accounts and CMD screens read the finance and command subsets. There is no single “audit” module that owns all of them.

## Scheduled jobs in one place

| Job | When | Off switch |
|---|---|---|
| Appointment reminders (today and tomorrow) | 06:00 | No dedicated flag; they no-op if mail and SMS are unconfigured, and they still record notification rows |
| Outpatient dose extension | 06:00 | `PATIENT_MEDICATION_DOSE_CRON_ENABLED=false` |
| Outpatient dose FCM | every 10 min | same |
| Inpatient dose alerts | every 5 min | `MEDICATION_ALERT_CRON_ENABLED=false` |
| Database backup | 23:59 | `DB_BACKUP_ENABLED=false` |
| Open-invoice merge | 23:59 | `INVOICE_CONSOLIDATION_ENABLED=false` |

Timezone for the clock-time jobs is `APPOINTMENT_REMINDER_TIMEZONE`, default `Africa/Lagos`. The five-minute medication alert cron does not set a timezone because it is interval-based.
