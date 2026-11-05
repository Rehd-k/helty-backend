-- AlterEnum
ALTER TYPE "AccountType" ADD VALUE 'DISPLAY';

-- AlterEnum
ALTER TYPE "StaffRole" ADD VALUE 'DISPLAY_SCREEN';

-- CreateEnum
CREATE TYPE "DisplayLane" AS ENUM ('TRIAGE', 'CONSULTATION', 'PHARMACY', 'RADIOLOGY', 'LAB', 'ALL');

-- AlterTable
ALTER TABLE "Staff" ADD COLUMN "displayLane" "DisplayLane";

-- CreateTable
CREATE TABLE "DisplayVideo" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DisplayVideo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DisplayVideo_isActive_sortOrder_idx" ON "DisplayVideo"("isActive", "sortOrder");

-- AddForeignKey
ALTER TABLE "DisplayVideo" ADD CONSTRAINT "DisplayVideo_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
