-- One-time repair after editing already-applied migrations (wallet enum fix).
-- Run: npx prisma db execute --file prisma/repair-checksums-after-edited-migrations.sql
-- Does not delete data; only updates checksums in _prisma_migrations.

UPDATE "_prisma_migrations"
SET checksum = '68b77134fedd48f2226dfc0f03e1b94f4e3296ea063c90ffce8310f646fa5c1c'
WHERE migration_name = '20260406123000_invoice_only_cutover';

UPDATE "_prisma_migrations"
SET checksum = '46eda44b2af09ad59a36a96fb9d7add928763493230f6ba3c01c6d217b82c6f6'
WHERE migration_name = '20260410143842_big_update';
