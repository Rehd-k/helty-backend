-- Consumables: move inventory from PharmacyLocation to StoreLocation; invoice + usage allocations.

-- CreateEnum
CREATE TYPE "ConsumableAllocationDirection" AS ENUM ('OUT', 'IN');

-- CreateEnum
CREATE TYPE "ConsumableUsageDirection" AS ENUM ('USE', 'RETURN');

-- CreateEnum
CREATE TYPE "ConsumableUsageSource" AS ENUM ('NURSING', 'ENCOUNTER_PROCEDURE');

-- AlterEnum
ALTER TYPE "MovementReferenceType" ADD VALUE 'INVOICE_ITEM';
ALTER TYPE "MovementReferenceType" ADD VALUE 'CONSUMABLE_USAGE_EVENT';

-- 1) Add new FK column nullable (keep old columns until backfill)
ALTER TABLE "ConsumableBatch" ADD COLUMN "storeLocationId" TEXT;

ALTER TABLE "ConsumableMovement" ADD COLUMN "storeLocationId" TEXT;

-- 2) One StoreLocation per PharmacyLocation that was used for consumables (idempotent by code)
INSERT INTO "StoreLocation" ("id", "name", "code", "description", "isPrimary", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid(), pl."name", 'MIG-PH-' || pl."id", COALESCE(pl."description", 'Migrated from pharmacy location'), false, true, NOW(), NOW()
FROM "PharmacyLocation" pl
WHERE EXISTS (
    SELECT 1 FROM "ConsumableBatch" cb WHERE cb."locationId" = pl."id"
    UNION
    SELECT 1 FROM "ConsumableMovement" cm WHERE cm."locationId" = pl."id"
  )
  AND NOT EXISTS (SELECT 1 FROM "StoreLocation" sl WHERE sl."code" = 'MIG-PH-' || pl."id");

-- 3) Backfill batch rows
UPDATE "ConsumableBatch" cb
SET "storeLocationId" = sl."id"
FROM "StoreLocation" sl
JOIN "PharmacyLocation" pl ON sl."code" = 'MIG-PH-' || pl."id"
WHERE cb."locationId" = pl."id"
  AND cb."storeLocationId" IS NULL;

-- 4) Backfill movement rows
UPDATE "ConsumableMovement" cm
SET "storeLocationId" = sl."id"
FROM "StoreLocation" sl
JOIN "PharmacyLocation" pl ON sl."code" = 'MIG-PH-' || pl."id"
WHERE cm."locationId" = pl."id"
  AND cm."storeLocationId" IS NULL;

-- 5) Fallback: any row still null gets primary/active store location, else first store location
UPDATE "ConsumableBatch"
SET "storeLocationId" = (
    SELECT sl."id" FROM "StoreLocation" sl WHERE sl."isPrimary" = true AND sl."isActive" = true LIMIT 1
  )
WHERE "storeLocationId" IS NULL
  AND EXISTS (SELECT 1 FROM "StoreLocation" sl WHERE sl."isPrimary" = true AND sl."isActive" = true);

UPDATE "ConsumableBatch"
SET "storeLocationId" = (SELECT sl."id" FROM "StoreLocation" sl ORDER BY sl."createdAt" ASC LIMIT 1)
WHERE "storeLocationId" IS NULL
  AND EXISTS (SELECT 1 FROM "StoreLocation" sl LIMIT 1);

UPDATE "ConsumableMovement"
SET "storeLocationId" = (
    SELECT sl."id" FROM "StoreLocation" sl WHERE sl."isPrimary" = true AND sl."isActive" = true LIMIT 1
  )
WHERE "storeLocationId" IS NULL
  AND EXISTS (SELECT 1 FROM "StoreLocation" sl WHERE sl."isPrimary" = true AND sl."isActive" = true);

UPDATE "ConsumableMovement"
SET "storeLocationId" = (SELECT sl."id" FROM "StoreLocation" sl ORDER BY sl."createdAt" ASC LIMIT 1)
WHERE "storeLocationId" IS NULL
  AND EXISTS (SELECT 1 FROM "StoreLocation" sl LIMIT 1);

-- 6) If tables have rows but no StoreLocation exists at all, create a default row
INSERT INTO "StoreLocation" ("id", "name", "code", "description", "isPrimary", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid(), 'Default consumables store', 'DEFAULT-CONSUMABLE', 'Created by migration', true, true, NOW(), NOW()
WHERE EXISTS (SELECT 1 FROM "ConsumableBatch" LIMIT 1)
  AND NOT EXISTS (SELECT 1 FROM "StoreLocation" LIMIT 1);

UPDATE "ConsumableBatch"
SET "storeLocationId" = (SELECT sl."id" FROM "StoreLocation" sl WHERE sl."code" = 'DEFAULT-CONSUMABLE' LIMIT 1)
WHERE "storeLocationId" IS NULL;

UPDATE "ConsumableMovement"
SET "storeLocationId" = (SELECT sl."id" FROM "StoreLocation" sl WHERE sl."code" = 'DEFAULT-CONSUMABLE' LIMIT 1)
WHERE "storeLocationId" IS NULL;

-- 7) Drop old pharmacy FKs and columns; enforce NOT NULL
ALTER TABLE "ConsumableBatch" DROP CONSTRAINT "ConsumableBatch_locationId_fkey";

ALTER TABLE "ConsumableMovement" DROP CONSTRAINT "ConsumableMovement_locationId_fkey";

