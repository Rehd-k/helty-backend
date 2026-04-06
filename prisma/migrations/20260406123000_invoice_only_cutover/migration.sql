-- Invoice-only billing cutover
-- Adds invoice human ID and invoice audit logs,
-- migrates insurance claims to invoice,
-- and removes transaction-domain tables.

-- 1) New enums
CREATE TYPE "InvoicePaymentMethod" AS ENUM ('CASH', 'CARD', 'TRANSFER', 'INSURANCE', 'WAIVER');
CREATE TYPE "InvoiceAuditAction" AS ENUM (
  'PAYMENT_RECEIVED',
  'REFUND_ISSUED',
  'WALLET_DEPOSIT',
  'ITEM_ADDED',
  'ITEM_UPDATED',
  'ITEM_REMOVED'
);

-- 2) Invoice.invoiceID (human-readable id)
ALTER TABLE "Invoice" ADD COLUMN "invoiceID" TEXT;

-- Backfill invoiceID with unique uppercase alphanumeric 10-char ids
DO $$
DECLARE
  v_invoice_id TEXT;
  v_id TEXT;
BEGIN
  FOR v_id IN SELECT "id" FROM "Invoice" WHERE "invoiceID" IS NULL LOOP
    LOOP
      SELECT string_agg(substr('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ', (1 + floor(random() * 36))::int, 1), '')
      INTO v_invoice_id
      FROM generate_series(1, 10);
      EXIT WHEN NOT EXISTS (SELECT 1 FROM "Invoice" WHERE "invoiceID" = v_invoice_id);
    END LOOP;

    UPDATE "Invoice" SET "invoiceID" = v_invoice_id WHERE "id" = v_id;
  END LOOP;
END$$;

ALTER TABLE "Invoice" ALTER COLUMN "invoiceID" SET NOT NULL;
CREATE UNIQUE INDEX "Invoice_invoiceID_key" ON "Invoice"("invoiceID");
CREATE INDEX "Invoice_invoiceID_idx" ON "Invoice"("invoiceID");

-- 3) InvoicePayment method enum rename
ALTER TABLE "InvoicePayment"
  ALTER COLUMN "method" TYPE "InvoicePaymentMethod"
  USING ("method"::text::"InvoicePaymentMethod");

-- 4) Invoice audit logs
CREATE TABLE "InvoiceAuditLog" (
  "id" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "action" "InvoiceAuditAction" NOT NULL,
  "description" TEXT NOT NULL,
  "metadata" JSONB,
  "performedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InvoiceAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "InvoiceAuditLog_invoiceId_createdAt_idx" ON "InvoiceAuditLog"("invoiceId", "createdAt");
ALTER TABLE "InvoiceAuditLog"
  ADD CONSTRAINT "InvoiceAuditLog_invoiceId_fkey"
  FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InvoiceAuditLog"
  ADD CONSTRAINT "InvoiceAuditLog_performedById_fkey"
  FOREIGN KEY ("performedById") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 5) InsuranceClaim remap: transactionId -> invoiceId
ALTER TABLE "InsuranceClaim" ADD COLUMN "invoiceId" TEXT;

UPDATE "InsuranceClaim" ic
SET "invoiceId" = t."invoiceId"
FROM "Transaction" t
WHERE ic."transactionId" = t."id";

-- For a pre-live project: drop any orphan claims that cannot be linked to an invoice
DELETE FROM "InsuranceClaim" WHERE "invoiceId" IS NULL;

ALTER TABLE "InsuranceClaim" ALTER COLUMN "invoiceId" SET NOT NULL;
ALTER TABLE "InsuranceClaim"
  ADD CONSTRAINT "InsuranceClaim_invoiceId_fkey"
  FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "InsuranceClaim_invoiceId_idx" ON "InsuranceClaim"("invoiceId");

-- 6) Remove invoice/line-item legacy transaction links
ALTER TABLE "InvoiceItem" DROP CONSTRAINT IF EXISTS "InvoiceItem_transactionItemId_fkey";
DROP INDEX IF EXISTS "InvoiceItem_transactionItemId_key";
ALTER TABLE "InvoiceItem" DROP COLUMN IF EXISTS "transactionItemId";

ALTER TABLE "InvoiceItemPayment" DROP CONSTRAINT IF EXISTS "InvoiceItemPayment_transactionId_fkey";
DROP INDEX IF EXISTS "InvoiceItemPayment_transactionId_idx";
ALTER TABLE "InvoiceItemPayment" DROP COLUMN IF EXISTS "transactionId";

-- Remove old InsuranceClaim -> Transaction FK before dropping Transaction table
ALTER TABLE "InsuranceClaim" DROP CONSTRAINT IF EXISTS "InsuranceClaim_transactionId_fkey";

-- 7) Remove transaction-domain tables
DROP TABLE IF EXISTS "TransactionAuditLog";
DROP TABLE IF EXISTS "TransactionRefund";
DROP TABLE IF EXISTS "TransactionDiscount";
DROP TABLE IF EXISTS "TransactionPayment";
DROP TABLE IF EXISTS "TransactionItem";
DROP TABLE IF EXISTS "Transaction";

-- 8) Drop transaction FK column from InsuranceClaim after remap
ALTER TABLE "InsuranceClaim" DROP COLUMN IF EXISTS "transactionId";

-- 9) Drop obsolete enum types
DROP TYPE IF EXISTS "TransactionAuditAction";
DROP TYPE IF EXISTS "DiscountType";
DROP TYPE IF EXISTS "TransactionStatus";
DROP TYPE IF EXISTS "TransactionPaymentMethod";
