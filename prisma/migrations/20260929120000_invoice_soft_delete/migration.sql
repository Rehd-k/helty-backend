-- AlterEnum
ALTER TYPE "InvoiceStatus" ADD VALUE 'DELETED';

-- AlterEnum
ALTER TYPE "InvoiceAuditAction" ADD VALUE 'INVOICE_DELETED';

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN "deletedAt" TIMESTAMP(3),
ADD COLUMN "deletedById" TEXT;

-- CreateIndex
CREATE INDEX "Invoice_deletedById_idx" ON "Invoice"("deletedById");

-- CreateIndex
CREATE INDEX "Invoice_deletedAt_idx" ON "Invoice"("deletedAt");

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
