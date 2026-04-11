-- Big-bang radiology refactor:
-- Removes ImagingRequest / ImagingOrder / ImagingCatalog / RadiologyRequest
-- and introduces RadiologyOrder + RadiologyOrderItem with item-level workflow links.

-- 1) New radiology order header and item tables
CREATE TABLE "RadiologyOrder" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "encounterId" TEXT,
    "requestedById" TEXT NOT NULL,
    "departmentId" TEXT,
    "status" "RadiologyRequestStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RadiologyOrder_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RadiologyOrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "clinicalNotes" TEXT,
    "reasonForInvestigation" TEXT,
    "priority" "RadiologyPriority" NOT NULL DEFAULT 'ROUTINE',
    "scanType" "RadiologyModality" NOT NULL,
    "bodyPart" TEXT,
    "status" "RadiologyRequestStatus" NOT NULL DEFAULT 'PENDING',
    "invoiceItemId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RadiologyOrderItem_pkey" PRIMARY KEY ("id")
);

-- 2) Backfill from existing RadiologyRequest (1 request -> 1 order + 1 item)
INSERT INTO "RadiologyOrder" ("id", "patientId", "encounterId", "requestedById", "departmentId", "status", "createdAt", "updatedAt")
SELECT
  rr."id",
  rr."patientId",
  rr."encounterId",
  rr."requestedById",
  rr."departmentId",
  rr."status",
  rr."createdAt",
  rr."updatedAt"
FROM "RadiologyRequest" rr;

INSERT INTO "RadiologyOrderItem" (
  "id",
  "orderId",
  "clinicalNotes",
  "reasonForInvestigation",
  "priority",
  "scanType",
  "bodyPart",
  "status",
  "invoiceItemId",
  "createdAt",
  "updatedAt"
)
SELECT
  rr."id",
  rr."id",
  rr."clinicalNotes",
  rr."reasonForInvestigation",
  rr."priority",
  rr."scanType",
  rr."bodyPart",
  rr."status",
  rr."invoiceItemId",
  rr."createdAt",
  rr."updatedAt"
FROM "RadiologyRequest" rr;

-- 3) Backfill legacy ImagingRequest into new structure
INSERT INTO "RadiologyOrder" ("id", "patientId", "encounterId", "requestedById", "departmentId", "status", "createdAt", "updatedAt")
SELECT
  ('imgreq-order-' || ir."id"),
  ir."patientId",
  ir."encounterId",
  ir."requestedByDoctorId",
  NULL,
  CASE ir."status"
    WHEN 'REQUESTED' THEN 'PENDING'::"RadiologyRequestStatus"
    WHEN 'IN_PROGRESS' THEN 'IN_PROGRESS'::"RadiologyRequestStatus"
    WHEN 'COMPLETED' THEN 'COMPLETED'::"RadiologyRequestStatus"
    WHEN 'CANCELLED' THEN 'CANCELLED'::"RadiologyRequestStatus"
    ELSE 'PENDING'::"RadiologyRequestStatus"
  END,
  ir."createdAt",
  ir."updatedAt"
FROM "ImagingRequest" ir;

INSERT INTO "RadiologyOrderItem" (
  "id",
  "orderId",
  "clinicalNotes",
  "reasonForInvestigation",
  "priority",
  "scanType",
  "bodyPart",
  "status",
  "invoiceItemId",
  "createdAt",
  "updatedAt"
)
SELECT
  ('imgreq-item-' || ir."id"),
  ('imgreq-order-' || ir."id"),
  ir."notes",
  ir."studyType",
  'ROUTINE'::"RadiologyPriority",
  CASE UPPER(COALESCE(ir."modality", 'OTHER'))
    WHEN 'X_RAY' THEN 'X_RAY'::"RadiologyModality"
    WHEN 'XRAY' THEN 'X_RAY'::"RadiologyModality"
    WHEN 'CT' THEN 'CT'::"RadiologyModality"
    WHEN 'MRI' THEN 'MRI'::"RadiologyModality"
    WHEN 'ULTRASOUND' THEN 'ULTRASOUND'::"RadiologyModality"
    WHEN 'MAMMOGRAPHY' THEN 'MAMMOGRAPHY'::"RadiologyModality"
    WHEN 'FLUOROSCOPY' THEN 'FLUOROSCOPY'::"RadiologyModality"
    ELSE 'OTHER'::"RadiologyModality"
  END,
  NULL,
  CASE ir."status"
    WHEN 'REQUESTED' THEN 'PENDING'::"RadiologyRequestStatus"
    WHEN 'IN_PROGRESS' THEN 'IN_PROGRESS'::"RadiologyRequestStatus"
    WHEN 'COMPLETED' THEN 'COMPLETED'::"RadiologyRequestStatus"
    WHEN 'CANCELLED' THEN 'CANCELLED'::"RadiologyRequestStatus"
    ELSE 'PENDING'::"RadiologyRequestStatus"
  END,
  NULL,
  ir."createdAt",
  ir."updatedAt"
