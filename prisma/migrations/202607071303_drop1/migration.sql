-- WALLET is already present after earlier migrations; guard for shadow DB replay (P3006).
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_enum e
    INNER JOIN pg_catalog.pg_type t ON t.oid = e.enumtypid
    INNER JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'InvoicePaymentMethod'
      AND e.enumlabel = 'WALLET'
  ) THEN
    ALTER TYPE "InvoicePaymentMethod" ADD VALUE 'WALLET';
  END IF;
END
$migration$;
