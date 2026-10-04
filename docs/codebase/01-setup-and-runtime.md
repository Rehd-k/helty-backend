# Setup and runtime

## Stack

| Piece | Version / choice |
|---|---|
| Runtime | Node.js 22 (Docker image `node:22-bookworm-slim`) |
| Framework | NestJS 11 |
| Language | TypeScript 5.9 |
| Database | PostgreSQL 16 |
| ORM | Prisma 7 with the `@prisma/adapter-pg` driver adapter |
| Package manager | pnpm |
| HTTP | Express (`@nestjs/platform-express`) |
| Realtime | Socket.IO, optional Redis adapter |
| API docs | Swagger at `/api` |
| Logs | Pino (`nestjs-pino`), pretty-printed outside production |
| Auth | Passport JWT (`passport-jwt`) |
| Validation | `class-validator` + `class-transformer` |
| Push | Firebase Admin (FCM) |
| Email | Postmark |
| SMS | Termii |

BullMQ is listed in `package.json`. No module registers a queue. Scheduled work uses `@nestjs/schedule`.

## Prerequisites

- Node 22 and pnpm
- A Postgres database and a `DATABASE_URL`
- For local Docker parity: Docker Compose (`docker-compose.yml` publishes Postgres on host port **5433**)

## Install and run

```bash
pnpm install
pnpm exec prisma generate
pnpm exec prisma migrate deploy
pnpm run start:dev
```

| Script | What it does |
|---|---|
| `pnpm run start` | Compile once and run |
| `pnpm run start:dev` | Watch mode |
| `pnpm run start:prod` | `node dist/main` (local). The Docker image runs `node dist/src/main.js` |
| `pnpm run build` | `prisma generate` then `nest build` with a 4 GB heap |
| `pnpm test` | Jest unit tests (`src/**/*.spec.ts`) |
| `pnpm run test:e2e` | Jest e2e (`test/jest-e2e.json`) |
| `pnpm run seed:db` | `prisma db seed` → `prisma/seed.ts` |
| `pnpm run seed:diagnostics` | Small diagnostics bootstrap (`prisma/seed-diagnostics.ts`) |
| `pnpm run seed:icd10` | ICD-10 codes |
| `pnpm run seed:purchase-items` | Purchase-item catalog |
| `pnpm run db:backup` | JSON backup (`prisma/backup-restore/backup.ts`) |
| `pnpm run db:restore` | Restore that backup |
| `pnpm run db:reset-restore` | Reset then restore |
| `pnpm run db:reset-init-restore` | Same, with `--squash-init` |

Default listen port is `process.env.PORT`, or **4000** when unset (`src/main.ts`). Docker and `.env.example` set `PORT=3000`. Swagger is `http://localhost:<port>/api`.

## Database

`prisma/schema.prisma` is the schema. The datasource URL is **not** in the schema file. Prisma 7 reads it from `prisma.config.ts`, which loads `.env` and `DATABASE_URL`.

`PrismaService` (`src/prisma/prisma.service.ts`) appends `-c timezone=Africa/Lagos` to the connection options unless a timezone is already set. Application “today” for many clinical dates uses `APPOINTMENT_REMINDER_TIMEZONE`, which also defaults to `Africa/Lagos`.

Migrations live in `prisma/migrations/` (77 SQL migrations at the time of this guide). Apply them with `prisma migrate deploy`. Do not edit an already-applied migration; add a new one.

### Seed

`prisma/seed.ts` expects CSV files next to itself (or in `SEED_DATA_DIR`):

| File | Loads |
|---|---|
| `REF_Departments.csv` | `Department` rows. Column `Department`. |
| `REF_Categories.csv` | `ServiceCategory`. Column `Category`. |
| `mian.csv` | `Service` (`searviceCode`, name, cost, department, category). |
| `PHAR.csv` | `Drug` rows. Skipped when `SEED_PROFILE=diagnostics`. |

Every seeded row uses a fixed `createdById` (`c59d31d7-b40c-425b-b1f9-c733fa0d5f02`). That staff row must already exist or the seed fails on the foreign key.

`pnpm run seed:diagnostics` is the path for an empty diagnostics database: it creates an admin and a stub catalog. See [coolify-diagnostics-deploy.md](../coolify-diagnostics-deploy.md).

## Environment variables

Copy `.env.example` to `.env`. Do not commit `.env`. Production boot **refuses** a missing or example `JWT_SECRET` (`src/common/security/jwt-secret.ts`). The example value `this_is_the_best_kept_secerte` is in the weak-secret list.

