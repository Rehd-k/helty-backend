/*
  Warnings:

  - A unique constraint covering the columns `[vitalsId]` on the table `WaitingPatient` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "PatientVitals" DROP CONSTRAINT "PatientVitals_patientId_fkey";

-- AlterTable
ALTER TABLE "PatientVitals" ALTER COLUMN "patientId" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "WaitingPatient_vitalsId_key" ON "WaitingPatient"("vitalsId");

-- AddForeignKey
ALTER TABLE "PatientVitals" ADD CONSTRAINT "PatientVitals_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;
