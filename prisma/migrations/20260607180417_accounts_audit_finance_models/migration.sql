-- CreateEnum
CREATE TYPE "FinanceReconciliationStatus" AS ENUM ('open', 'submitted', 'closed');

-- CreateEnum
CREATE TYPE "FinanceApprovalType" AS ENUM ('REFUND', 'WRITE_OFF', 'JOURNAL_ADJUSTMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "FinanceApprovalStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "FiscalPeriodStatus" AS ENUM ('open', 'closed');

-- CreateEnum
CREATE TYPE "ChartOfAccountType" AS ENUM ('asset', 'liability', 'equity', 'revenue', 'expense');

-- CreateTable
CREATE TABLE "FinanceComplianceItem" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "CmdComplianceStatus" NOT NULL DEFAULT 'Pending',
    "lastCheckedAt" TIMESTAMP(3),
    "acknowledgedAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "FinanceComplianceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyCashReconciliation" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "countedCash" DECIMAL(12,2),
    "expectedCash" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "variance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" "FinanceReconciliationStatus" NOT NULL DEFAULT 'open',
    "notes" TEXT,
    "submittedById" TEXT,
    "closedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyCashReconciliation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankReconciliation" (
    "id" TEXT NOT NULL,
    "bankId" TEXT NOT NULL,
    "statementDate" DATE NOT NULL,
    "bookBalance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "statementBalance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "variance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" "FinanceReconciliationStatus" NOT NULL DEFAULT 'open',
    "closedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankReconciliation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceApproval" (
    "id" TEXT NOT NULL,
    "type" "FinanceApprovalType" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "requesterId" TEXT NOT NULL,
    "status" "FinanceApprovalStatus" NOT NULL DEFAULT 'pending',
    "entityRef" TEXT,
    "detail" TEXT,
    "note" TEXT,
    "reason" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FiscalPeriod" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "status" "FiscalPeriodStatus" NOT NULL DEFAULT 'open',
    "closedAt" TIMESTAMP(3),
    "closedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FiscalPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChartOfAccount" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ChartOfAccountType" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "balance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChartOfAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalEntry" (
    "id" TEXT NOT NULL,
    "entryDate" DATE NOT NULL,
    "reference" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "debitAccountId" TEXT NOT NULL,
    "creditAccountId" TEXT NOT NULL,
    "fiscalPeriodId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JournalEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseBudget" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "budgetAmount" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpenseBudget_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FinanceComplianceItem_code_key" ON "FinanceComplianceItem"("code");

-- CreateIndex
CREATE INDEX "FinanceComplianceItem_status_idx" ON "FinanceComplianceItem"("status");

-- CreateIndex
CREATE UNIQUE INDEX "DailyCashReconciliation_date_key" ON "DailyCashReconciliation"("date");

-- CreateIndex
CREATE INDEX "DailyCashReconciliation_status_idx" ON "DailyCashReconciliation"("status");

-- CreateIndex
CREATE INDEX "BankReconciliation_bankId_statementDate_idx" ON "BankReconciliation"("bankId", "statementDate");

-- CreateIndex
CREATE INDEX "BankReconciliation_status_idx" ON "BankReconciliation"("status");

-- CreateIndex
CREATE INDEX "FinanceApproval_status_idx" ON "FinanceApproval"("status");

-- CreateIndex
CREATE INDEX "FinanceApproval_requesterId_idx" ON "FinanceApproval"("requesterId");

-- CreateIndex
CREATE INDEX "FiscalPeriod_status_idx" ON "FiscalPeriod"("status");

-- CreateIndex
CREATE INDEX "FiscalPeriod_startDate_endDate_idx" ON "FiscalPeriod"("startDate", "endDate");

-- CreateIndex
CREATE UNIQUE INDEX "ChartOfAccount_code_key" ON "ChartOfAccount"("code");

-- CreateIndex
CREATE INDEX "ChartOfAccount_type_idx" ON "ChartOfAccount"("type");

-- CreateIndex
CREATE INDEX "ChartOfAccount_isActive_idx" ON "ChartOfAccount"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "JournalEntry_reference_key" ON "JournalEntry"("reference");

-- CreateIndex
CREATE INDEX "JournalEntry_entryDate_idx" ON "JournalEntry"("entryDate");

-- CreateIndex
CREATE INDEX "JournalEntry_fiscalPeriodId_idx" ON "JournalEntry"("fiscalPeriodId");

-- CreateIndex
CREATE INDEX "ExpenseBudget_category_idx" ON "ExpenseBudget"("category");

-- CreateIndex
CREATE INDEX "ExpenseBudget_periodStart_periodEnd_idx" ON "ExpenseBudget"("periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "InvoiceItem_createdAt_idx" ON "InvoiceItem"("createdAt");

-- AddForeignKey
ALTER TABLE "FinanceComplianceItem" ADD CONSTRAINT "FinanceComplianceItem_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyCashReconciliation" ADD CONSTRAINT "DailyCashReconciliation_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyCashReconciliation" ADD CONSTRAINT "DailyCashReconciliation_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankReconciliation" ADD CONSTRAINT "BankReconciliation_bankId_fkey" FOREIGN KEY ("bankId") REFERENCES "Bank"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankReconciliation" ADD CONSTRAINT "BankReconciliation_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceApproval" ADD CONSTRAINT "FinanceApproval_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceApproval" ADD CONSTRAINT "FinanceApproval_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiscalPeriod" ADD CONSTRAINT "FiscalPeriod_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChartOfAccount" ADD CONSTRAINT "ChartOfAccount_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ChartOfAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_debitAccountId_fkey" FOREIGN KEY ("debitAccountId") REFERENCES "ChartOfAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_creditAccountId_fkey" FOREIGN KEY ("creditAccountId") REFERENCES "ChartOfAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_fiscalPeriodId_fkey" FOREIGN KEY ("fiscalPeriodId") REFERENCES "FiscalPeriod"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed finance compliance checklist
INSERT INTO "FinanceComplianceItem" ("id", "code", "description", "status", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid()::text, 'FIN-001', 'Daily cash reconciliation completed', 'Pending', NOW(), NOW()),
  (gen_random_uuid()::text, 'FIN-002', 'Bank reconciliation current', 'Pending', NOW(), NOW())
ON CONFLICT ("code") DO NOTHING;

-- Seed starter chart of accounts
INSERT INTO "ChartOfAccount" ("id", "code", "name", "type", "isActive", "balance", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid()::text, '1000', 'Cash on hand', 'asset', true, 0, NOW(), NOW()),
  (gen_random_uuid()::text, '1200', 'Accounts receivable', 'asset', true, 0, NOW(), NOW()),
  (gen_random_uuid()::text, '4000', 'Patient revenue', 'revenue', true, 0, NOW(), NOW()),
  (gen_random_uuid()::text, '5000', 'Salaries expense', 'expense', true, 0, NOW(), NOW()),
  (gen_random_uuid()::text, '5100', 'Supplies expense', 'expense', true, 0, NOW(), NOW())
ON CONFLICT ("code") DO NOTHING;

-- Seed current fiscal period (June 2026)
INSERT INTO "FiscalPeriod" ("id", "label", "startDate", "endDate", "status", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid()::text, 'June 2026', '2026-06-01', '2026-06-30', 'open', NOW(), NOW())
ON CONFLICT DO NOTHING;
