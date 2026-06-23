-- CreateEnum
CREATE TYPE "MedicationScheduleStatus" AS ENUM ('NOT_STARTED', 'ACTIVE', 'DUE_SOON', 'OVERDUE', 'EXPIRED', 'STOPPED');

-- CreateEnum
CREATE TYPE "RxDurationUnit" AS ENUM ('DAYS', 'WEEKS', 'MONTHS', 'YEARS', 'HOURS');

-- CreateEnum
CREATE TYPE "AdmissionAlertType" AS ENUM ('GENERIC', 'MEDICATION_DOSE_DUE', 'MEDICATION_DOSE_OVERDUE', 'MEDICATION_COURSE_EXPIRED');

-- CreateTable
CREATE TABLE "MedicationOrderSchedule" (
    "id" TEXT NOT NULL,
    "medicationOrderId" TEXT NOT NULL,
    "scheduleStartedAt" TIMESTAMP(3),
    "courseEndsAt" TIMESTAMP(3),
    "nextDueAt" TIMESTAMP(3),
    "lastAdministeredAt" TIMESTAMP(3),
    "doseSequenceNumber" INTEGER NOT NULL DEFAULT 0,
    "scheduleStatus" "MedicationScheduleStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "dosesPerDay" DECIMAL(12,6),
    "frequencyIntervalHours" DECIMAL(12,6),
    "durationValue" INTEGER,
    "durationUnit" "RxDurationUnit",
    "beyondDurationConsentAt" TIMESTAMP(3),
    "beyondDurationConsentById" TEXT,
    "beyondDurationConsentNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MedicationOrderSchedule_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "AlertLog" ADD COLUMN     "type" "AdmissionAlertType" NOT NULL DEFAULT 'GENERIC',
ADD COLUMN     "medicationOrderId" TEXT,
ADD COLUMN     "dueAt" TIMESTAMP(3),
ADD COLUMN     "metadata" JSONB;

-- AlterTable
ALTER TABLE "MedicationAdministration" ADD COLUMN     "doseNumber" INTEGER,
ADD COLUMN     "isFirstDose" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "MedicationOrderSchedule_medicationOrderId_key" ON "MedicationOrderSchedule"("medicationOrderId");

-- CreateIndex
CREATE INDEX "MedicationOrderSchedule_scheduleStatus_idx" ON "MedicationOrderSchedule"("scheduleStatus");

-- CreateIndex
CREATE INDEX "MedicationOrderSchedule_nextDueAt_idx" ON "MedicationOrderSchedule"("nextDueAt");

-- CreateIndex
CREATE INDEX "MedicationOrderSchedule_courseEndsAt_idx" ON "MedicationOrderSchedule"("courseEndsAt");

-- CreateIndex
CREATE INDEX "AlertLog_medicationOrderId_idx" ON "AlertLog"("medicationOrderId");

-- CreateIndex
CREATE INDEX "AlertLog_type_idx" ON "AlertLog"("type");

-- AddForeignKey
ALTER TABLE "MedicationOrderSchedule" ADD CONSTRAINT "MedicationOrderSchedule_medicationOrderId_fkey" FOREIGN KEY ("medicationOrderId") REFERENCES "MedicationOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicationOrderSchedule" ADD CONSTRAINT "MedicationOrderSchedule_beyondDurationConsentById_fkey" FOREIGN KEY ("beyondDurationConsentById") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertLog" ADD CONSTRAINT "AlertLog_medicationOrderId_fkey" FOREIGN KEY ("medicationOrderId") REFERENCES "MedicationOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: NOT_STARTED schedule for all inpatient orders
INSERT INTO "MedicationOrderSchedule" ("id", "medicationOrderId", "scheduleStatus", "doseSequenceNumber", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, mo."id", 'NOT_STARTED', 0, NOW(), NOW()
FROM "MedicationOrder" mo
WHERE mo."admissionId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "MedicationOrderSchedule" mos WHERE mos."medicationOrderId" = mo."id"
  );
