# Helty hospital API

Hospital management backend: NestJS, Prisma, PostgreSQL. One process serves staff apps, the patient app, billing, lab, radiology, pharmacy, inpatient care, and admin analytics.

The full guide is [docs/codebase/README.md](docs/codebase/README.md). Start there. It explains how a patient, an invoice, and an encounter fit together, then links to setup, auth, and each domain.

```bash
pnpm install
pnpm exec prisma generate
pnpm exec prisma migrate deploy
pnpm run start:dev
```

Swagger is at `/api`. There is no global route prefix.

Diagnostics deploys that share this repo are described in [docs/coolify-diagnostics-deploy.md](docs/coolify-diagnostics-deploy.md).
