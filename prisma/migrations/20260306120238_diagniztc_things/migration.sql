/*
  Warnings:

  - You are about to drop the column `diagnosis` on the `EncounterDiagnosis` table. All the data in the column will be lost.
  - You are about to drop the column `isPrimary` on the `EncounterDiagnosis` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "EncounterDiagnosis" DROP COLUMN "diagnosis",
DROP COLUMN "isPrimary",
ADD COLUMN     "primaryIcdCode" TEXT,
ADD COLUMN     "primaryIcdDescription" TEXT,
ADD COLUMN     "secondaryDiagnosesJson" JSONB;
