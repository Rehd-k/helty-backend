-- CreateEnum
CREATE TYPE "PatientCycleFlow" AS ENUM ('LIGHT', 'MEDIUM', 'HEAVY');

-- CreateTable
CREATE TABLE "PatientCycleSettings" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "cycleLengthDays" INTEGER NOT NULL DEFAULT 28,
    "periodLengthDays" INTEGER NOT NULL DEFAULT 5,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PatientCycleSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatientCyclePeriod" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "flow" "PatientCycleFlow",
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PatientCyclePeriod_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PatientCycleSettings_patientId_key" ON "PatientCycleSettings"("patientId");

-- CreateIndex
CREATE INDEX "PatientCyclePeriod_patientId_idx" ON "PatientCyclePeriod"("patientId");

-- CreateIndex
CREATE INDEX "PatientCyclePeriod_patientId_startDate_idx" ON "PatientCyclePeriod"("patientId", "startDate");

-- CreateIndex
CREATE UNIQUE INDEX "PatientCyclePeriod_patientId_startDate_key" ON "PatientCyclePeriod"("patientId", "startDate");

-- AddForeignKey
ALTER TABLE "PatientCycleSettings" ADD CONSTRAINT "PatientCycleSettings_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientCyclePeriod" ADD CONSTRAINT "PatientCyclePeriod_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
