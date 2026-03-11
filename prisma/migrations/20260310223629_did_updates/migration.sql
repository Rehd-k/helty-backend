-- DropForeignKey
ALTER TABLE "MedicationOrder" DROP CONSTRAINT "MedicationOrder_drugId_fkey";

-- AlterTable
ALTER TABLE "MedicationOrder" ADD COLUMN     "drugCatalogId" TEXT;

-- AddForeignKey
ALTER TABLE "MedicationOrder" ADD CONSTRAINT "MedicationOrder_drugId_fkey" FOREIGN KEY ("drugId") REFERENCES "Drug"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicationOrder" ADD CONSTRAINT "MedicationOrder_drugCatalogId_fkey" FOREIGN KEY ("drugCatalogId") REFERENCES "DrugCatalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;
