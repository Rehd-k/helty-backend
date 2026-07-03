-- CreateTable
CREATE TABLE "DispenseBatchAllocation" (
    "id" TEXT NOT NULL,
    "invoiceItemId" TEXT NOT NULL,
    "dispensationId" TEXT,
    "drugId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitCost" DECIMAL(12,2) NOT NULL,
    "unitSellingPrice" DECIMAL(12,2) NOT NULL,
    "payerType" TEXT,
    "dispensedById" TEXT,
    "dispensedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DispenseBatchAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DispenseBatchAllocation_dispensedAt_idx" ON "DispenseBatchAllocation"("dispensedAt");

-- CreateIndex
CREATE INDEX "DispenseBatchAllocation_locationId_dispensedAt_idx" ON "DispenseBatchAllocation"("locationId", "dispensedAt");

-- CreateIndex
CREATE INDEX "DispenseBatchAllocation_drugId_dispensedAt_idx" ON "DispenseBatchAllocation"("drugId", "dispensedAt");

-- CreateIndex
CREATE INDEX "DispenseBatchAllocation_batchId_idx" ON "DispenseBatchAllocation"("batchId");

-- CreateIndex
CREATE INDEX "DispenseBatchAllocation_invoiceItemId_idx" ON "DispenseBatchAllocation"("invoiceItemId");

-- AddForeignKey
ALTER TABLE "DispenseBatchAllocation" ADD CONSTRAINT "DispenseBatchAllocation_invoiceItemId_fkey" FOREIGN KEY ("invoiceItemId") REFERENCES "InvoiceItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DispenseBatchAllocation" ADD CONSTRAINT "DispenseBatchAllocation_dispensationId_fkey" FOREIGN KEY ("dispensationId") REFERENCES "Dispensation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DispenseBatchAllocation" ADD CONSTRAINT "DispenseBatchAllocation_drugId_fkey" FOREIGN KEY ("drugId") REFERENCES "Drug"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DispenseBatchAllocation" ADD CONSTRAINT "DispenseBatchAllocation_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "DrugBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DispenseBatchAllocation" ADD CONSTRAINT "DispenseBatchAllocation_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "PharmacyLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DispenseBatchAllocation" ADD CONSTRAINT "DispenseBatchAllocation_dispensedById_fkey" FOREIGN KEY ("dispensedById") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
