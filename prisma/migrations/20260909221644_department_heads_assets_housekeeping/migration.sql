-- CreateEnum
CREATE TYPE "HospitalAssetKind" AS ENUM ('EQUIPMENT', 'MACHINERY', 'VEHICLE', 'FURNITURE', 'OTHER');

-- CreateEnum
CREATE TYPE "HospitalAssetStatus" AS ENUM ('IN_USE', 'UNDER_REPAIR', 'DECOMMISSIONED', 'TRANSFERRED');

-- CreateEnum
CREATE TYPE "HospitalAssetLogType" AS ENUM ('CREATED', 'USAGE', 'MOVEMENT', 'MAINTENANCE', 'STATUS_CHANGE', 'TRANSFER');

-- CreateEnum
CREATE TYPE "HousekeepingAreaKind" AS ENUM ('ROOM', 'WARD', 'CORRIDOR', 'TOILET', 'GROUNDS', 'OTHER');

-- CreateEnum
CREATE TYPE "HousekeepingSupplyAction" AS ENUM ('ISSUED', 'USED', 'RESTOCKED');

-- AlterEnum
ALTER TYPE "AccountType" ADD VALUE 'JANITOR';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "StaffRole" ADD VALUE 'PHYSICIAN_HEAD';
ALTER TYPE "StaffRole" ADD VALUE 'SPECIALIST';
ALTER TYPE "StaffRole" ADD VALUE 'HOUSE_OFFICER';
ALTER TYPE "StaffRole" ADD VALUE 'MEDICAL_OFFICER';
ALTER TYPE "StaffRole" ADD VALUE 'MEDICAL_RECORDS_HEAD';
ALTER TYPE "StaffRole" ADD VALUE 'FRONT_DESK_HEAD';
ALTER TYPE "StaffRole" ADD VALUE 'ICT_HEAD';
ALTER TYPE "StaffRole" ADD VALUE 'HMO_HEAD';
ALTER TYPE "StaffRole" ADD VALUE 'JANITOR_HEAD';

