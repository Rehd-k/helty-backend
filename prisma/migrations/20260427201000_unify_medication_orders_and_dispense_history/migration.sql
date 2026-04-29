-- Add new lifecycle enum for inpatient administration state.
CREATE TYPE "MedicationAdministrationLifecycleStatus" AS ENUM ('ACTIVE', 'STOPPED');

-- Expand MedicationOrder to carry inpatient fields and make drug optional for legacy backfill.
ALTER TABLE "MedicationOrder"
ADD COLUMN "admissionId" TEXT,
ADD COLUMN "startDateTime" TIMESTAMP(3),
ADD COLUMN "endDateTime" TIMESTAMP(3),
ADD COLUMN "notes" TEXT,
ADD COLUMN "administrationStatus" "MedicationAdministrationLifecycleStatus" NOT NULL DEFAULT 'ACTIVE';

ALTER TABLE "MedicationOrder"
ALTER COLUMN "drugId" DROP NOT NULL;

ALTER TABLE "MedicationOrder"
ADD CONSTRAINT "MedicationOrder_admissionId_fkey"
FOREIGN KEY ("admissionId") REFERENCES "Admission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "MedicationOrder_admissionId_idx" ON "MedicationOrder"("admissionId");

-- Backfill AdmissionMedicationOrder into MedicationOrder as a single source.
INSERT INTO "MedicationOrder" (
  "id",
  "encounterId",
  "admissionId",
  "drugId",
  "drugName",
  "dose",
  "frequency",
  "duration",
  "route",
  "specialInstructions",
  "startDateTime",
  "endDateTime",
  "notes",
  "administrationStatus",
  "patientId",
  "doctorId",
  "status",
  "createdAt",
  "updatedAt"
)
SELECT
  amo."id",
  e."id" AS "encounterId",
  amo."admissionId",
  NULL AS "drugId",
  amo."drugName",
  amo."dose",
  amo."frequency",
  NULL AS "duration",
  amo."route"::text AS "route",
  NULL AS "specialInstructions",
  amo."startDateTime",
  amo."endDateTime",
  amo."notes",
  CASE
    WHEN amo."status" = 'STOPPED' THEN 'STOPPED'::"MedicationAdministrationLifecycleStatus"
    ELSE 'ACTIVE'::"MedicationAdministrationLifecycleStatus"
  END AS "administrationStatus",
  a."patientId",
  amo."prescribedByDoctorId" AS "doctorId",
  'Pending Dispense' AS "status",
  amo."createdAt",
  amo."updatedAt"
FROM "AdmissionMedicationOrder" amo
INNER JOIN "Admission" a ON a."id" = amo."admissionId"
INNER JOIN "Encounter" e ON e."admissionId" = amo."admissionId"
ON CONFLICT ("id") DO NOTHING;

-- Repoint MedicationAdministration to MedicationOrder.
ALTER TABLE "MedicationAdministration" DROP CONSTRAINT "MedicationAdministration_medicationOrderId_fkey";
ALTER TABLE "MedicationAdministration"
ADD CONSTRAINT "MedicationAdministration_medicationOrderId_fkey"
FOREIGN KEY ("medicationOrderId") REFERENCES "MedicationOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Add consumable pricing columns.
ALTER TABLE "ConsumableBatch"
ADD COLUMN "costPrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN "sellingPrice" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- Remove obsolete admission-specific medication model and enums.
DROP TABLE "AdmissionMedicationOrder";
DROP TYPE "MedicationOrderStatus";
DROP TYPE "MedicationRoute";
