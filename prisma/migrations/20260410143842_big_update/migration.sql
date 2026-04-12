-- AlterEnum (idempotent: WALLET may already exist on InvoicePaymentMethod if DB was patched manually
-- or an earlier migration created the type with it — avoids P3006 / duplicate label on shadow + deploy)
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_enum e
    JOIN pg_catalog.pg_type t ON e.enumtypid = t.oid
    JOIN pg_catalog.pg_namespace n ON t.typnamespace = n.oid
    WHERE n.nspname = current_schema()
      AND t.typname = 'InvoicePaymentMethod'
      AND e.enumlabel = 'WALLET'
  ) THEN
    ALTER TYPE "InvoicePaymentMethod" ADD VALUE 'WALLET';
  END IF;
END
$migration$;
