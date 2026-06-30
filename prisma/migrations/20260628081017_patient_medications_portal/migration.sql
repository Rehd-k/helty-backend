-- CreateEnum
CREATE TYPE "PatientMedicationDoseStatus" AS ENUM ('UPCOMING', 'TAKEN', 'MISSED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "MedicationTimeOfDay" AS ENUM ('MORNING', 'AFTERNOON', 'EVENING');

-- CreateEnum
CREATE TYPE "PrescriptionRefillRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'FULFILLED', 'CANCELLED');

-- AlterTable
ALTER TABLE "Prescription" ADD COLUMN     "refillsAllowed" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "PatientMedicationDoseLog" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "prescriptionItemId" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "timeOfDay" "MedicationTimeOfDay" NOT NULL,
    "status" "PatientMedicationDoseStatus" NOT NULL DEFAULT 'UPCOMING',
    "takenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PatientMedicationDoseLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrescriptionRefillRequest" (
    "id" TEXT NOT NULL,
    "prescriptionId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "status" "PrescriptionRefillRequestStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrescriptionRefillRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PatientMedicationDoseLog_patientId_scheduledAt_idx" ON "PatientMedicationDoseLog"("patientId", "scheduledAt");

-- CreateIndex
CREATE INDEX "PatientMedicationDoseLog_prescriptionItemId_idx" ON "PatientMedicationDoseLog"("prescriptionItemId");

-- CreateIndex
CREATE INDEX "PatientMedicationDoseLog_status_idx" ON "PatientMedicationDoseLog"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PatientMedicationDoseLog_prescriptionItemId_scheduledAt_key" ON "PatientMedicationDoseLog"("prescriptionItemId", "scheduledAt");

-- CreateIndex
CREATE INDEX "PrescriptionRefillRequest_prescriptionId_status_idx" ON "PrescriptionRefillRequest"("prescriptionId", "status");

-- CreateIndex
CREATE INDEX "PrescriptionRefillRequest_patientId_idx" ON "PrescriptionRefillRequest"("patientId");

-- AddForeignKey
ALTER TABLE "PatientMedicationDoseLog" ADD CONSTRAINT "PatientMedicationDoseLog_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientMedicationDoseLog" ADD CONSTRAINT "PatientMedicationDoseLog_prescriptionItemId_fkey" FOREIGN KEY ("prescriptionItemId") REFERENCES "PrescriptionItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrescriptionRefillRequest" ADD CONSTRAINT "PrescriptionRefillRequest_prescriptionId_fkey" FOREIGN KEY ("prescriptionId") REFERENCES "Prescription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrescriptionRefillRequest" ADD CONSTRAINT "PrescriptionRefillRequest_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
