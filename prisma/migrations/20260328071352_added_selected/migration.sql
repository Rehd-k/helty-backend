/*
  Warnings:

  - You are about to drop the `NoIdPatient` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Service" DROP CONSTRAINT "Service_noIdPatientId_fkey";

-- DropForeignKey
ALTER TABLE "Transaction" DROP CONSTRAINT "Transaction_noIdPatientid_fkey";

-- AlterTable
ALTER TABLE "InvoiceItem" ADD COLUMN     "settled" BOOLEAN NOT NULL DEFAULT false;

-- DropTable
DROP TABLE "NoIdPatient";
