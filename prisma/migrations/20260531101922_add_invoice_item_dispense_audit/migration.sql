-- AlterTable
ALTER TABLE "InvoiceItem" ADD COLUMN     "dispensaryLocationId" TEXT,
ADD COLUMN     "dispensedAt" TIMESTAMP(3),
ADD COLUMN     "dispensedById" TEXT;

-- CreateIndex
CREATE INDEX "InvoiceItem_dispensedById_idx" ON "InvoiceItem"("dispensedById");

-- CreateIndex
CREATE INDEX "InvoiceItem_dispensaryLocationId_idx" ON "InvoiceItem"("dispensaryLocationId");

-- CreateIndex
CREATE INDEX "InvoiceItem_dispensedAt_idx" ON "InvoiceItem"("dispensedAt");

-- AddForeignKey
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_dispensedById_fkey" FOREIGN KEY ("dispensedById") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_dispensaryLocationId_fkey" FOREIGN KEY ("dispensaryLocationId") REFERENCES "PharmacyLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
