-- AlterTable: PatientFamilyLink principal flag
ALTER TABLE "PatientFamilyLink" ADD COLUMN "isPrincipal" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: Prescription schedule controls
ALTER TABLE "Prescription" ADD COLUMN "patientScheduleStartAt" TIMESTAMP(3),
ADD COLUMN "scheduleConfirmedAt" TIMESTAMP(3);

-- AlterTable: PatientMedicationDoseLog reminder / miss tracking
ALTER TABLE "PatientMedicationDoseLog" ADD COLUMN "missedAt" TIMESTAMP(3),
ADD COLUMN "lastReminderAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "PatientFamilyLink_childPatientId_isPrincipal_idx" ON "PatientFamilyLink"("childPatientId", "isPrincipal");

-- CreateIndex
CREATE INDEX "PatientMedicationDoseLog_status_scheduledAt_idx" ON "PatientMedicationDoseLog"("status", "scheduledAt");

-- Backfill: earliest parent link per child is principal
UPDATE "PatientFamilyLink" AS pfl
SET "isPrincipal" = true
FROM (
  SELECT DISTINCT ON ("childPatientId") id
  FROM "PatientFamilyLink"
  ORDER BY "childPatientId", "createdAt" ASC
) AS earliest
WHERE pfl.id = earliest.id;

-- Existing outpatient prescriptions: treat as already confirmed so reminders work
UPDATE "Prescription"
SET "scheduleConfirmedAt" = COALESCE("startDate", NOW())
WHERE "type" = 'OUTPATIENT'
  AND "scheduleConfirmedAt" IS NULL;
