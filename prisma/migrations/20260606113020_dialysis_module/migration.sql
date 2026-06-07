-- CreateEnum
CREATE TYPE "DialysisSessionStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "AccountType" ADD VALUE 'DIALYSIS';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "StaffRole" ADD VALUE 'DIALYSIS_HEAD';
ALTER TYPE "StaffRole" ADD VALUE 'DIALYSIS_NURSE';
ALTER TYPE "StaffRole" ADD VALUE 'DIALYSIS_TECH';
ALTER TYPE "StaffRole" ADD VALUE 'DIALYSIS_RECEPTIONIST';

-- CreateTable
CREATE TABLE "DialysisSession" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "status" "DialysisSessionStatus" NOT NULL DEFAULT 'PENDING',
    "invoiceId" TEXT,
    "invoiceItemId" TEXT,
    "serviceId" TEXT,
    "doctorId" TEXT,
    "performedById" TEXT,
    "machineId" TEXT,
    "notes" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DialysisSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DialysisSessionConsumable" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "consumableId" TEXT NOT NULL,
    "storeLocationId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "invoiceId" TEXT,
    "invoiceItemId" TEXT,
    "usageEventId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "DialysisSessionConsumable_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DialysisSession_invoiceItemId_key" ON "DialysisSession"("invoiceItemId");

-- CreateIndex
CREATE INDEX "DialysisSession_patientId_idx" ON "DialysisSession"("patientId");

-- CreateIndex
CREATE INDEX "DialysisSession_status_idx" ON "DialysisSession"("status");

-- CreateIndex
CREATE INDEX "DialysisSession_createdAt_idx" ON "DialysisSession"("createdAt");

-- CreateIndex
CREATE INDEX "DialysisSession_invoiceItemId_idx" ON "DialysisSession"("invoiceItemId");

-- CreateIndex
CREATE INDEX "DialysisSessionConsumable_sessionId_idx" ON "DialysisSessionConsumable"("sessionId");

-- CreateIndex
CREATE INDEX "DialysisSessionConsumable_consumableId_idx" ON "DialysisSessionConsumable"("consumableId");

-- CreateIndex
CREATE INDEX "DialysisSessionConsumable_storeLocationId_idx" ON "DialysisSessionConsumable"("storeLocationId");

-- AddForeignKey
ALTER TABLE "DialysisSession" ADD CONSTRAINT "DialysisSession_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DialysisSession" ADD CONSTRAINT "DialysisSession_invoiceItemId_fkey" FOREIGN KEY ("invoiceItemId") REFERENCES "InvoiceItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DialysisSession" ADD CONSTRAINT "DialysisSession_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DialysisSession" ADD CONSTRAINT "DialysisSession_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DialysisSession" ADD CONSTRAINT "DialysisSession_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DialysisSession" ADD CONSTRAINT "DialysisSession_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DialysisSessionConsumable" ADD CONSTRAINT "DialysisSessionConsumable_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DialysisSessionConsumable" ADD CONSTRAINT "DialysisSessionConsumable_invoiceItemId_fkey" FOREIGN KEY ("invoiceItemId") REFERENCES "InvoiceItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DialysisSessionConsumable" ADD CONSTRAINT "DialysisSessionConsumable_usageEventId_fkey" FOREIGN KEY ("usageEventId") REFERENCES "ConsumableUsageEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DialysisSessionConsumable" ADD CONSTRAINT "DialysisSessionConsumable_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DialysisSessionConsumable" ADD CONSTRAINT "DialysisSessionConsumable_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "DialysisSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DialysisSessionConsumable" ADD CONSTRAINT "DialysisSessionConsumable_consumableId_fkey" FOREIGN KEY ("consumableId") REFERENCES "Consumable"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DialysisSessionConsumable" ADD CONSTRAINT "DialysisSessionConsumable_storeLocationId_fkey" FOREIGN KEY ("storeLocationId") REFERENCES "StoreLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