-- CreateTable
CREATE TABLE "DepartmentShiftRoster" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "accountType" "AccountType" NOT NULL,
    "shiftDate" TIMESTAMP(3) NOT NULL,
    "shiftType" "ShiftType" NOT NULL,
    "assignedById" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DepartmentShiftRoster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HospitalAsset" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "assetTag" TEXT NOT NULL,
    "kind" "HospitalAssetKind" NOT NULL,
    "status" "HospitalAssetStatus" NOT NULL DEFAULT 'IN_USE',
    "accountType" "AccountType" NOT NULL,
    "serialNumber" TEXT,
    "manufacturer" TEXT,
    "model" TEXT,
    "locationNote" TEXT,
    "acquiredAt" TIMESTAMP(3),
    "notes" TEXT,
    "transferredToNote" TEXT,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HospitalAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HospitalAssetLog" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "type" "HospitalAssetLogType" NOT NULL,
    "fromStatus" "HospitalAssetStatus",
    "toStatus" "HospitalAssetStatus",
    "fromAccountType" "AccountType",
    "toAccountType" "AccountType",
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HospitalAssetLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HospitalAssetAccessGrant" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "accountType" "AccountType" NOT NULL,
    "canView" BOOLEAN NOT NULL DEFAULT true,
    "canLog" BOOLEAN NOT NULL DEFAULT false,
    "grantedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HospitalAssetAccessGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HousekeepingWorker" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HousekeepingWorker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HousekeepingArea" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "HousekeepingAreaKind" NOT NULL DEFAULT 'OTHER',
    "notes" TEXT,
    "wardId" TEXT,
    "consultingRoomId" TEXT,
    "theatreRoomId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HousekeepingArea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HousekeepingAssignment" (
    "id" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "areaId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HousekeepingAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HousekeepingShiftRoster" (
    "id" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "shiftDate" TIMESTAMP(3) NOT NULL,
    "shiftType" "ShiftType" NOT NULL,
    "assignedById" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HousekeepingShiftRoster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HousekeepingSupplyLog" (
    "id" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "quantity" DECIMAL(12,2) NOT NULL,
    "unit" TEXT NOT NULL,
    "action" "HousekeepingSupplyAction" NOT NULL,
    "workerId" TEXT,
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HousekeepingSupplyLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DepartmentShiftRoster_accountType_shiftDate_idx" ON "DepartmentShiftRoster"("accountType", "shiftDate");

-- CreateIndex
CREATE INDEX "DepartmentShiftRoster_shiftDate_shiftType_idx" ON "DepartmentShiftRoster"("shiftDate", "shiftType");

-- CreateIndex
CREATE UNIQUE INDEX "DepartmentShiftRoster_staffId_shiftDate_shiftType_key" ON "DepartmentShiftRoster"("staffId", "shiftDate", "shiftType");

-- CreateIndex
CREATE UNIQUE INDEX "HospitalAsset_assetTag_key" ON "HospitalAsset"("assetTag");

-- CreateIndex
CREATE INDEX "HospitalAsset_accountType_status_idx" ON "HospitalAsset"("accountType", "status");

-- CreateIndex
CREATE INDEX "HospitalAsset_kind_idx" ON "HospitalAsset"("kind");

-- CreateIndex
CREATE INDEX "HospitalAsset_status_idx" ON "HospitalAsset"("status");

-- CreateIndex
CREATE INDEX "HospitalAssetLog_assetId_createdAt_idx" ON "HospitalAssetLog"("assetId", "createdAt");

-- CreateIndex
CREATE INDEX "HospitalAssetAccessGrant_accountType_idx" ON "HospitalAssetAccessGrant"("accountType");

-- CreateIndex
CREATE UNIQUE INDEX "HospitalAssetAccessGrant_staffId_accountType_key" ON "HospitalAssetAccessGrant"("staffId", "accountType");

-- CreateIndex
CREATE INDEX "HousekeepingWorker_isActive_idx" ON "HousekeepingWorker"("isActive");

-- CreateIndex
CREATE INDEX "HousekeepingArea_kind_idx" ON "HousekeepingArea"("kind");

-- CreateIndex
CREATE INDEX "HousekeepingArea_isActive_idx" ON "HousekeepingArea"("isActive");

-- CreateIndex
CREATE INDEX "HousekeepingAssignment_areaId_idx" ON "HousekeepingAssignment"("areaId");

-- CreateIndex
CREATE UNIQUE INDEX "HousekeepingAssignment_workerId_areaId_key" ON "HousekeepingAssignment"("workerId", "areaId");

-- CreateIndex
CREATE INDEX "HousekeepingShiftRoster_shiftDate_shiftType_idx" ON "HousekeepingShiftRoster"("shiftDate", "shiftType");

-- CreateIndex
CREATE UNIQUE INDEX "HousekeepingShiftRoster_workerId_shiftDate_shiftType_key" ON "HousekeepingShiftRoster"("workerId", "shiftDate", "shiftType");

-- CreateIndex
CREATE INDEX "HousekeepingSupplyLog_createdAt_idx" ON "HousekeepingSupplyLog"("createdAt");

-- CreateIndex
CREATE INDEX "HousekeepingSupplyLog_itemName_idx" ON "HousekeepingSupplyLog"("itemName");

-- CreateIndex
CREATE INDEX "Staff_accountType_idx" ON "Staff"("accountType");

-- AddForeignKey
ALTER TABLE "DepartmentShiftRoster" ADD CONSTRAINT "DepartmentShiftRoster_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepartmentShiftRoster" ADD CONSTRAINT "DepartmentShiftRoster_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HospitalAsset" ADD CONSTRAINT "HospitalAsset_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HospitalAsset" ADD CONSTRAINT "HospitalAsset_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HospitalAssetLog" ADD CONSTRAINT "HospitalAssetLog_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "HospitalAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HospitalAssetLog" ADD CONSTRAINT "HospitalAssetLog_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HospitalAssetAccessGrant" ADD CONSTRAINT "HospitalAssetAccessGrant_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HospitalAssetAccessGrant" ADD CONSTRAINT "HospitalAssetAccessGrant_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HousekeepingWorker" ADD CONSTRAINT "HousekeepingWorker_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HousekeepingWorker" ADD CONSTRAINT "HousekeepingWorker_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HousekeepingArea" ADD CONSTRAINT "HousekeepingArea_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "Ward"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HousekeepingArea" ADD CONSTRAINT "HousekeepingArea_consultingRoomId_fkey" FOREIGN KEY ("consultingRoomId") REFERENCES "ConsultingRoom"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HousekeepingArea" ADD CONSTRAINT "HousekeepingArea_theatreRoomId_fkey" FOREIGN KEY ("theatreRoomId") REFERENCES "TheatreRoom"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HousekeepingArea" ADD CONSTRAINT "HousekeepingArea_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HousekeepingArea" ADD CONSTRAINT "HousekeepingArea_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HousekeepingAssignment" ADD CONSTRAINT "HousekeepingAssignment_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "HousekeepingWorker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HousekeepingAssignment" ADD CONSTRAINT "HousekeepingAssignment_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "HousekeepingArea"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HousekeepingShiftRoster" ADD CONSTRAINT "HousekeepingShiftRoster_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "HousekeepingWorker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HousekeepingShiftRoster" ADD CONSTRAINT "HousekeepingShiftRoster_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HousekeepingSupplyLog" ADD CONSTRAINT "HousekeepingSupplyLog_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "HousekeepingWorker"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HousekeepingSupplyLog" ADD CONSTRAINT "HousekeepingSupplyLog_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
