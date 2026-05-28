-- CreateEnum
CREATE TYPE "CmdCommunicationPriority" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "CmdIntegrationHealthStatus" AS ENUM ('healthy', 'degraded', 'down');

-- CreateEnum
CREATE TYPE "CmdComplianceStatus" AS ENUM ('Compliant', 'Pending', 'NonCompliant');

-- CreateTable
CREATE TABLE "CmdCommunication" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "audience" TEXT NOT NULL,
    "priority" "CmdCommunicationPriority" NOT NULL DEFAULT 'MEDIUM',
    "scheduledFor" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "CmdCommunication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CmdReportTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cadence" TEXT NOT NULL,
    "formatsSupported" TEXT[],
    "lastGeneratedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "CmdReportTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CmdIntegrationStatus" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "CmdIntegrationHealthStatus" NOT NULL DEFAULT 'healthy',
    "lastSyncAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "CmdIntegrationStatus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CmdComplianceItem" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "CmdComplianceStatus" NOT NULL DEFAULT 'Pending',
    "evidenceUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "CmdComplianceItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CmdCommunication_createdAt_idx" ON "CmdCommunication"("createdAt");

-- CreateIndex
CREATE INDEX "CmdCommunication_sentAt_idx" ON "CmdCommunication"("sentAt");

-- CreateIndex
CREATE UNIQUE INDEX "CmdReportTemplate_name_key" ON "CmdReportTemplate"("name");

-- CreateIndex
CREATE UNIQUE INDEX "CmdIntegrationStatus_name_key" ON "CmdIntegrationStatus"("name");

-- CreateIndex
CREATE UNIQUE INDEX "CmdComplianceItem_code_key" ON "CmdComplianceItem"("code");

-- CreateIndex
CREATE INDEX "CmdComplianceItem_status_idx" ON "CmdComplianceItem"("status");

-- AddForeignKey
ALTER TABLE "CmdCommunication" ADD CONSTRAINT "CmdCommunication_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CmdReportTemplate" ADD CONSTRAINT "CmdReportTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CmdIntegrationStatus" ADD CONSTRAINT "CmdIntegrationStatus_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CmdComplianceItem" ADD CONSTRAINT "CmdComplianceItem_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
