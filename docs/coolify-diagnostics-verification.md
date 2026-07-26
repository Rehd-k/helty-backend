# Phase 3 exit criteria — Diagnostics Coolify checklist

Complete this after the first diagnostics customer stack is live.

## Isolation

- [ ] Customer Coolify app does **not** use the hospital `DATABASE_URL`
- [ ] Customer `JWT_SECRET` is unique (not hospital, not `.env.example`)
- [ ] Customer uploads volume is separate from hospital `/app/uploads`
- [ ] `HOSPITAL_NAME` / branding matches the diagnostics customer
- [ ] `PUBLIC_API_BASE_URL` points at the customer HTTPS hostname only

## Empty / clean data

- [ ] Fresh Postgres before first migrate (no hospital dump restored by mistake)
- [ ] After `seed:diagnostics`, patient count is zero
- [ ] No hospital invoices, encounters, or pharmacy stock present
- [ ] Service catalog is diagnostics stubs only (lab/radiology/consultation) — no PHAR formulary

## Runtime

- [ ] `GET /server-time` succeeds on the customer URL
- [ ] Login works with seeded SUPER_ADMIN
- [ ] Production boot refuses weak/missing `JWT_SECRET` (spot-check by temporarily misconfiguring a staging clone)
- [ ] Container restarts re-run `prisma migrate deploy` without re-seeding hospital CSVs

## Backup / restore

- [ ] `pnpm run db:backup` (or Coolify snapshot) succeeds for customer DB
- [ ] Restore into a scratch DB succeeds
- [ ] Hospital database unchanged after restore drill
- [ ] Uploads volume backup procedure documented for this Coolify app

## Flutter client

- [ ] Diagnostics build uses `-t lib/main_diagnostics.dart`
- [ ] `--dart-define=API_BASE_URL=https://…` matches this stack only
- [ ] App title / menus are diagnostics-scoped (no doctor/pharmacy/CMD menus)
- [ ] Login and a simple patient register → bill → lab/radiology flow works against the customer API

## Sign-off

| Check | Date | By |
|-------|------|----|
| Isolation | | |
| Clean data | | |
| Runtime | | |
| Backup/restore | | |
| Flutter client | | |
