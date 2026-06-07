-- CreateEnum
CREATE TYPE "InvoiceItemRefundStatus" AS ENUM ('pending', 'approved', 'rejected', 'cancelled');

-- AlterTable
ALTER TABLE "InvoiceRefund" ADD COLUMN     "invoiceItemId" TEXT;

-- CreateTable
CREATE TABLE "InvoiceItemRefundRequest" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "invoiceItemId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "lineTotal" DECIMAL(12,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "InvoiceItemRefundStatus" NOT NULL DEFAULT 'pending',
    "requestedById" TEXT NOT NULL,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rejectReason" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "executedAt" TIMESTAMP(3),
    "invoiceRefundId" TEXT,

    CONSTRAINT "InvoiceItemRefundRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceItemRefundRequest_invoiceRefundId_key" ON "InvoiceItemRefundRequest"("invoiceRefundId");

-- CreateIndex
CREATE INDEX "InvoiceItemRefundRequest_status_submittedAt_idx" ON "InvoiceItemRefundRequest"("status", "submittedAt");

-- CreateIndex
CREATE INDEX "InvoiceItemRefundRequest_invoiceId_idx" ON "InvoiceItemRefundRequest"("invoiceId");

-- CreateIndex
CREATE INDEX "InvoiceItemRefundRequest_invoiceItemId_idx" ON "InvoiceItemRefundRequest"("invoiceItemId");

-- CreateIndex
CREATE INDEX "InvoiceRefund_invoiceItemId_idx" ON "InvoiceRefund"("invoiceItemId");

-- AddForeignKey
ALTER TABLE "InvoiceRefund" ADD CONSTRAINT "InvoiceRefund_invoiceItemId_fkey" FOREIGN KEY ("invoiceItemId") REFERENCES "InvoiceItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceItemRefundRequest" ADD CONSTRAINT "InvoiceItemRefundRequest_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceItemRefundRequest" ADD CONSTRAINT "InvoiceItemRefundRequest_invoiceItemId_fkey" FOREIGN KEY ("invoiceItemId") REFERENCES "InvoiceItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceItemRefundRequest" ADD CONSTRAINT "InvoiceItemRefundRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceItemRefundRequest" ADD CONSTRAINT "InvoiceItemRefundRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceItemRefundRequest" ADD CONSTRAINT "InvoiceItemRefundRequest_invoiceRefundId_fkey" FOREIGN KEY ("invoiceRefundId") REFERENCES "InvoiceRefund"("id") ON DELETE SET NULL ON UPDATE CASCADE;
