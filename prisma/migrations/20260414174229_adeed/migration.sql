-- AlterTable
ALTER TABLE "Ward" ADD COLUMN     "drugPricePercentage" DECIMAL(12,2) DEFAULT 1.0,
ADD COLUMN     "servicePricePercentage" DECIMAL(12,2) DEFAULT 1.0;
