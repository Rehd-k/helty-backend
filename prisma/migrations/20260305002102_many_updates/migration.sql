/*
  Warnings:

  - You are about to drop the column `locationType` on the `DrugBatch` table. All the data in the column will be lost.
  - You are about to drop the column `locationType` on the `InventoryMovement` table. All the data in the column will be lost.
  - You are about to drop the column `fromLocation` on the `StockTransfer` table. All the data in the column will be lost.
  - You are about to drop the column `toLocation` on the `StockTransfer` table. All the data in the column will be lost.
  - Added the required column `locationId` to the `ConsumableBatch` table without a default value. This is not possible if the table is not empty.
  - Added the required column `locationId` to the `ConsumableMovement` table without a default value. This is not possible if the table is not empty.
  - Added the required column `locationId` to the `Dispensation` table without a default value. This is not possible if the table is not empty.
  - Added the required column `fromLocationId` to the `DrugBatch` table without a default value. This is not possible if the table is not empty.
  - Added the required column `toLocationId` to the `DrugBatch` table without a default value. This is not possible if the table is not empty.
  - Added the required column `fromLocationId` to the `InventoryMovement` table without a default value. This is not possible if the table is not empty.
  - Added the required column `toLocationId` to the `InventoryMovement` table without a default value. This is not possible if the table is not empty.
  - Added the required column `fromLocationId` to the `StockTransfer` table without a default value. This is not possible if the table is not empty.
  - Added the required column `toLocationId` to the `StockTransfer` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "DrugBatch_drugId_locationType_idx";

-- AlterTable
ALTER TABLE "ConsumableBatch" ADD COLUMN     "locationId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "ConsumableMovement" ADD COLUMN     "locationId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Dispensation" ADD COLUMN     "locationId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "DrugBatch" DROP COLUMN "locationType",
ADD COLUMN     "fromLocationId" TEXT NOT NULL,
ADD COLUMN     "toLocationId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "InventoryMovement" DROP COLUMN "locationType",
ADD COLUMN     "fromLocationId" TEXT NOT NULL,
ADD COLUMN     "toLocationId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "StockTransfer" DROP COLUMN "fromLocation",
DROP COLUMN "toLocation",
ADD COLUMN     "fromLocationId" TEXT NOT NULL,
ADD COLUMN     "toLocationId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "PharmacyLocation" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "locationType" "PharmacyLocationType" NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "staffId" TEXT,

    CONSTRAINT "PharmacyLocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PharmacyLocation_staffId_key" ON "PharmacyLocation"("staffId");

-- CreateIndex
CREATE INDEX "DrugBatch_drugId_fromLocationId_toLocationId_idx" ON "DrugBatch"("drugId", "fromLocationId", "toLocationId");

-- AddForeignKey
ALTER TABLE "DrugBatch" ADD CONSTRAINT "DrugBatch_fromLocationId_fkey" FOREIGN KEY ("fromLocationId") REFERENCES "PharmacyLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrugBatch" ADD CONSTRAINT "DrugBatch_toLocationId_fkey" FOREIGN KEY ("toLocationId") REFERENCES "PharmacyLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_fromLocationId_fkey" FOREIGN KEY ("fromLocationId") REFERENCES "PharmacyLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_toLocationId_fkey" FOREIGN KEY ("toLocationId") REFERENCES "PharmacyLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_fromLocationId_fkey" FOREIGN KEY ("fromLocationId") REFERENCES "PharmacyLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_toLocationId_fkey" FOREIGN KEY ("toLocationId") REFERENCES "PharmacyLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PharmacyLocation" ADD CONSTRAINT "PharmacyLocation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PharmacyLocation" ADD CONSTRAINT "PharmacyLocation_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PharmacyLocation" ADD CONSTRAINT "PharmacyLocation_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispensation" ADD CONSTRAINT "Dispensation_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "PharmacyLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumableBatch" ADD CONSTRAINT "ConsumableBatch_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "PharmacyLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumableMovement" ADD CONSTRAINT "ConsumableMovement_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "PharmacyLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
