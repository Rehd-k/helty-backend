/*
  Warnings:

  - Changed the type of `source` on the `TransactionItem` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "TransactionItem" DROP COLUMN "source",
ADD COLUMN     "source" TEXT NOT NULL;

-- DropEnum
DROP TYPE "TransactionItemSource";
