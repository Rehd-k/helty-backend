-- AlterEnum: WALLET on InvoicePaymentMethod (no-op if already present).
-- Uses exception handling so shadow DB / replay / partially-patched DBs never hit duplicate label errors.
DO $migration$
BEGIN
  ALTER TYPE "InvoicePaymentMethod" ADD VALUE 'WALLET';
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END
$migration$;
