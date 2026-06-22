-- CreateEnum
CREATE TYPE "MedicationRequestStatus" AS ENUM ('REQUESTED', 'BILLED', 'DISPENSED', 'CANCELLED');

-- AlterTable
ALTER TABLE "MedicationOrder" ALTER COLUMN "status" SET DEFAULT 'Prescribed';

-- CreateTable
CREATE TABLE "MedicationRequest" (
    "id" TEXT NOT NULL,
    "medicationOrderId" TEXT NOT NULL,
    "encounterId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "requestedQuantity" INTEGER NOT NULL,
    "requestedByNurseId" TEXT NOT NULL,
    "status" "MedicationRequestStatus" NOT NULL DEFAULT 'REQUESTED',
    "invoiceItemId" TEXT,
    "billedById" TEXT,
    "billedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MedicationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MedicationRequest_invoiceItemId_key" ON "MedicationRequest"("invoiceItemId");

-- CreateIndex
CREATE INDEX "MedicationRequest_medicationOrderId_idx" ON "MedicationRequest"("medicationOrderId");

-- CreateIndex
CREATE INDEX "MedicationRequest_encounterId_idx" ON "MedicationRequest"("encounterId");

-- CreateIndex
CREATE INDEX "MedicationRequest_patientId_idx" ON "MedicationRequest"("patientId");

-- CreateIndex
CREATE INDEX "MedicationRequest_status_idx" ON "MedicationRequest"("status");

-- CreateIndex
CREATE INDEX "MedicationRequest_invoiceItemId_idx" ON "MedicationRequest"("invoiceItemId");

-- AddForeignKey
ALTER TABLE "MedicationRequest" ADD CONSTRAINT "MedicationRequest_medicationOrderId_fkey" FOREIGN KEY ("medicationOrderId") REFERENCES "MedicationOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicationRequest" ADD CONSTRAINT "MedicationRequest_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "Encounter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicationRequest" ADD CONSTRAINT "MedicationRequest_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicationRequest" ADD CONSTRAINT "MedicationRequest_requestedByNurseId_fkey" FOREIGN KEY ("requestedByNurseId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicationRequest" ADD CONSTRAINT "MedicationRequest_invoiceItemId_fkey" FOREIGN KEY ("invoiceItemId") REFERENCES "InvoiceItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicationRequest" ADD CONSTRAINT "MedicationRequest_billedById_fkey" FOREIGN KEY ("billedById") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