FROM "ImagingRequest" ir;

-- 4) Backfill legacy ImagingOrder into new structure
INSERT INTO "RadiologyOrder" ("id", "patientId", "encounterId", "requestedById", "departmentId", "status", "createdAt", "updatedAt")
SELECT
  ('imgord-order-' || io."id"),
  e."patientId",
  io."encounterId",
  e."doctorId",
  NULL,
  CASE UPPER(COALESCE(io."status", 'ORDERED'))
    WHEN 'ORDERED' THEN 'PENDING'::"RadiologyRequestStatus"
    WHEN 'INPROGRESS' THEN 'IN_PROGRESS'::"RadiologyRequestStatus"
    WHEN 'COMPLETED' THEN 'COMPLETED'::"RadiologyRequestStatus"
    WHEN 'REPORTED' THEN 'REPORTED'::"RadiologyRequestStatus"
    WHEN 'CANCELLED' THEN 'CANCELLED'::"RadiologyRequestStatus"
    ELSE 'PENDING'::"RadiologyRequestStatus"
  END,
  COALESCE(io."createdAt", CURRENT_TIMESTAMP),
  COALESCE(io."updatedAt", CURRENT_TIMESTAMP)
FROM "ImagingOrder" io
JOIN "Encounter" e ON e."id" = io."encounterId";

INSERT INTO "RadiologyOrderItem" (
  "id",
  "orderId",
  "clinicalNotes",
  "reasonForInvestigation",
  "priority",
  "scanType",
  "bodyPart",
  "status",
  "invoiceItemId",
  "createdAt",
  "updatedAt"
)
SELECT
  ('imgord-item-' || io."id"),
  ('imgord-order-' || io."id"),
  io."notesToRadiologist",
  io."studyName",
  CASE UPPER(COALESCE(io."urgency", 'ROUTINE'))
    WHEN 'STAT' THEN 'EMERGENCY'::"RadiologyPriority"
    WHEN 'URGENT' THEN 'URGENT'::"RadiologyPriority"
    ELSE 'ROUTINE'::"RadiologyPriority"
  END,
  'OTHER'::"RadiologyModality",
  io."area",
  CASE UPPER(COALESCE(io."status", 'ORDERED'))
    WHEN 'ORDERED' THEN 'PENDING'::"RadiologyRequestStatus"
    WHEN 'INPROGRESS' THEN 'IN_PROGRESS'::"RadiologyRequestStatus"
    WHEN 'COMPLETED' THEN 'COMPLETED'::"RadiologyRequestStatus"
    WHEN 'REPORTED' THEN 'REPORTED'::"RadiologyRequestStatus"
    WHEN 'CANCELLED' THEN 'CANCELLED'::"RadiologyRequestStatus"
    ELSE 'PENDING'::"RadiologyRequestStatus"
  END,
  NULL,
  COALESCE(io."createdAt", CURRENT_TIMESTAMP),
  COALESCE(io."updatedAt", CURRENT_TIMESTAMP)
FROM "ImagingOrder" io;

-- 5) Move workflow links from request-level to order-item-level
ALTER TABLE "RadiologySchedule" ADD COLUMN "radiologyOrderItemId" TEXT;
ALTER TABLE "RadiologyProcedure" ADD COLUMN "radiologyOrderItemId" TEXT;
ALTER TABLE "RadiologyImage" ADD COLUMN "radiologyOrderItemId" TEXT;
ALTER TABLE "RadiologyStudyReport" ADD COLUMN "radiologyOrderItemId" TEXT;

UPDATE "RadiologySchedule" rs
SET "radiologyOrderItemId" = rs."radiologyRequestId";
UPDATE "RadiologyProcedure" rp
SET "radiologyOrderItemId" = rp."radiologyRequestId";
UPDATE "RadiologyImage" ri
SET "radiologyOrderItemId" = ri."radiologyRequestId";
UPDATE "RadiologyStudyReport" rr
SET "radiologyOrderItemId" = rr."radiologyRequestId";

ALTER TABLE "RadiologySchedule" ALTER COLUMN "radiologyOrderItemId" SET NOT NULL;
ALTER TABLE "RadiologyProcedure" ALTER COLUMN "radiologyOrderItemId" SET NOT NULL;
ALTER TABLE "RadiologyImage" ALTER COLUMN "radiologyOrderItemId" SET NOT NULL;
ALTER TABLE "RadiologyStudyReport" ALTER COLUMN "radiologyOrderItemId" SET NOT NULL;

