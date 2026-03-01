/*
  Warnings:

  - You are about to drop the column `transactionNumber` on the `Transaction` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[transactionID]` on the table `Transaction` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `transactionID` to the `Transaction` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Transaction_transactionNumber_key";

-- AlterTable
ALTER TABLE "Transaction" DROP COLUMN "transactionNumber",
ADD COLUMN     "transactionID" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_transactionID_key" ON "Transaction"("transactionID");
