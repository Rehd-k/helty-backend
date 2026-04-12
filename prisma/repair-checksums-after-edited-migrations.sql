-- One-time repair after editing already-applied migrations (wallet enum fix).
-- Run: npx prisma db execute --file prisma/repair-checksums-after-edited-migrations.sql
-- Does not delete data; only updates checksums in _prisma_migrations.

UPDATE "_prisma_migrations"
SET checksum = '68b77134fedd48f2226dfc0f03e1b94f4e3296ea063c90ffce8310f646fa5c1c'
WHERE migration_name = '20260406123000_invoice_only_cutover';

UPDATE "_prisma_migrations"
SET checksum = 'a9d9e794559b825cfef51dc1f096510ef53baa4e13ac46c7f57388a3d552eefe'
WHERE migration_name = '20260410143842_big_update';
