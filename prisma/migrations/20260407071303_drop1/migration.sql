-- AlterEnum: WALLET may already exist on InvoicePaymentMethod (see 20260406123000_invoice_only_cutover).
-- Idempotent: avoids P3006 duplicate enum label on shadow replay.
DO $migration$
BEGIN
  ALTER TYPE "InvoicePaymentMethod" ADD VALUE 'WALLET';
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
  WHEN OTHERS THEN
    IF SQLERRM ILIKE '%already exists%' THEN
      NULL;
    ELSE
      RAISE;
    END IF;
END
$migration$;
