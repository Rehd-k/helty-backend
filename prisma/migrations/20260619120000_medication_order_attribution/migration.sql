-- AlterTable
ALTER TABLE "MedicationOrder" ADD COLUMN     "prescribedDrugId" TEXT,
ADD COLUMN     "prescribedDrugName" TEXT,
ADD COLUMN     "substitutedByPharmacistId" TEXT,
ADD COLUMN     "substitutedAt" TIMESTAMP(3);

-- Backfill prescribed drug snapshot from current drug fields
UPDATE "MedicationOrder"
SET "prescribedDrugId" = "drugId",
    "prescribedDrugName" = "drugName"
WHERE "drugId" IS NOT NULL;

-- CreateIndex
CREATE INDEX "MedicationOrder_prescribedDrugId_idx" ON "MedicationOrder"("prescribedDrugId");

-- CreateIndex
CREATE INDEX "MedicationOrder_substitutedByPharmacistId_idx" ON "MedicationOrder"("substitutedByPharmacistId");

-- AddForeignKey
ALTER TABLE "MedicationOrder" ADD CONSTRAINT "MedicationOrder_prescribedDrugId_fkey" FOREIGN KEY ("prescribedDrugId") REFERENCES "Drug"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicationOrder" ADD CONSTRAINT "MedicationOrder_substitutedByPharmacistId_fkey" FOREIGN KEY ("substitutedByPharmacistId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
