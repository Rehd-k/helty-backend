-- AlterTable
ALTER TABLE "PatientVitals" ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "respRate" INTEGER;

-- AddForeignKey
ALTER TABLE "PatientVitals" ADD CONSTRAINT "PatientVitals_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
