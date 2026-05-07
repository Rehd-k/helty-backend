-- CreateEnum
CREATE TYPE "InvoiceCoverageKind" AS ENUM ('HMO', 'DISCOUNT');

-- CreateEnum
CREATE TYPE "InvoiceCoverageMode" AS ENUM ('PERCENT', 'FIXED');

-- CreateEnum
CREATE TYPE "InvoiceCoverageScope" AS ENUM ('INVOICE', 'ITEM');

-- CreateEnum
CREATE TYPE "InvoiceCoverageStatus" AS ENUM ('APPLIED', 'REVERSED', 'SETTLED');

-- CreateEnum
CREATE TYPE "DiscountReason" AS ENUM ('CMD', 'CMAC', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "CoverageRemittancePayerType" AS ENUM ('HMO', 'STAFF');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "InvoiceAuditAction" ADD VALUE 'COVERAGE_APPLIED';
ALTER TYPE "InvoiceAuditAction" ADD VALUE 'COVERAGE_REVERSED';
ALTER TYPE "InvoiceAuditAction" ADD VALUE 'COVERAGE_REMITTANCE_RECORDED';

-- AlterTable
ALTER TABLE "Hmo" ADD COLUMN     "defaultCoveragePercent" DECIMAL(5,2);

-- AlterTable
ALTER TABLE "HmoServicePrice" ADD COLUMN     "coveragePercent" DECIMAL(5,2);

-- Backfill coveragePercent from existing fullCost / hmoPays split where possible.
UPDATE "HmoServicePrice"
SET "coveragePercent" = ROUND(("hmoPays" / "fullCost") * 100, 2)
WHERE "fullCost" > 0 AND "coveragePercent" IS NULL;

-- CreateTable
CREATE TABLE "DiscountPolicy" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "reason" "DiscountReason" NOT NULL,
    "mode" "InvoiceCoverageMode" NOT NULL,
    "value" DECIMAL(12,2) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "ownerId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscountPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceCoverage" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "invoiceItemId" TEXT,
    "scope" "InvoiceCoverageScope" NOT NULL DEFAULT 'INVOICE',
    "kind" "InvoiceCoverageKind" NOT NULL,
    "hmoId" TEXT,
    "policyId" TEXT,
    "reason" "DiscountReason",
    "payerStaffId" TEXT,
    "mode" "InvoiceCoverageMode" NOT NULL,
    "value" DECIMAL(12,2) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "status" "InvoiceCoverageStatus" NOT NULL DEFAULT 'APPLIED',
    "notes" TEXT,
    "appliedById" TEXT NOT NULL,
    "reversedById" TEXT,
    "reversedAt" TIMESTAMP(3),
    "reversalReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvoiceCoverage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoverageRemittance" (
    "id" TEXT NOT NULL,
    "payerType" "CoverageRemittancePayerType" NOT NULL,
    "hmoId" TEXT,
    "payerStaffId" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "reference" TEXT,
    "notes" TEXT,
    "receivedById" TEXT,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoverageRemittance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoverageRemittanceLine" (
    "id" TEXT NOT NULL,
    "remittanceId" TEXT NOT NULL,
    "coverageId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoverageRemittanceLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DiscountPolicy_reason_idx" ON "DiscountPolicy"("reason");

-- CreateIndex
CREATE INDEX "DiscountPolicy_ownerId_idx" ON "DiscountPolicy"("ownerId");

-- CreateIndex
CREATE INDEX "DiscountPolicy_active_idx" ON "DiscountPolicy"("active");

-- CreateIndex
CREATE INDEX "InvoiceCoverage_invoiceId_idx" ON "InvoiceCoverage"("invoiceId");

-- CreateIndex
CREATE INDEX "InvoiceCoverage_invoiceItemId_idx" ON "InvoiceCoverage"("invoiceItemId");

-- CreateIndex
CREATE INDEX "InvoiceCoverage_hmoId_status_idx" ON "InvoiceCoverage"("hmoId", "status");

-- CreateIndex
CREATE INDEX "InvoiceCoverage_payerStaffId_status_idx" ON "InvoiceCoverage"("payerStaffId", "status");

-- CreateIndex
CREATE INDEX "InvoiceCoverage_policyId_idx" ON "InvoiceCoverage"("policyId");

-- CreateIndex
CREATE INDEX "InvoiceCoverage_kind_status_idx" ON "InvoiceCoverage"("kind", "status");

-- CreateIndex
CREATE INDEX "InvoiceCoverage_reason_status_idx" ON "InvoiceCoverage"("reason", "status");

-- CreateIndex
CREATE INDEX "CoverageRemittance_payerType_idx" ON "CoverageRemittance"("payerType");

-- CreateIndex
CREATE INDEX "CoverageRemittance_hmoId_idx" ON "CoverageRemittance"("hmoId");

-- CreateIndex
CREATE INDEX "CoverageRemittance_payerStaffId_idx" ON "CoverageRemittance"("payerStaffId");

-- CreateIndex
CREATE INDEX "CoverageRemittance_paidAt_idx" ON "CoverageRemittance"("paidAt");

-- CreateIndex
CREATE UNIQUE INDEX "CoverageRemittanceLine_coverageId_key" ON "CoverageRemittanceLine"("coverageId");

-- CreateIndex
CREATE INDEX "CoverageRemittanceLine_remittanceId_idx" ON "CoverageRemittanceLine"("remittanceId");

-- AddForeignKey
ALTER TABLE "DiscountPolicy" ADD CONSTRAINT "DiscountPolicy_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscountPolicy" ADD CONSTRAINT "DiscountPolicy_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscountPolicy" ADD CONSTRAINT "DiscountPolicy_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceCoverage" ADD CONSTRAINT "InvoiceCoverage_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceCoverage" ADD CONSTRAINT "InvoiceCoverage_invoiceItemId_fkey" FOREIGN KEY ("invoiceItemId") REFERENCES "InvoiceItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceCoverage" ADD CONSTRAINT "InvoiceCoverage_hmoId_fkey" FOREIGN KEY ("hmoId") REFERENCES "Hmo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceCoverage" ADD CONSTRAINT "InvoiceCoverage_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "DiscountPolicy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceCoverage" ADD CONSTRAINT "InvoiceCoverage_payerStaffId_fkey" FOREIGN KEY ("payerStaffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceCoverage" ADD CONSTRAINT "InvoiceCoverage_appliedById_fkey" FOREIGN KEY ("appliedById") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceCoverage" ADD CONSTRAINT "InvoiceCoverage_reversedById_fkey" FOREIGN KEY ("reversedById") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoverageRemittance" ADD CONSTRAINT "CoverageRemittance_hmoId_fkey" FOREIGN KEY ("hmoId") REFERENCES "Hmo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoverageRemittance" ADD CONSTRAINT "CoverageRemittance_payerStaffId_fkey" FOREIGN KEY ("payerStaffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoverageRemittance" ADD CONSTRAINT "CoverageRemittance_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoverageRemittanceLine" ADD CONSTRAINT "CoverageRemittanceLine_remittanceId_fkey" FOREIGN KEY ("remittanceId") REFERENCES "CoverageRemittance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoverageRemittanceLine" ADD CONSTRAINT "CoverageRemittanceLine_coverageId_fkey" FOREIGN KEY ("coverageId") REFERENCES "InvoiceCoverage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
