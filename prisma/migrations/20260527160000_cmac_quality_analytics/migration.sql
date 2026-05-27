-- CreateEnum
CREATE TYPE "ReferralDirection" AS ENUM ('IN', 'OUT');

-- CreateEnum
CREATE TYPE "ReferralStatus" AS ENUM ('PENDING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ComplaintSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ComplaintStatus" AS ENUM ('OPEN', 'INVESTIGATING', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "SafetyIncidentType" AS ENUM ('MEDICATION', 'FALL', 'PROCEDURE', 'DOCUMENTATION', 'OTHER');

-- CreateEnum
CREATE TYPE "SafetyIncidentSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "SafetyIncidentStatus" AS ENUM ('OPEN', 'INVESTIGATING', 'CLOSED');

-- CreateEnum
CREATE TYPE "InfectionCaseType" AS ENUM ('HAI', 'SURGICAL_SITE', 'WOUND', 'OTHER');

-- CreateEnum
CREATE TYPE "InfectionCaseStatus" AS ENUM ('ACTIVE', 'RESOLVED');

-- CreateEnum
CREATE TYPE "LabAbnormalFlag" AS ENUM ('LOW', 'HIGH');

-- AlterTable
ALTER TABLE "LabOrder" ADD COLUMN "sampleCollectedAt" TIMESTAMP(3),
ADD COLUMN "completedAt" TIMESTAMP(3),
ADD COLUMN "verifiedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "LabResult" ADD COLUMN "abnormalFlag" "LabAbnormalFlag",
ADD COLUMN "isCritical" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "evaluatedAt" TIMESTAMP(3),
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "Referral" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "direction" "ReferralDirection" NOT NULL,
    "status" "ReferralStatus" NOT NULL DEFAULT 'PENDING',
    "referringFacility" TEXT,
    "receivingFacility" TEXT,
    "reason" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "encounterId" TEXT,
    "admissionId" TEXT,
    "departmentId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Referral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatientComplaint" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" "ComplaintSeverity" NOT NULL DEFAULT 'MEDIUM',
    "status" "ComplaintStatus" NOT NULL DEFAULT 'OPEN',
    "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "encounterId" TEXT,
    "departmentId" TEXT,
    "assignedToId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PatientComplaint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SafetyIncident" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "type" "SafetyIncidentType" NOT NULL,
    "severity" "SafetyIncidentSeverity" NOT NULL DEFAULT 'MEDIUM',
    "status" "SafetyIncidentStatus" NOT NULL DEFAULT 'OPEN',
    "description" TEXT NOT NULL,
    "rootCause" TEXT,
    "correctiveAction" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "encounterId" TEXT,
    "admissionId" TEXT,
    "departmentId" TEXT,
    "reportedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SafetyIncident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InfectionCase" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "admissionId" TEXT NOT NULL,
    "type" "InfectionCaseType" NOT NULL,
    "status" "InfectionCaseStatus" NOT NULL DEFAULT 'ACTIVE',
    "organism" TEXT,
    "site" TEXT,
    "isolated" BOOLEAN NOT NULL DEFAULT false,
    "onsetDate" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "departmentId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InfectionCase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Referral_patientId_idx" ON "Referral"("patientId");

-- CreateIndex
CREATE INDEX "Referral_direction_occurredAt_idx" ON "Referral"("direction", "occurredAt");

-- CreateIndex
CREATE INDEX "Referral_departmentId_idx" ON "Referral"("departmentId");

-- CreateIndex
CREATE INDEX "PatientComplaint_patientId_idx" ON "PatientComplaint"("patientId");

-- CreateIndex
CREATE INDEX "PatientComplaint_status_reportedAt_idx" ON "PatientComplaint"("status", "reportedAt");

-- CreateIndex
CREATE INDEX "PatientComplaint_departmentId_idx" ON "PatientComplaint"("departmentId");

-- CreateIndex
CREATE INDEX "SafetyIncident_patientId_idx" ON "SafetyIncident"("patientId");

-- CreateIndex
CREATE INDEX "SafetyIncident_type_severity_idx" ON "SafetyIncident"("type", "severity");

-- CreateIndex
CREATE INDEX "SafetyIncident_status_occurredAt_idx" ON "SafetyIncident"("status", "occurredAt");

-- CreateIndex
CREATE INDEX "SafetyIncident_departmentId_idx" ON "SafetyIncident"("departmentId");

-- CreateIndex
CREATE INDEX "InfectionCase_patientId_idx" ON "InfectionCase"("patientId");

-- CreateIndex
CREATE INDEX "InfectionCase_admissionId_idx" ON "InfectionCase"("admissionId");

-- CreateIndex
CREATE INDEX "InfectionCase_status_onsetDate_idx" ON "InfectionCase"("status", "onsetDate");

-- CreateIndex
CREATE INDEX "InfectionCase_departmentId_idx" ON "InfectionCase"("departmentId");

-- CreateIndex
CREATE INDEX "LabOrder_completedAt_idx" ON "LabOrder"("completedAt");

-- CreateIndex
CREATE INDEX "LabResult_isCritical_createdAt_idx" ON "LabResult"("isCritical", "createdAt");

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "Encounter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "Admission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientComplaint" ADD CONSTRAINT "PatientComplaint_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientComplaint" ADD CONSTRAINT "PatientComplaint_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "Encounter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientComplaint" ADD CONSTRAINT "PatientComplaint_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientComplaint" ADD CONSTRAINT "PatientComplaint_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientComplaint" ADD CONSTRAINT "PatientComplaint_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SafetyIncident" ADD CONSTRAINT "SafetyIncident_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SafetyIncident" ADD CONSTRAINT "SafetyIncident_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "Encounter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SafetyIncident" ADD CONSTRAINT "SafetyIncident_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "Admission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SafetyIncident" ADD CONSTRAINT "SafetyIncident_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SafetyIncident" ADD CONSTRAINT "SafetyIncident_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InfectionCase" ADD CONSTRAINT "InfectionCase_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InfectionCase" ADD CONSTRAINT "InfectionCase_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "Admission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InfectionCase" ADD CONSTRAINT "InfectionCase_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InfectionCase" ADD CONSTRAINT "InfectionCase_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
