# Helty backend — codebase guide

Helty is a hospital management API. One NestJS process serves the staff desktop and web apps, the patient mobile app, and a few public pages (desktop installer, Android releases, emergency guest requests). PostgreSQL is the system of record. Prisma is the only database client.

This guide is written so a new engineer can understand the product and find the code that implements it. It describes behaviour as the source implements it, including names that look like typos because clients already depend on them.

## Read this first

A hospital day in this codebase is a chain of records, not a single “visit” object.

1. **Patient.** Front desk registers a `Patient`. A ward named `OPD` must exist. If no phone number is stored, the row is a one-time (unregistered) patient and does not get a hospital `patientId`.
2. **Invoice.** Almost every billable action lands on the patient’s open `Invoice`. A patient has at most one invoice in `PENDING` or `PARTIALLY_PAID`. Creating another invoice for that patient updates the open one.
3. **Consultation credit.** A paid line in the service category `Consultations & Reviews` becomes a credit: up to **2** outpatient visits within **14** days. The nursing queue is the list of those paid invoices, not the old `WaitingPatient` table.
4. **Encounter.** A doctor starts an `Encounter`. An outpatient start consumes one credit and links the invoice. Completing the encounter settles that consultation line.
5. **Orders.** From the encounter the doctor requests labs, imaging, and drugs. Those requests create invoice lines. Departments perform the work only after the line is paid, unless the patient is actively admitted (inpatient credit).
6. **Admission.** Admitting from an encounter completes that encounter, sets `Patient.status` to `ADMITED` (spelled that way in the schema), and starts the inpatient chart. Discharge needs both nurses clearance and billing clearance before the patient returns to the OPD ward. Outcome `Death` skips that two-step clearance and sets the patient to `DECEASED`.

Money, stock, and clinical status stay in separate tables and are updated together inside services. If you change one side of a flow (for example settling a drug line), read the service that also moves pharmacy stock and medication-request status.

## How the repository is laid out

```
src/main.ts                 process entry: HTTP, Swagger, websockets
src/app.module.ts           every feature module and the global guards
src/common/                 guards, filters, decorators, shared utils
src/prisma/                 PrismaService (Postgres, Africa/Lagos)
src/redis/                  optional Redis client and Socket.IO adapter
src/modules/<feature>/      one Nest module per product area
prisma/schema.prisma        all tables and enums
prisma/migrations/          SQL migrations
prisma/seed.ts              CSV seed of departments, categories, services, drugs
views/index.hbs             public landing page at GET /
docs/                       deploy notes and this guide
```

There is **no global URL prefix**. `GET /patients` is the patients list. Swagger UI is at `/api`.

Each feature folder follows the same Nest shape: `*.module.ts` wires providers, `*.controller.ts` is the HTTP surface, `*.service.ts` holds the rules, `dto/` is the validated request body. Some large areas (lab, pharmacy, invoice, accounts, obstetrics) split one module across several controllers.

## Guide map

| Chapter | What it answers |
|---|---|
| [01 — Setup and runtime](./01-setup-and-runtime.md) | How to run, configure, seed, and deploy |
| [02 — Architecture](./02-architecture.md) | Request path, modules, time, errors, files |
| [03 — Authentication and access](./03-authentication-and-access.md) | Staff login, patient devices, roles |
| [04 — Patient journey](./04-patient-journey.md) | Registration through encounter and admission |
| [05 — Billing and finance](./05-billing-and-finance.md) | Invoices, HMO, discounts, payments, accounts |
| [06 — Diagnostics, pharmacy, supply](./06-diagnostics-pharmacy-supply.md) | Lab, radiology, drugs, store, purchases |
| [07 — Inpatient and specialties](./07-inpatient-and-specialties.md) | Nursing chart, obstetrics, theatre, dialysis |
| [08 — Patient portal](./08-patient-portal.md) | Everything under `/patient` and `/patient-auth` |
| [09 — Operations and admin](./09-operations-and-admin.md) | Analytics, chat, quality, assets, backups, apps |
| [10 — Data model](./10-data-model.md) | Every Prisma model, grouped by domain |

Older notes that are still accurate for their own topic:

- [Coolify diagnostics deploy](../coolify-diagnostics-deploy.md)
- [Coolify diagnostics verification](../coolify-diagnostics-verification.md)
- [Client `createdBy` display](../client-createdby-display-guide.md)

## Words that mean something specific

| Word in code | Meaning |
|---|---|
| `accountType` | Department the staff member belongs to (`PHYSICIAN`, `NURSE`, `LABORATORY`, …). |
| `staffRole` | Job title inside that department (`CONSULTANT`, `WARD_CHARGE_NURSE`, …). |
| `patientId` | Human hospital number on `Patient`. The UUID primary key is `Patient.id`. |
| `invoiceID` | Human invoice number. The UUID primary key is `Invoice.id`. |
| `ONG` | Access token for physicians who are not medical students. Used on clinical write routes. |
| `INPATIENT_DOCTOR` | Legacy access token. Matches a physician whose role is resident, intern, house officer, or medical officer. |
| `ADMITED` | Inpatient patient status. The schema spelling is missing a second T. |
| `searviceCode` | Service and drug catalog code. The schema spelling is missing an R. |
| Consultation credit | Paid `Consultations & Reviews` line that still has visits left and has not expired. |
| Inpatient credit | An `ACTIVE` admission lets lab, radiology, dialysis, and pharmacy consume an unpaid line. |
| Coverage | HMO or discount that reduces what the patient owes. It is not cash. |
| `WaitingPatient` | Legacy queue table. The live nursing queue reads paid invoices. |

## Where to change things

| You want to… | Start here |
|---|---|
| Add an HTTP route | The feature’s `*.controller.ts`, then the service. New routes are protected unless marked `@Public()`. |
| Change who may call a route | `@AccountTypes(...)` or `@Roles(...)` on the handler. Matching rules are in `src/common/guards/access.guard.ts`. |
| Change how a bill is priced or paid | `src/modules/invoice/invoice.service.ts` and `coverage/coverage.service.ts`. |
| Change outpatient queue rules | `src/modules/waiting-patient/waiting-patient.service.ts` and consultation-credit helpers on the invoice service. |
| Change lab result rules | `src/modules/lab/lab-result/lab-result.service.ts`. |
| Change dispensing | `src/modules/invoice/invoice-drug.service.ts` (settling a drug line), not the pharmacy controllers. |
| Add a table | `prisma/schema.prisma`, then a migration. Generate the client before the app will compile. |