ALTER TABLE "RadiologySchedule" DROP CONSTRAINT IF EXISTS "RadiologySchedule_radiologyRequestId_fkey";
ALTER TABLE "RadiologyProcedure" DROP CONSTRAINT IF EXISTS "RadiologyProcedure_radiologyRequestId_fkey";
ALTER TABLE "RadiologyImage" DROP CONSTRAINT IF EXISTS "RadiologyImage_radiologyRequestId_fkey";
ALTER TABLE "RadiologyStudyReport" DROP CONSTRAINT IF EXISTS "RadiologyStudyReport_radiologyRequestId_fkey";

ALTER TABLE "RadiologySchedule" DROP COLUMN IF EXISTS "radiologyRequestId";
ALTER TABLE "RadiologyProcedure" DROP COLUMN IF EXISTS "radiologyRequestId";
ALTER TABLE "RadiologyImage" DROP COLUMN IF EXISTS "radiologyRequestId";
ALTER TABLE "RadiologyStudyReport" DROP COLUMN IF EXISTS "radiologyRequestId";

ALTER TABLE "RadiologySchedule" ADD CONSTRAINT "RadiologySchedule_radiologyOrderItemId_fkey" FOREIGN KEY ("radiologyOrderItemId") REFERENCES "RadiologyOrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RadiologyProcedure" ADD CONSTRAINT "RadiologyProcedure_radiologyOrderItemId_fkey" FOREIGN KEY ("radiologyOrderItemId") REFERENCES "RadiologyOrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RadiologyImage" ADD CONSTRAINT "RadiologyImage_radiologyOrderItemId_fkey" FOREIGN KEY ("radiologyOrderItemId") REFERENCES "RadiologyOrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RadiologyStudyReport" ADD CONSTRAINT "RadiologyStudyReport_radiologyOrderItemId_fkey" FOREIGN KEY ("radiologyOrderItemId") REFERENCES "RadiologyOrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 6) New indexes and constraints
CREATE UNIQUE INDEX "RadiologyOrderItem_invoiceItemId_key" ON "RadiologyOrderItem"("invoiceItemId");
CREATE INDEX "RadiologyOrder_patientId_idx" ON "RadiologyOrder"("patientId");
CREATE INDEX "RadiologyOrder_status_idx" ON "RadiologyOrder"("status");
CREATE INDEX "RadiologyOrder_requestedById_idx" ON "RadiologyOrder"("requestedById");
CREATE INDEX "RadiologyOrder_createdAt_idx" ON "RadiologyOrder"("createdAt");
CREATE INDEX "RadiologyOrderItem_orderId_idx" ON "RadiologyOrderItem"("orderId");
CREATE INDEX "RadiologyOrderItem_status_idx" ON "RadiologyOrderItem"("status");
CREATE INDEX "RadiologyOrderItem_priority_idx" ON "RadiologyOrderItem"("priority");
CREATE INDEX "RadiologyOrderItem_invoiceItemId_idx" ON "RadiologyOrderItem"("invoiceItemId");
CREATE UNIQUE INDEX "RadiologySchedule_radiologyOrderItemId_key" ON "RadiologySchedule"("radiologyOrderItemId");
CREATE UNIQUE INDEX "RadiologyProcedure_radiologyOrderItemId_key" ON "RadiologyProcedure"("radiologyOrderItemId");
CREATE INDEX "RadiologyImage_radiologyOrderItemId_idx" ON "RadiologyImage"("radiologyOrderItemId");
CREATE UNIQUE INDEX "RadiologyStudyReport_radiologyOrderItemId_key" ON "RadiologyStudyReport"("radiologyOrderItemId");

-- 7) Foreign keys for new tables
ALTER TABLE "RadiologyOrder" ADD CONSTRAINT "RadiologyOrder_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RadiologyOrder" ADD CONSTRAINT "RadiologyOrder_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "Encounter"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RadiologyOrder" ADD CONSTRAINT "RadiologyOrder_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RadiologyOrder" ADD CONSTRAINT "RadiologyOrder_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RadiologyOrderItem" ADD CONSTRAINT "RadiologyOrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "RadiologyOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RadiologyOrderItem" ADD CONSTRAINT "RadiologyOrderItem_invoiceItemId_fkey" FOREIGN KEY ("invoiceItemId") REFERENCES "InvoiceItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 8) Drop legacy objects and related FKs
DROP TABLE IF EXISTS "ImagingRequest";
DROP TABLE IF EXISTS "ImagingOrder";
DROP TABLE IF EXISTS "ImagingCatalog";
DROP TABLE IF EXISTS "RadiologyRequest";
DROP TYPE IF EXISTS "ImagingRequestStatus";
