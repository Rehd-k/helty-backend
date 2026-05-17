-- AlterTable
ALTER TABLE "MedicationOrder" ADD COLUMN "invoiceItemId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "MedicationOrder_invoiceItemId_key" ON "MedicationOrder"("invoiceItemId");

-- CreateIndex
CREATE INDEX "MedicationOrder_invoiceItemId_idx" ON "MedicationOrder"("invoiceItemId");

-- AddForeignKey
ALTER TABLE "MedicationOrder" ADD CONSTRAINT "MedicationOrder_invoiceItemId_fkey" FOREIGN KEY ("invoiceItemId") REFERENCES "InvoiceItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
