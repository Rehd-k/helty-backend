-- AlterTable
ALTER TABLE "PrescriptionRefillRequest" ADD COLUMN     "invoiceItemId" TEXT,
ADD COLUMN     "pharmacyNotes" TEXT,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedByStaffId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "PrescriptionRefillRequest_invoiceItemId_key" ON "PrescriptionRefillRequest"("invoiceItemId");

-- CreateIndex
CREATE INDEX "PrescriptionRefillRequest_status_createdAt_idx" ON "PrescriptionRefillRequest"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PrescriptionRefillRequest_one_pending_per_prescription" ON "PrescriptionRefillRequest"("prescriptionId") WHERE status = 'PENDING';

-- AddForeignKey
ALTER TABLE "PrescriptionRefillRequest" ADD CONSTRAINT "PrescriptionRefillRequest_reviewedByStaffId_fkey" FOREIGN KEY ("reviewedByStaffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrescriptionRefillRequest" ADD CONSTRAINT "PrescriptionRefillRequest_invoiceItemId_fkey" FOREIGN KEY ("invoiceItemId") REFERENCES "InvoiceItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
