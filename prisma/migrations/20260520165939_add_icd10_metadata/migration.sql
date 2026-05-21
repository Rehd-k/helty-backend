/*
  Warnings:

  - Added the required column `icd_group` to the `Icd10Code` table without a default value. This is not possible if the table is not empty.
  - Added the required column `range` to the `Icd10Code` table without a default value. This is not possible if the table is not empty.
  - Added the required column `specialty` to the `Icd10Code` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Icd10Code" ADD COLUMN     "icd_group" TEXT NOT NULL,
ADD COLUMN     "range" TEXT NOT NULL,
ADD COLUMN     "specialty" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "Icd10Code_specialty_idx" ON "Icd10Code"("specialty");

-- CreateIndex
CREATE INDEX "Icd10Code_icd_group_idx" ON "Icd10Code"("icd_group");

-- CreateIndex
CREATE INDEX "Icd10Code_specialty_icd_group_idx" ON "Icd10Code"("specialty", "icd_group");
