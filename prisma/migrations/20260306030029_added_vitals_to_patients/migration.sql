-- AlterTable
ALTER TABLE "WaitingPatient" ADD COLUMN     "vitalsId" TEXT;

-- AddForeignKey
ALTER TABLE "WaitingPatient" ADD CONSTRAINT "WaitingPatient_vitalsId_fkey" FOREIGN KEY ("vitalsId") REFERENCES "PatientVitals"("id") ON DELETE SET NULL ON UPDATE CASCADE;
