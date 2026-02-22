/*
  Warnings:

  - You are about to drop the column `invoiceId` on the `Service` table. All the data in the column will be lost.
  - You are about to alter the column `cost` on the `Service` table. The data in that column could be lost. The data in that column will be cast from `Decimal(12,2)` to `DoublePrecision`.
  - Added the required column `updatedAt` to the `Service` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AccountType" ADD VALUE 'FRONTDESK';
ALTER TYPE "AccountType" ADD VALUE 'CONSULTANT';
ALTER TYPE "AccountType" ADD VALUE 'NURSE';
ALTER TYPE "AccountType" ADD VALUE 'LAB';
ALTER TYPE "AccountType" ADD VALUE 'RADIOLOGY';
ALTER TYPE "AccountType" ADD VALUE 'ACCOUNTS';
ALTER TYPE "AccountType" ADD VALUE 'BILLS';
ALTER TYPE "AccountType" ADD VALUE 'PHARMACY';
ALTER TYPE "AccountType" ADD VALUE 'THEATERE';
ALTER TYPE "AccountType" ADD VALUE 'ONG';
ALTER TYPE "AccountType" ADD VALUE 'DIALYSIS';

-- AlterTable
ALTER TABLE "InvoiceItem" ALTER COLUMN "priceAtTime" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Service" DROP COLUMN "invoiceId",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "cost" SET DATA TYPE DOUBLE PRECISION;
