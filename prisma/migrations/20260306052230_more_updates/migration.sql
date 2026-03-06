/*
  Warnings:

  - You are about to drop the column `admissionId` on the `MedicationOrder` table. All the data in the column will be lost.
  - You are about to drop the column `endDateTime` on the `MedicationOrder` table. All the data in the column will be lost.
  - You are about to drop the column `notes` on the `MedicationOrder` table. All the data in the column will be lost.
  - You are about to drop the column `prescribedByDoctorId` on the `MedicationOrder` table. All the data in the column will be lost.
  - You are about to drop the column `startDateTime` on the `MedicationOrder` table. All the data in the column will be lost.
  - The `route` column on the `MedicationOrder` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `status` column on the `MedicationOrder` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `vitalsId` on the `WaitingPatient` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[waitingPatientId]` on the table `PatientVitals` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `encounterId` to the `Admission` table without a default value. This is not possible if the table is not empty.
  - Added the required column `drugId` to the `MedicationOrder` table without a default value. This is not possible if the table is not empty.
  - Added the required column `encounterId` to the `MedicationOrder` table without a default value. This is not possible if the table is not empty.
  - Added the required column `waitingPatientId` to the `PatientVitals` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "MedicationAdministration" DROP CONSTRAINT "MedicationAdministration_medicationOrderId_fkey";

-- DropForeignKey
ALTER TABLE "MedicationOrder" DROP CONSTRAINT "MedicationOrder_admissionId_fkey";

-- DropForeignKey
ALTER TABLE "MedicationOrder" DROP CONSTRAINT "MedicationOrder_prescribedByDoctorId_fkey";

-- DropForeignKey
ALTER TABLE "WaitingPatient" DROP CONSTRAINT "WaitingPatient_vitalsId_fkey";

-- DropIndex
DROP INDEX "WaitingPatient_vitalsId_key";

-- AlterTable
ALTER TABLE "Admission" ADD COLUMN     "encounterId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Encounter" ADD COLUMN     "allergyHistory" TEXT,
ADD COLUMN     "appointmentId" TEXT,
ADD COLUMN     "drugHistory" TEXT,
ADD COLUMN     "examinationNotes" TEXT,
ADD COLUMN     "familyHistory" TEXT,
ADD COLUMN     "followUpDate" TEXT,
ADD COLUMN     "followUpInstructions" TEXT,
ADD COLUMN     "hpi" TEXT,
ADD COLUMN     "insurance" TEXT,
ADD COLUMN     "pmh" TEXT,
ADD COLUMN     "primaryIcdCode" TEXT,
ADD COLUMN     "primaryIcdDescription" TEXT,
ADD COLUMN     "proceduresJson" TEXT,
ADD COLUMN     "referral" TEXT,
ADD COLUMN     "secondaryDiagnosesJson" TEXT,
ADD COLUMN     "soapAssessment" TEXT,
ADD COLUMN     "soapLockedAt" TIMESTAMP(3),
ADD COLUMN     "soapObjective" TEXT,
ADD COLUMN     "soapPlan" TEXT,
ADD COLUMN     "soapSubjective" TEXT,
ADD COLUMN     "socialHistory" TEXT,
ADD COLUMN     "surgicalHistory" TEXT,
ADD COLUMN     "visitType" TEXT;

-- AlterTable
ALTER TABLE "MedicationOrder" DROP COLUMN "admissionId",
DROP COLUMN "endDateTime",
DROP COLUMN "notes",
DROP COLUMN "prescribedByDoctorId",
DROP COLUMN "startDateTime",
ADD COLUMN     "drugId" TEXT NOT NULL,
ADD COLUMN     "duration" TEXT,
ADD COLUMN     "encounterId" TEXT NOT NULL,
ADD COLUMN     "specialInstructions" TEXT,
ALTER COLUMN "dose" DROP NOT NULL,
DROP COLUMN "route",
ADD COLUMN     "route" TEXT,
ALTER COLUMN "frequency" DROP NOT NULL,
DROP COLUMN "status",
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'Pending Dispense',
ALTER COLUMN "createdAt" DROP NOT NULL,
ALTER COLUMN "updatedAt" DROP NOT NULL;

-- AlterTable
ALTER TABLE "PatientVitals" ADD COLUMN     "waitingPatientId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "WaitingPatient" DROP COLUMN "vitalsId";

-- CreateTable
CREATE TABLE "Icd10Code" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "Icd10Code_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DrugCatalog" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "generic" TEXT,
    "strength" TEXT,
    "form" TEXT,
    "stockStatus" TEXT,
    "contraindications" TEXT,
    "interactions" TEXT,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "DrugCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LabCatalog" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "department" TEXT,
    "cost" DOUBLE PRECISION,
    "turnaround" TEXT,
    "sampleType" TEXT,
    "preparation" TEXT,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "LabCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LabOrder" (
    "id" TEXT NOT NULL,
    "encounterId" TEXT NOT NULL,
    "catalogTestId" TEXT NOT NULL,
    "testName" TEXT NOT NULL,
    "priority" TEXT DEFAULT 'Routine',
    "clinicalNotes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Ordered',
    "resultValues" JSONB,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "LabOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImagingCatalog" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "area" TEXT,
    "contrastAvailable" BOOLEAN NOT NULL DEFAULT false,
    "cost" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "ImagingCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImagingOrder" (
    "id" TEXT NOT NULL,
    "encounterId" TEXT NOT NULL,
    "catalogId" TEXT NOT NULL,
    "studyName" TEXT NOT NULL,
    "area" TEXT,
    "contrast" BOOLEAN NOT NULL DEFAULT false,
    "urgency" TEXT DEFAULT 'Routine',
    "notesToRadiologist" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Ordered',
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "ImagingOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdmissionMedicationOrder" (
    "id" TEXT NOT NULL,
    "admissionId" TEXT NOT NULL,
    "prescribedByDoctorId" TEXT NOT NULL,
    "drugName" TEXT NOT NULL,
    "dose" TEXT NOT NULL,
    "route" "MedicationRoute" NOT NULL,
    "frequency" TEXT NOT NULL,
    "startDateTime" TIMESTAMP(3) NOT NULL,
    "endDateTime" TIMESTAMP(3),
    "status" "MedicationOrderStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdmissionMedicationOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Icd10Code_code_key" ON "Icd10Code"("code");

-- CreateIndex
CREATE INDEX "Icd10Code_code_idx" ON "Icd10Code"("code");

-- CreateIndex
CREATE INDEX "Icd10Code_description_idx" ON "Icd10Code"("description");

-- CreateIndex
CREATE INDEX "DrugCatalog_name_idx" ON "DrugCatalog"("name");

-- CreateIndex
CREATE INDEX "LabCatalog_name_idx" ON "LabCatalog"("name");

-- CreateIndex
CREATE INDEX "LabOrder_encounterId_idx" ON "LabOrder"("encounterId");

-- CreateIndex
CREATE INDEX "ImagingCatalog_name_idx" ON "ImagingCatalog"("name");

-- CreateIndex
CREATE INDEX "ImagingOrder_encounterId_idx" ON "ImagingOrder"("encounterId");

-- CreateIndex
CREATE INDEX "Admission_patientId_idx" ON "Admission"("patientId");

-- CreateIndex
CREATE INDEX "Admission_encounterId_idx" ON "Admission"("encounterId");

-- CreateIndex
CREATE INDEX "Admission_status_idx" ON "Admission"("status");

-- CreateIndex
CREATE INDEX "MedicationOrder_encounterId_idx" ON "MedicationOrder"("encounterId");

-- CreateIndex
CREATE UNIQUE INDEX "PatientVitals_waitingPatientId_key" ON "PatientVitals"("waitingPatientId");

-- AddForeignKey
ALTER TABLE "Encounter" ADD CONSTRAINT "Encounter_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientVitals" ADD CONSTRAINT "PatientVitals_waitingPatientId_fkey" FOREIGN KEY ("waitingPatientId") REFERENCES "WaitingPatient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicationOrder" ADD CONSTRAINT "MedicationOrder_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "Encounter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicationOrder" ADD CONSTRAINT "MedicationOrder_drugId_fkey" FOREIGN KEY ("drugId") REFERENCES "DrugCatalog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabOrder" ADD CONSTRAINT "LabOrder_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "Encounter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabOrder" ADD CONSTRAINT "LabOrder_catalogTestId_fkey" FOREIGN KEY ("catalogTestId") REFERENCES "LabCatalog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImagingOrder" ADD CONSTRAINT "ImagingOrder_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "Encounter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImagingOrder" ADD CONSTRAINT "ImagingOrder_catalogId_fkey" FOREIGN KEY ("catalogId") REFERENCES "ImagingCatalog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdmissionMedicationOrder" ADD CONSTRAINT "AdmissionMedicationOrder_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "Admission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdmissionMedicationOrder" ADD CONSTRAINT "AdmissionMedicationOrder_prescribedByDoctorId_fkey" FOREIGN KEY ("prescribedByDoctorId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicationAdministration" ADD CONSTRAINT "MedicationAdministration_medicationOrderId_fkey" FOREIGN KEY ("medicationOrderId") REFERENCES "AdmissionMedicationOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
