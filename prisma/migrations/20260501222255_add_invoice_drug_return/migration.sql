-- AlterEnum
ALTER TYPE "InvoiceAuditAction" ADD VALUE 'DRUG_RETURNED';

-- CreateTable
CREATE TABLE "InvoiceDrugReturn" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "invoiceItemId" TEXT,
    "drugId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "dispensaryLocationId" TEXT NOT NULL,
    "performedById" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoiceDrugReturn_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InvoiceDrugReturn_invoiceId_createdAt_idx" ON "InvoiceDrugReturn"("invoiceId", "createdAt");

-- CreateIndex
CREATE INDEX "InvoiceDrugReturn_drugId_idx" ON "InvoiceDrugReturn"("drugId");

-- CreateIndex
CREATE INDEX "InvoiceDrugReturn_dispensaryLocationId_idx" ON "InvoiceDrugReturn"("dispensaryLocationId");

-- AddForeignKey
ALTER TABLE "InvoiceDrugReturn" ADD CONSTRAINT "InvoiceDrugReturn_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceDrugReturn" ADD CONSTRAINT "InvoiceDrugReturn_invoiceItemId_fkey" FOREIGN KEY ("invoiceItemId") REFERENCES "InvoiceItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceDrugReturn" ADD CONSTRAINT "InvoiceDrugReturn_drugId_fkey" FOREIGN KEY ("drugId") REFERENCES "Drug"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceDrugReturn" ADD CONSTRAINT "InvoiceDrugReturn_dispensaryLocationId_fkey" FOREIGN KEY ("dispensaryLocationId") REFERENCES "PharmacyLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceDrugReturn" ADD CONSTRAINT "InvoiceDrugReturn_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
