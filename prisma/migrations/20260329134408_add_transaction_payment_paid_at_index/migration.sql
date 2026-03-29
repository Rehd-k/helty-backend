/*
  Warnings:

  - You are about to drop the column `noIdPatientId` on the `Service` table. All the data in the column will be lost.
  - You are about to drop the column `noIdPatientid` on the `Transaction` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Service" DROP COLUMN "noIdPatientId";

-- AlterTable
ALTER TABLE "Transaction" DROP COLUMN "noIdPatientid";

-- CreateIndex
CREATE INDEX "TransactionPayment_paidAt_idx" ON "TransactionPayment"("paidAt");