DROP INDEX IF EXISTS "ConsumableBatch_consumableId_locationType_idx";

ALTER TABLE "ConsumableBatch" DROP COLUMN "locationId";
ALTER TABLE "ConsumableBatch" DROP COLUMN "locationType";
ALTER TABLE "ConsumableBatch" ALTER COLUMN "storeLocationId" SET NOT NULL;

ALTER TABLE "ConsumableMovement" DROP COLUMN "locationId";
ALTER TABLE "ConsumableMovement" DROP COLUMN "locationType";
ALTER TABLE "ConsumableMovement" ALTER COLUMN "storeLocationId" SET NOT NULL;

ALTER TABLE "ConsumableBatch" ADD CONSTRAINT "ConsumableBatch_storeLocationId_fkey" FOREIGN KEY ("storeLocationId") REFERENCES "StoreLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ConsumableMovement" ADD CONSTRAINT "ConsumableMovement_storeLocationId_fkey" FOREIGN KEY ("storeLocationId") REFERENCES "StoreLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "ConsumableBatch_consumableId_storeLocationId_idx" ON "ConsumableBatch"("consumableId", "storeLocationId");

-- InvoiceItem extensions
ALTER TABLE "InvoiceItem" ADD COLUMN "consumableId" TEXT;
ALTER TABLE "InvoiceItem" ADD COLUMN "storeLocationId" TEXT;

CREATE INDEX "InvoiceItem_consumableId_idx" ON "InvoiceItem"("consumableId");
CREATE INDEX "InvoiceItem_storeLocationId_idx" ON "InvoiceItem"("storeLocationId");

ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_consumableId_fkey" FOREIGN KEY ("consumableId") REFERENCES "Consumable"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_storeLocationId_fkey" FOREIGN KEY ("storeLocationId") REFERENCES "StoreLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- New tables (usage events first — stock allocations reference them)
CREATE TABLE "ConsumableUsageEvent" (
    "id" TEXT NOT NULL,
    "consumableId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "direction" "ConsumableUsageDirection" NOT NULL,
    "source" "ConsumableUsageSource" NOT NULL,
    "patientId" TEXT NOT NULL,
    "encounterId" TEXT,
    "admissionId" TEXT,
    "storeLocationId" TEXT NOT NULL,
    "reversalOfId" TEXT,
    "performedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ConsumableUsageEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ConsumableStockAllocation" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "direction" "ConsumableAllocationDirection" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "costPriceSnapshot" DECIMAL(12,2) NOT NULL,
    "sellingPriceSnapshot" DECIMAL(12,2) NOT NULL,
    "invoiceItemId" TEXT,
    "usageEventId" TEXT,
    "performedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ConsumableStockAllocation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ConsumableStockAllocation_batchId_idx" ON "ConsumableStockAllocation"("batchId");
CREATE INDEX "ConsumableStockAllocation_invoiceItemId_idx" ON "ConsumableStockAllocation"("invoiceItemId");
CREATE INDEX "ConsumableStockAllocation_usageEventId_idx" ON "ConsumableStockAllocation"("usageEventId");
CREATE INDEX "ConsumableStockAllocation_createdAt_idx" ON "ConsumableStockAllocation"("createdAt");

CREATE INDEX "ConsumableUsageEvent_consumableId_createdAt_idx" ON "ConsumableUsageEvent"("consumableId", "createdAt");
CREATE INDEX "ConsumableUsageEvent_patientId_createdAt_idx" ON "ConsumableUsageEvent"("patientId", "createdAt");
CREATE INDEX "ConsumableUsageEvent_encounterId_idx" ON "ConsumableUsageEvent"("encounterId");
CREATE INDEX "ConsumableUsageEvent_admissionId_idx" ON "ConsumableUsageEvent"("admissionId");

ALTER TABLE "ConsumableStockAllocation" ADD CONSTRAINT "ConsumableStockAllocation_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ConsumableBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ConsumableStockAllocation" ADD CONSTRAINT "ConsumableStockAllocation_invoiceItemId_fkey" FOREIGN KEY ("invoiceItemId") REFERENCES "InvoiceItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ConsumableStockAllocation" ADD CONSTRAINT "ConsumableStockAllocation_usageEventId_fkey" FOREIGN KEY ("usageEventId") REFERENCES "ConsumableUsageEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ConsumableStockAllocation" ADD CONSTRAINT "ConsumableStockAllocation_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ConsumableUsageEvent" ADD CONSTRAINT "ConsumableUsageEvent_consumableId_fkey" FOREIGN KEY ("consumableId") REFERENCES "Consumable"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ConsumableUsageEvent" ADD CONSTRAINT "ConsumableUsageEvent_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ConsumableUsageEvent" ADD CONSTRAINT "ConsumableUsageEvent_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "Encounter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ConsumableUsageEvent" ADD CONSTRAINT "ConsumableUsageEvent_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "Admission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ConsumableUsageEvent" ADD CONSTRAINT "ConsumableUsageEvent_storeLocationId_fkey" FOREIGN KEY ("storeLocationId") REFERENCES "StoreLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ConsumableUsageEvent" ADD CONSTRAINT "ConsumableUsageEvent_reversalOfId_fkey" FOREIGN KEY ("reversalOfId") REFERENCES "ConsumableUsageEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ConsumableUsageEvent" ADD CONSTRAINT "ConsumableUsageEvent_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
