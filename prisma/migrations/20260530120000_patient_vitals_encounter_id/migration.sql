-- AlterTable
ALTER TABLE "PatientVitals" ADD COLUMN "encounterId" TEXT;

-- CreateIndex
CREATE INDEX "PatientVitals_encounterId_idx" ON "PatientVitals"("encounterId");

-- AddForeignKey
ALTER TABLE "PatientVitals" ADD CONSTRAINT "PatientVitals_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "Encounter"("id") ON DELETE SET NULL ON UPDATE CASCADE;
