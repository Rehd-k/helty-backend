-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN "location" TEXT,
ADD COLUMN "reason" TEXT,
ADD COLUMN "updatedAt" TIMESTAMP(3);

UPDATE "Appointment" SET "updatedAt" = "createdAt" WHERE "updatedAt" IS NULL;

ALTER TABLE "Appointment" ALTER COLUMN "updatedAt" SET NOT NULL;

-- AlterTable
ALTER TABLE "Staff" ADD COLUMN "medicalSpecialty" "MedicalSpecialty";
