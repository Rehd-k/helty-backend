-- AlterTable
ALTER TABLE "MedicationAdministration" ADD COLUMN "invoiceItemId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "MedicationAdministration_invoiceItemId_key" ON "MedicationAdministration"("invoiceItemId");

-- CreateIndex
CREATE INDEX "MedicationAdministration_invoiceItemId_idx" ON "MedicationAdministration"("invoiceItemId");

-- AddForeignKey
ALTER TABLE "MedicationAdministration" ADD CONSTRAINT "MedicationAdministration_invoiceItemId_fkey" FOREIGN KEY ("invoiceItemId") REFERENCES "InvoiceItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
