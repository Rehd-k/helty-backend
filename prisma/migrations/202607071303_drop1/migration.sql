-- AlterEnum (idempotent): Prisma may re-emit ADD VALUE for WALLET; it is already present after
-- 20260406123000_invoice_only_cutover + 20260410143842_big_update on a full replay.
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
