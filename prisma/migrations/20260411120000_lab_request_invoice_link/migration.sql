-- AlterTable
ALTER TABLE "LabRequest" ADD COLUMN "invoiceId" TEXT,
ADD COLUMN "invoiceItemId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "LabRequest_invoiceItemId_key" ON "LabRequest"("invoiceItemId");

-- AddForeignKey
ALTER TABLE "LabRequest" ADD CONSTRAINT "LabRequest_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabRequest" ADD CONSTRAINT "LabRequest_invoiceItemId_fkey" FOREIGN KEY ("invoiceItemId") REFERENCES "InvoiceItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
