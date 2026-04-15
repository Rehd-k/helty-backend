-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "referral" TEXT;

-- AlterTable
ALTER TABLE "LabResult" ALTER COLUMN "value" DROP NOT NULL;
