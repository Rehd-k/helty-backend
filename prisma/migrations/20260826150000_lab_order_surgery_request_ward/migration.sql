-- AlterTable LabOrder
ALTER TABLE "LabOrder" ADD COLUMN "admissionId" TEXT,
ADD COLUMN "wardId" TEXT;

CREATE INDEX "LabOrder_admissionId_idx" ON "LabOrder"("admissionId");
CREATE INDEX "LabOrder_wardId_idx" ON "LabOrder"("wardId");

ALTER TABLE "LabOrder" ADD CONSTRAINT "LabOrder_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "Admission"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LabOrder" ADD CONSTRAINT "LabOrder_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "Ward"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable SurgeryRequest
ALTER TABLE "SurgeryRequest" ADD COLUMN "wardId" TEXT;

CREATE INDEX "SurgeryRequest_wardId_idx" ON "SurgeryRequest"("wardId");

ALTER TABLE "SurgeryRequest" ADD CONSTRAINT "SurgeryRequest_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "Ward"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill LabOrder from linked LabRequest via shared invoiceItemId
UPDATE "LabOrder" AS lo
SET
  "admissionId" = lr."admissionId",
  "wardId" = lr."wardId"
FROM "LabRequest" AS lr
WHERE lo."invoiceItemId" IS NOT NULL
  AND lr."invoiceItemId" = lo."invoiceItemId"
  AND lr."status" <> 'CANCELLED'
  AND (lo."admissionId" IS NULL OR lo."wardId" IS NULL);

-- Backfill SurgeryRequest ward from linked Admission
UPDATE "SurgeryRequest" AS sr
SET "wardId" = a."wardId"
FROM "Admission" AS a
WHERE sr."admissionId" IS NOT NULL
  AND a."id" = sr."admissionId"
  AND sr."wardId" IS NULL
  AND a."wardId" IS NOT NULL;
