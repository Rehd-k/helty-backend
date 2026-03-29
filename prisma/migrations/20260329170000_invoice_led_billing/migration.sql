-- AlterEnum (ignore if re-run on older PG without IF NOT EXISTS — run once)
ALTER TYPE "InvoicePaymentSource" ADD VALUE 'CARD';
ALTER TYPE "InvoicePaymentSource" ADD VALUE 'INSURANCE';
ALTER TYPE "InvoicePaymentSource" ADD VALUE 'WAIVER';

-- AlterTable InvoiceItem
ALTER TABLE "InvoiceItem" ADD COLUMN "transactionItemId" TEXT;
ALTER TABLE "InvoiceItem" ADD COLUMN "customDescription" TEXT;
ALTER TABLE "InvoiceItem" ADD COLUMN "createdById" TEXT;

-- AlterTable InvoicePayment
ALTER TABLE "InvoicePayment" ADD COLUMN "method" "TransactionPaymentMethod";
ALTER TABLE "InvoicePayment" ADD COLUMN "reference" TEXT;
ALTER TABLE "InvoicePayment" ADD COLUMN "notes" TEXT;
ALTER TABLE "InvoicePayment" ADD COLUMN "receivedById" TEXT;
ALTER TABLE "InvoicePayment" ADD COLUMN "bankId" TEXT;
ALTER TABLE "InvoicePayment" ADD COLUMN "createdById" TEXT;
ALTER TABLE "InvoicePayment" ADD COLUMN "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable WalletTransaction
ALTER TABLE "WalletTransaction" ADD COLUMN "createdById" TEXT;

-- CreateTable InvoiceRefund
CREATE TABLE "InvoiceRefund" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "processedById" TEXT NOT NULL,
    "createdById" TEXT,
    "refundedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoiceRefund_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "InvoiceRefund_invoiceId_refundedAt_idx" ON "InvoiceRefund"("invoiceId", "refundedAt");

-- InvoiceItemPayment: allow transactionId null, add invoicePaymentId
ALTER TABLE "InvoiceItemPayment" DROP CONSTRAINT IF EXISTS "InvoiceItemPayment_transactionId_fkey";
ALTER TABLE "InvoiceItemPayment" ALTER COLUMN "transactionId" DROP NOT NULL;
ALTER TABLE "InvoiceItemPayment" ADD COLUMN "invoicePaymentId" TEXT;

CREATE INDEX "InvoiceItemPayment_invoicePaymentId_idx" ON "InvoiceItemPayment"("invoicePaymentId");

-- Foreign keys for InvoiceRefund
ALTER TABLE "InvoiceRefund" ADD CONSTRAINT "InvoiceRefund_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InvoiceRefund" ADD CONSTRAINT "InvoiceRefund_processedById_fkey" FOREIGN KEY ("processedById") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InvoiceRefund" ADD CONSTRAINT "InvoiceRefund_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- InvoiceItem -> TransactionItem
CREATE UNIQUE INDEX "InvoiceItem_transactionItemId_key" ON "InvoiceItem"("transactionItemId");
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_transactionItemId_fkey" FOREIGN KEY ("transactionItemId") REFERENCES "TransactionItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- InvoicePayment relations
ALTER TABLE "InvoicePayment" ADD CONSTRAINT "InvoicePayment_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InvoicePayment" ADD CONSTRAINT "InvoicePayment_bankId_fkey" FOREIGN KEY ("bankId") REFERENCES "Bank"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InvoicePayment" ADD CONSTRAINT "InvoicePayment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- WalletTransaction createdBy
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Re-add optional Transaction FK on InvoiceItemPayment; InvoicePayment FK
ALTER TABLE "InvoiceItemPayment" ADD CONSTRAINT "InvoiceItemPayment_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InvoiceItemPayment" ADD CONSTRAINT "InvoiceItemPayment_invoicePaymentId_fkey" FOREIGN KEY ("invoicePaymentId") REFERENCES "InvoicePayment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Index on InvoicePayment.paidAt
CREATE INDEX "InvoicePayment_paidAt_idx" ON "InvoicePayment"("paidAt");
