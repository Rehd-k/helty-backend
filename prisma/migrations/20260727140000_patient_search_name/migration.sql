-- AlterTable
ALTER TABLE "Patient" ADD COLUMN "searchName" TEXT;

-- Backfill existing patients
UPDATE "Patient"
SET "searchName" = lower(trim(concat_ws(' ', "firstName", "otherName", "surname")))
WHERE "searchName" IS NULL;

-- CreateIndex
CREATE INDEX "Patient_searchName_idx" ON "Patient"("searchName");