| Variable | Used for |
|---|---|
| `DATABASE_URL` | Postgres connection |
| `PORT` | HTTP port. Unset means 4000 in `main.ts` |
| `NODE_ENV` | `production` enables the JWT secret check and turns off pino-pretty |
| `JWT_SECRET` | Staff and patient tokens, and the chat socket |
| `USE_REDIS` | `true` enables the Redis client and the Socket.IO Redis adapter |
| `REDIS_URL` | Redis URL when `USE_REDIS=true` |
| `PUBLIC_API_BASE_URL` | Absolute URLs returned for uploads |
| `HOSPITAL_NAME` | Shown in notifications |
| `APPOINTMENT_REMINDER_TIMEZONE` | Cron timezone. Default `Africa/Lagos` |
| `POSTMARK_SERVER_TOKEN`, `POSTMARK_FROM`, `POSTMARK_MESSAGE_STREAM` | Email. Unset means mail is skipped and password-reset codes are only stored |
| `TERMII_API_KEY`, `TERMII_BASE_URL`, `TERMII_SENDER_ID`, `TERMII_CHANNEL`, `TERMII_TYPE` | Appointment SMS |
| `FIREBASE_SERVICE_ACCOUNT_PATH` | FCM credentials. Default `./firebase-service-account.json`. Missing file means pushes are skipped |
| `PATIENT_PORTAL_SYSTEM_STAFF_ID` | Staff id stored as `createdBy` when the patient app writes an appointment |
| `HTTP_JSON_BODY_LIMIT` | JSON body size. Default `10mb` |
| `HTTP_REQUEST_TIMEOUT_MS` | Socket timeout. `0` disables it (needed for large installer uploads) |
| `PRESENCE_AWAY_MINUTES`, `PRESENCE_OFFLINE_AFTER_MINUTES` | Staff chat presence |
| `CHAT_MAX_FILE_BYTES` | Chat upload cap |
| `ALLOW_CHAT_GUEST` | Guest sockets. In production they are off unless this is `true` |
| `HELITY_DESKTOP_UPLOAD_PASSWORD` | Shared password for Windows installer uploads. The env name is spelled `HELITY` |
| `IMSH_ANDROID_UPLOAD_PASSWORD` | Shared password for Android release uploads |
| `DB_BACKUP_ENABLED` | `false` turns off the nightly backup cron |
| `INVOICE_CONSOLIDATION_ENABLED` | `false` turns off the nightly open-invoice merge |
| `PATIENT_MEDICATION_DOSE_CRON_ENABLED` | `false` turns off patient dose reminders |
| `MEDICATION_ALERT_CRON_ENABLED` | `false` turns off inpatient dose-alert sync |
| `SEED_DATA_DIR`, `SEED_PROFILE` | Seed file location |

`CORS_ORIGIN` and `THROTTLE_LIMIT` / `THROTTLE_TTL` appear in `.env.example`. The application does not read them. `main.ts` calls `enableCors({})`, which allows every origin. `@nestjs/throttler` is a dependency and is not registered in `AppModule`.

## Docker

`docker-compose.yml` runs Postgres 16 (`helty` / `helty`, database `helty_diagnostics`, host port 5433) and the API on port 3000. Uploads persist in the `helty_uploads` volume mounted at `/app/uploads`.

```bash
docker compose up --build
docker compose exec api pnpm run seed:diagnostics
```

The image (`Dockerfile`) is a two-stage build: install, `prisma generate`, `nest build`, then a runtime image that keeps `node_modules`, `dist`, `prisma`, and `views` so Coolify can run migrations. The process user is `nestjs` (uid 1001). Container `PORT` is 3000.

## Process startup

`src/main.ts` does this, in order:

1. Refuse to boot in production with a weak `JWT_SECRET`.
2. Create the Nest app with the default body parser off, then install JSON and urlencoded parsers at `HTTP_JSON_BODY_LIMIT`.
3. Set Handlebars (`hbs`) as the view engine, views directory `views/`.
4. If `USE_REDIS=true` and `REDIS_URL` is set, attach `RedisIoAdapter`. Otherwise use the in-process Socket.IO adapter.
5. Enable CORS for all origins.
6. Register `HttpExceptionShapeFilter` and `PrismaExceptionFilter`.
7. Register a global `ValidationPipe` with `whitelist: true` and `transform: true`. Unknown JSON fields are stripped. DTO types are coerced.
8. Mount Swagger at `/api` with bearer auth.
9. Listen, then set the HTTP server timeout from `HTTP_REQUEST_TIMEOUT_MS` (`0` means no timeout).

`AppModule` then applies three global guards and one interceptor on every route. See [Architecture](./02-architecture.md) and [Authentication](./03-authentication-and-access.md).

## Tests

Unit tests sit beside the code (`*.spec.ts`) and run with Jest from `src/`. They cover guards, invoice maths, pharmacy, nursing, patient portal policy, and similar pure logic. They do not boot Postgres.

End-to-end config is `test/jest-e2e.json`.
