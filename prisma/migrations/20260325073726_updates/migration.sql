/*
  Warnings:

  - You are about to drop the `VitalSigns` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "PatientVitals" DROP CONSTRAINT "PatientVitals_waitingPatientId_fkey";

-- DropForeignKey
ALTER TABLE "VitalSigns" DROP CONSTRAINT "VitalSigns_admissionId_fkey";

-- DropForeignKey
ALTER TABLE "VitalSigns" DROP CONSTRAINT "VitalSigns_recordedByNurseId_fkey";

-- AlterTable
ALTER TABLE "PatientVitals" ADD COLUMN     "admissionId" TEXT,
ADD COLUMN     "bloodGlucose" DOUBLE PRECISION,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "painScore" INTEGER,
ADD COLUMN     "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "recordedByNurseId" TEXT,
ADD COLUMN     "shiftType" "ShiftType",
ALTER COLUMN "waitingPatientId" DROP NOT NULL;

-- DropTable
DROP TABLE "VitalSigns";

-- AddForeignKey
ALTER TABLE "PatientVitals" ADD CONSTRAINT "PatientVitals_waitingPatientId_fkey" FOREIGN KEY ("waitingPatientId") REFERENCES "WaitingPatient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientVitals" ADD CONSTRAINT "PatientVitals_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "Admission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientVitals" ADD CONSTRAINT "PatientVitals_recordedByNurseId_fkey" FOREIGN KEY ("recordedByNurseId") REFERENCES "Nurse"("id") ON DELETE SET NULL ON UPDATE CASCADE;
