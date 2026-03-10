-- CreateEnum
CREATE TYPE "RadiologyPriority" AS ENUM ('ROUTINE', 'URGENT', 'EMERGENCY');

-- CreateEnum
CREATE TYPE "RadiologyModality" AS ENUM ('X_RAY', 'CT', 'MRI', 'ULTRASOUND', 'MAMMOGRAPHY', 'FLUOROSCOPY', 'OTHER');

-- CreateEnum
CREATE TYPE "RadiologyRequestStatus" AS ENUM ('PENDING', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'REPORTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReportSeverity" AS ENUM ('NORMAL', 'ABNORMAL', 'CRITICAL');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AccountType" ADD VALUE 'RADIOLOGIST';
ALTER TYPE "AccountType" ADD VALUE 'RADIOGRAPHER';
ALTER TYPE "AccountType" ADD VALUE 'RADIOLOGY_RECEPTIONIST';

-- CreateTable
CREATE TABLE "RadiologyMachine" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "modality" "RadiologyModality" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RadiologyMachine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RadiologyRequest" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "encounterId" TEXT,
    "requestedById" TEXT NOT NULL,
    "departmentId" TEXT,
    "clinicalNotes" TEXT,
    "reasonForInvestigation" TEXT,
    "priority" "RadiologyPriority" NOT NULL DEFAULT 'ROUTINE',
    "scanType" "RadiologyModality" NOT NULL,
    "bodyPart" TEXT,
    "status" "RadiologyRequestStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RadiologyRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RadiologySchedule" (
    "id" TEXT NOT NULL,
    "radiologyRequestId" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "radiographerId" TEXT,
    "machineId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RadiologySchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RadiologyProcedure" (
    "id" TEXT NOT NULL,
    "radiologyRequestId" TEXT NOT NULL,
    "performedById" TEXT NOT NULL,
    "machineId" TEXT,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RadiologyProcedure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RadiologyImage" (
    "id" TEXT NOT NULL,
    "radiologyRequestId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "mimeType" TEXT,
    "fileSize" INTEGER,
    "uploadedById" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RadiologyImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RadiologyStudyReport" (
    "id" TEXT NOT NULL,
    "radiologyRequestId" TEXT NOT NULL,
    "findings" TEXT,
    "impression" TEXT,
    "recommendations" TEXT,
    "severity" "ReportSeverity",
    "signedById" TEXT NOT NULL,
    "signedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RadiologyStudyReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RadiologyMachine_modality_idx" ON "RadiologyMachine"("modality");

-- CreateIndex
CREATE INDEX "RadiologyMachine_isActive_idx" ON "RadiologyMachine"("isActive");

-- CreateIndex
CREATE INDEX "RadiologyRequest_patientId_idx" ON "RadiologyRequest"("patientId");

-- CreateIndex
CREATE INDEX "RadiologyRequest_status_idx" ON "RadiologyRequest"("status");

-- CreateIndex
CREATE INDEX "RadiologyRequest_requestedById_idx" ON "RadiologyRequest"("requestedById");

-- CreateIndex
CREATE INDEX "RadiologyRequest_createdAt_idx" ON "RadiologyRequest"("createdAt");

-- CreateIndex
CREATE INDEX "RadiologyRequest_priority_idx" ON "RadiologyRequest"("priority");

-- CreateIndex
CREATE UNIQUE INDEX "RadiologySchedule_radiologyRequestId_key" ON "RadiologySchedule"("radiologyRequestId");

-- CreateIndex
CREATE INDEX "RadiologySchedule_scheduledAt_idx" ON "RadiologySchedule"("scheduledAt");

-- CreateIndex
CREATE INDEX "RadiologySchedule_radiographerId_idx" ON "RadiologySchedule"("radiographerId");

-- CreateIndex
CREATE INDEX "RadiologySchedule_machineId_idx" ON "RadiologySchedule"("machineId");

-- CreateIndex
CREATE UNIQUE INDEX "RadiologyProcedure_radiologyRequestId_key" ON "RadiologyProcedure"("radiologyRequestId");

-- CreateIndex
CREATE INDEX "RadiologyProcedure_performedById_idx" ON "RadiologyProcedure"("performedById");

-- CreateIndex
CREATE INDEX "RadiologyProcedure_machineId_idx" ON "RadiologyProcedure"("machineId");

-- CreateIndex
CREATE INDEX "RadiologyImage_radiologyRequestId_idx" ON "RadiologyImage"("radiologyRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "RadiologyStudyReport_radiologyRequestId_key" ON "RadiologyStudyReport"("radiologyRequestId");

-- CreateIndex
CREATE INDEX "RadiologyStudyReport_signedById_idx" ON "RadiologyStudyReport"("signedById");

-- AddForeignKey
ALTER TABLE "RadiologyRequest" ADD CONSTRAINT "RadiologyRequest_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RadiologyRequest" ADD CONSTRAINT "RadiologyRequest_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "Encounter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RadiologyRequest" ADD CONSTRAINT "RadiologyRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RadiologyRequest" ADD CONSTRAINT "RadiologyRequest_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RadiologySchedule" ADD CONSTRAINT "RadiologySchedule_radiologyRequestId_fkey" FOREIGN KEY ("radiologyRequestId") REFERENCES "RadiologyRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RadiologySchedule" ADD CONSTRAINT "RadiologySchedule_radiographerId_fkey" FOREIGN KEY ("radiographerId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RadiologySchedule" ADD CONSTRAINT "RadiologySchedule_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "RadiologyMachine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RadiologyProcedure" ADD CONSTRAINT "RadiologyProcedure_radiologyRequestId_fkey" FOREIGN KEY ("radiologyRequestId") REFERENCES "RadiologyRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RadiologyProcedure" ADD CONSTRAINT "RadiologyProcedure_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RadiologyProcedure" ADD CONSTRAINT "RadiologyProcedure_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "RadiologyMachine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RadiologyImage" ADD CONSTRAINT "RadiologyImage_radiologyRequestId_fkey" FOREIGN KEY ("radiologyRequestId") REFERENCES "RadiologyRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RadiologyImage" ADD CONSTRAINT "RadiologyImage_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RadiologyStudyReport" ADD CONSTRAINT "RadiologyStudyReport_radiologyRequestId_fkey" FOREIGN KEY ("radiologyRequestId") REFERENCES "RadiologyRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RadiologyStudyReport" ADD CONSTRAINT "RadiologyStudyReport_signedById_fkey" FOREIGN KEY ("signedById") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
