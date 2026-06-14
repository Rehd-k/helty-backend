-- AlterTable
ALTER TABLE "Pregnancy" ADD COLUMN "respiratoryRate" INTEGER,
ADD COLUMN "heartRate" INTEGER,
ADD COLUMN "systolicBP" INTEGER,
ADD COLUMN "diastolicBP" INTEGER,
ADD COLUMN "spo2" DOUBLE PRECISION,
ADD COLUMN "genotype" TEXT,
ADD COLUMN "bloodGroup" TEXT,
ADD COLUMN "pcv" DOUBLE PRECISION,
ADD COLUMN "hcv" TEXT,
ADD COLUMN "hbsAg" TEXT,
ADD COLUMN "vdrl" TEXT,
ADD COLUMN "hiv12" TEXT,
ADD COLUMN "urinalysisProtein" TEXT,
ADD COLUMN "urinalysisGlucose" TEXT,
ADD COLUMN "ttImmunization" TEXT;

-- AlterTable
ALTER TABLE "AntenatalVisit" ADD COLUMN "gestationDays" INTEGER,
ADD COLUMN "descent" TEXT,
ADD COLUMN "urineGlucose" TEXT,
ADD COLUMN "pcv" DOUBLE PRECISION;
