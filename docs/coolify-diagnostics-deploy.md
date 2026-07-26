# Deploy Helty Diagnostics API on Coolify (no forks)

Use the **same** [`backend`](../) git repository for hospital and diagnostics.
Each customer gets a Coolify Application + Postgres + uploads volume.

Do **not** fork this repo per customer.

## Architecture

| Resource | Hospital stack | Diagnostics customer stack |
|----------|----------------|----------------------------|
| Coolify app | e.g. `helty-hospital-api` | e.g. `helty-diagnostics-customer-api` |
| Postgres | hospital DB | **new** empty DB |
| JWT | hospital secret | **new** secret |
| Volume | `/app/uploads` (hospital) | `/app/uploads` (customer) |
| Flutter client | `lib/main.dart` | `lib/main_diagnostics.dart` + `API_BASE_URL` |

## 1. Create Coolify resources

1. Create a **PostgreSQL** database in Coolify for the customer (empty).
2. Create a new **Application** pointing at this backend repo (Dockerfile build).
3. Attach a **persistent storage** mount: host/volume path → container `/app/uploads`.
4. Set the public HTTPS domain (e.g. `api.diagnostics-customer.example`).

## 2. Configure environment

Use [coolify-diagnostics.env.example](./coolify-diagnostics.env.example) as the checklist.

Critical rules:

- Distinct `DATABASE_URL` from hospital
- Distinct `JWT_SECRET` (production boot fails on missing/example secrets)
- `PUBLIC_API_BASE_URL` = the Coolify HTTPS URL (no trailing slash)
- `PORT=3000` (Coolify proxies to the container port)
- `USE_REDIS=false` for a single-instance first deploy

## 3. Deploy

On first deploy the container entrypoint runs:

```text
prisma migrate deploy → node dist/main.js
```

Hospital CSV seeds are **not** run automatically.

Confirm:

```bash
curl -sS https://api.diagnostics-customer.example/server-time
```

## 4. Seed once (diagnostics profile)

In Coolify → Application → Execute command (or one-off):

```bash
pnpm run seed:diagnostics
```

This creates:

- SUPER_ADMIN staff (`SEED_ADMIN_*` env)
- Minimal Laboratory / Radiology / Front Desk / Billing departments
- Stub lab + radiology services from `prisma/seeds/diagnostics/`
- **No** pharmacy formulary / IMSH hospital price list

Then change the admin password after first login.

## 5. Verify isolation

See [coolify-diagnostics-verification.md](./coolify-diagnostics-verification.md).

## 6. Backup and restore

### Database

Against the customer `DATABASE_URL` (from a machine that can reach Postgres):

```bash
pnpm run db:backup
pnpm run db:restore
```

Also enable Coolify / Postgres snapshots for that database.

### Uploads volume

Back up the Coolify persistent volume mounted at `/app/uploads` separately from hospital.

### Restore drill (exit criterion)

1. Create a scratch Postgres database.
2. Restore a customer backup into it.
3. Confirm patients/invoices belong only to that customer (empty or customer-only).
4. Confirm hospital DB was untouched.

## 7. Point Helty Diagnostics desktop

From the Flutter `helty` repo:

```powershell
flutter run -d windows -t lib/main_diagnostics.dart `
  --dart-define=API_BASE_URL=https://api.diagnostics-customer.example
```

Release:

```powershell
flutter build windows -t lib/main_diagnostics.dart `
  --dart-define=API_BASE_URL=https://api.diagnostics-customer.example
```

Local Docker smoke test (optional):

```bash
docker compose up --build
docker compose exec api pnpm run seed:diagnostics
```

## Local compose ports

| Service | Host port |
|---------|-----------|
| API | `3000` |
| Postgres | `5433` → container `5432` |
