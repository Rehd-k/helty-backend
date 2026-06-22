-- AlterTable
ALTER TABLE "MedicationAdministration" ADD COLUMN "pharmacyLocationId" TEXT,
ADD COLUMN "stockDeductedQuantity" INTEGER;

-- CreateIndex
CREATE INDEX "MedicationAdministration_pharmacyLocationId_idx" ON "MedicationAdministration"("pharmacyLocationId");

-- AddForeignKey
ALTER TABLE "MedicationAdministration" ADD CONSTRAINT "MedicationAdministration_pharmacyLocationId_fkey" FOREIGN KEY ("pharmacyLocationId") REFERENCES "PharmacyLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
