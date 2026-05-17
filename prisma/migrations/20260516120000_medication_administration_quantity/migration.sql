-- AlterTable
ALTER TABLE "MedicationOrder" ADD COLUMN "quantity" DECIMAL(12,3);

-- AlterTable
ALTER TABLE "MedicationAdministration" ADD COLUMN "quantity" DECIMAL(12,3);
ALTER TABLE "MedicationAdministration" ADD COLUMN "isOverMedication" BOOLEAN NOT NULL DEFAULT false;
