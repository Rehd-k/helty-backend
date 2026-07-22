-- AlterTable
ALTER TABLE "Pregnancy" ADD COLUMN "encounterId" TEXT;

-- AlterTable
ALTER TABLE "LabRequest" ADD COLUMN "pregnancyId" TEXT;

-- AlterTable
ALTER TABLE "MedicationOrder" ADD COLUMN "pregnancyId" TEXT;

-- AlterTable
ALTER TABLE "RadiologyOrder" ADD COLUMN "pregnancyId" TEXT;

-- AlterTable
ALTER TABLE "InvoiceItem" ADD COLUMN "clinicalPackageItemId" TEXT;

-- CreateTable
CREATE TABLE "ClinicalServicePackage" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefaultAntenatal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "ClinicalServicePackage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClinicalServicePackageItem" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "serviceId" TEXT,
    "drugId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClinicalServicePackageItem_pkey" PRIMARY KEY ("id")
);

-- Backfill ANC encounters for ongoing pregnancies without encounterId
DO $$
DECLARE
  rec RECORD;
  new_encounter_id TEXT;
BEGIN
  FOR rec IN
    SELECT p.id AS pregnancy_id, p."patientId", p."createdById"
    FROM "Pregnancy" p
    WHERE p."encounterId" IS NULL
  LOOP
    new_encounter_id := gen_random_uuid()::text;
    INSERT INTO "Encounter" (
      id, "patientId", "doctorId", "encounterType", "startTime", status,
      "visitType", "createdById", "createdAt", "updatedAt"
    ) VALUES (
      new_encounter_id,
      rec."patientId",
      rec."createdById",
      'OUTPATIENT'::"EncounterType",
      NOW(),
      (CASE WHEN (SELECT status FROM "Pregnancy" WHERE id = rec.pregnancy_id) = 'ONGOING' THEN 'ONGOING' ELSE 'COMPLETED' END)::"EncounterStatus",
      'Antenatal',
      rec."createdById",
      NOW(),
      NOW()
    );
    UPDATE "Pregnancy" SET "encounterId" = new_encounter_id WHERE id = rec.pregnancy_id;
    IF (SELECT status FROM "Pregnancy" WHERE id = rec.pregnancy_id) <> 'ONGOING' THEN
      UPDATE "Encounter" SET status = 'COMPLETED'::"EncounterStatus", "endTime" = NOW() WHERE id = new_encounter_id;
    END IF;
  END LOOP;
END $$;

-- CreateIndex
CREATE UNIQUE INDEX "Pregnancy_encounterId_key" ON "Pregnancy"("encounterId");

-- CreateIndex
CREATE INDEX "Pregnancy_encounterId_idx" ON "Pregnancy"("encounterId");

-- CreateIndex
CREATE INDEX "LabRequest_pregnancyId_idx" ON "LabRequest"("pregnancyId");

-- CreateIndex
CREATE INDEX "MedicationOrder_pregnancyId_idx" ON "MedicationOrder"("pregnancyId");

-- CreateIndex
CREATE INDEX "RadiologyOrder_pregnancyId_idx" ON "RadiologyOrder"("pregnancyId");

-- CreateIndex
CREATE INDEX "InvoiceItem_clinicalPackageItemId_idx" ON "InvoiceItem"("clinicalPackageItemId");

-- CreateIndex
CREATE INDEX "ClinicalServicePackage_isActive_idx" ON "ClinicalServicePackage"("isActive");

-- CreateIndex
CREATE INDEX "ClinicalServicePackage_isDefaultAntenatal_idx" ON "ClinicalServicePackage"("isDefaultAntenatal");

-- CreateIndex
CREATE INDEX "ClinicalServicePackageItem_packageId_idx" ON "ClinicalServicePackageItem"("packageId");

-- CreateIndex
CREATE INDEX "ClinicalServicePackageItem_serviceId_idx" ON "ClinicalServicePackageItem"("serviceId");

-- CreateIndex
CREATE INDEX "ClinicalServicePackageItem_drugId_idx" ON "ClinicalServicePackageItem"("drugId");

-- AddForeignKey
ALTER TABLE "Pregnancy" ADD CONSTRAINT "Pregnancy_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "Encounter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabRequest" ADD CONSTRAINT "LabRequest_pregnancyId_fkey" FOREIGN KEY ("pregnancyId") REFERENCES "Pregnancy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicationOrder" ADD CONSTRAINT "MedicationOrder_pregnancyId_fkey" FOREIGN KEY ("pregnancyId") REFERENCES "Pregnancy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RadiologyOrder" ADD CONSTRAINT "RadiologyOrder_pregnancyId_fkey" FOREIGN KEY ("pregnancyId") REFERENCES "Pregnancy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_clinicalPackageItemId_fkey" FOREIGN KEY ("clinicalPackageItemId") REFERENCES "ClinicalServicePackageItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalServicePackage" ADD CONSTRAINT "ClinicalServicePackage_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalServicePackage" ADD CONSTRAINT "ClinicalServicePackage_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalServicePackageItem" ADD CONSTRAINT "ClinicalServicePackageItem_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "ClinicalServicePackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalServicePackageItem" ADD CONSTRAINT "ClinicalServicePackageItem_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalServicePackageItem" ADD CONSTRAINT "ClinicalServicePackageItem_drugId_fkey" FOREIGN KEY ("drugId") REFERENCES "Drug"("id") ON DELETE SET NULL ON UPDATE CASCADE;
