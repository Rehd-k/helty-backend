/*
  Warnings:

  - You are about to drop the column `catalogTestId` on the `LabOrder` table. All the data in the column will be lost.
  - You are about to drop the column `clinicalNotes` on the `LabOrder` table. All the data in the column will be lost.
  - You are about to drop the column `encounterId` on the `LabOrder` table. All the data in the column will be lost.
  - You are about to drop the column `priority` on the `LabOrder` table. All the data in the column will be lost.
  - You are about to drop the column `resultValues` on the `LabOrder` table. All the data in the column will be lost.
  - You are about to drop the column `testName` on the `LabOrder` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `LabOrder` table. All the data in the column will be lost.
  - The `status` column on the `LabOrder` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the `LabCatalog` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `doctorId` to the `LabOrder` table without a default value. This is not possible if the table is not empty.
  - Added the required column `patientId` to the `LabOrder` table without a default value. This is not possible if the table is not empty.
  - Made the column `createdAt` on table `LabOrder` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "LabOrderStatus" AS ENUM ('PENDING', 'SAMPLE_COLLECTED', 'PROCESSING', 'COMPLETED', 'VERIFIED');

-- CreateEnum
CREATE TYPE "LabTestFieldType" AS ENUM ('TEXT', 'NUMBER', 'DROPDOWN', 'CHECKBOX', 'MULTISELECT', 'DATE');

-- DropForeignKey
ALTER TABLE "LabOrder" DROP CONSTRAINT "LabOrder_catalogTestId_fkey";

-- DropForeignKey
ALTER TABLE "LabOrder" DROP CONSTRAINT "LabOrder_encounterId_fkey";

-- DropIndex
DROP INDEX "LabOrder_encounterId_idx";

-- AlterTable
ALTER TABLE "LabOrder" DROP COLUMN "catalogTestId",
DROP COLUMN "clinicalNotes",
DROP COLUMN "encounterId",
DROP COLUMN "priority",
DROP COLUMN "resultValues",
DROP COLUMN "testName",
DROP COLUMN "updatedAt",
ADD COLUMN     "doctorId" TEXT NOT NULL,
ADD COLUMN     "patientId" TEXT NOT NULL,
DROP COLUMN "status",
ADD COLUMN     "status" "LabOrderStatus" NOT NULL DEFAULT 'PENDING',
ALTER COLUMN "createdAt" SET NOT NULL;

-- DropTable
DROP TABLE "LabCatalog";

-- CreateTable
CREATE TABLE "LegacyLabCatalog" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "department" TEXT,
    "cost" DOUBLE PRECISION,
    "turnaround" TEXT,
    "sampleType" TEXT,
    "preparation" TEXT,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "LegacyLabCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LegacyLabOrder" (
    "id" TEXT NOT NULL,
    "encounterId" TEXT NOT NULL,
    "catalogTestId" TEXT NOT NULL,
    "testName" TEXT NOT NULL,
    "priority" TEXT DEFAULT 'Routine',
    "clinicalNotes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Ordered',
    "resultValues" JSONB,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "LegacyLabOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LabCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LabCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LabTest" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "sampleType" TEXT NOT NULL,
    "description" TEXT,
    "price" DOUBLE PRECISION,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LabTest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LabTestVersion" (
    "id" TEXT NOT NULL,
    "testId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LabTestVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LabTestField" (
    "id" TEXT NOT NULL,
    "testVersionId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "fieldType" "LabTestFieldType" NOT NULL,
    "unit" TEXT,
    "referenceRange" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "optionsJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LabTestField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LabOrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "testVersionId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LabOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LabSample" (
    "id" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "sampleType" TEXT NOT NULL,
    "collectedById" TEXT NOT NULL,
    "collectionTime" TIMESTAMP(3) NOT NULL,
    "barcode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LabSample_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LabResult" (
    "id" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "enteredById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LabResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LegacyLabCatalog_name_idx" ON "LegacyLabCatalog"("name");

-- CreateIndex
CREATE INDEX "LegacyLabOrder_encounterId_idx" ON "LegacyLabOrder"("encounterId");

-- CreateIndex
CREATE INDEX "LabCategory_name_idx" ON "LabCategory"("name");

-- CreateIndex
CREATE INDEX "LabTest_categoryId_idx" ON "LabTest"("categoryId");

-- CreateIndex
CREATE INDEX "LabTest_isActive_idx" ON "LabTest"("isActive");

-- CreateIndex
CREATE INDEX "LabTestVersion_testId_idx" ON "LabTestVersion"("testId");

-- CreateIndex
CREATE INDEX "LabTestVersion_isActive_idx" ON "LabTestVersion"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "LabTestVersion_testId_versionNumber_key" ON "LabTestVersion"("testId", "versionNumber");

-- CreateIndex
CREATE INDEX "LabTestField_testVersionId_idx" ON "LabTestField"("testVersionId");

-- CreateIndex
CREATE INDEX "LabOrderItem_orderId_idx" ON "LabOrderItem"("orderId");

-- CreateIndex
CREATE INDEX "LabOrderItem_testVersionId_idx" ON "LabOrderItem"("testVersionId");

-- CreateIndex
CREATE INDEX "LabSample_orderItemId_idx" ON "LabSample"("orderItemId");

-- CreateIndex
CREATE UNIQUE INDEX "LabSample_orderItemId_key" ON "LabSample"("orderItemId");

-- CreateIndex
CREATE INDEX "LabResult_orderItemId_idx" ON "LabResult"("orderItemId");

-- CreateIndex
CREATE INDEX "LabResult_fieldId_idx" ON "LabResult"("fieldId");

-- CreateIndex
CREATE INDEX "LabOrder_patientId_idx" ON "LabOrder"("patientId");

-- CreateIndex
CREATE INDEX "LabOrder_doctorId_idx" ON "LabOrder"("doctorId");

-- CreateIndex
CREATE INDEX "LabOrder_status_idx" ON "LabOrder"("status");

-- AddForeignKey
ALTER TABLE "LegacyLabOrder" ADD CONSTRAINT "LegacyLabOrder_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "Encounter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegacyLabOrder" ADD CONSTRAINT "LegacyLabOrder_catalogTestId_fkey" FOREIGN KEY ("catalogTestId") REFERENCES "LegacyLabCatalog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabTest" ADD CONSTRAINT "LabTest_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "LabCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabTestVersion" ADD CONSTRAINT "LabTestVersion_testId_fkey" FOREIGN KEY ("testId") REFERENCES "LabTest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabTestField" ADD CONSTRAINT "LabTestField_testVersionId_fkey" FOREIGN KEY ("testVersionId") REFERENCES "LabTestVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabOrder" ADD CONSTRAINT "LabOrder_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabOrder" ADD CONSTRAINT "LabOrder_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabOrderItem" ADD CONSTRAINT "LabOrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "LabOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabOrderItem" ADD CONSTRAINT "LabOrderItem_testVersionId_fkey" FOREIGN KEY ("testVersionId") REFERENCES "LabTestVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabSample" ADD CONSTRAINT "LabSample_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "LabOrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabSample" ADD CONSTRAINT "LabSample_collectedById_fkey" FOREIGN KEY ("collectedById") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabResult" ADD CONSTRAINT "LabResult_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "LabOrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabResult" ADD CONSTRAINT "LabResult_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "LabTestField"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabResult" ADD CONSTRAINT "LabResult_enteredById_fkey" FOREIGN KEY ("enteredById") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
