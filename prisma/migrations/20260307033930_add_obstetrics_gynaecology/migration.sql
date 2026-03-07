-- CreateEnum
CREATE TYPE "PregnancyStatus" AS ENUM ('ONGOING', 'DELIVERED', 'LOST', 'TERMINATED');

-- CreateEnum
CREATE TYPE "FetalPresentation" AS ENUM ('CEPHALIC', 'BREECH', 'TRANSVERSE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "DeliveryMode" AS ENUM ('SVD', 'ASSISTED_VAGINAL', 'CS_ELECTIVE', 'CS_EMERGENCY', 'BREECH', 'TWIN', 'OTHER');

-- CreateEnum
CREATE TYPE "DeliveryOutcome" AS ENUM ('LIVE_BIRTH', 'STILLBIRTH', 'OTHER');

-- CreateEnum
CREATE TYPE "BabySex" AS ENUM ('M', 'F', 'U');

-- CreateEnum
CREATE TYPE "PostnatalVisitType" AS ENUM ('MOTHER', 'BABY');

-- CreateTable
CREATE TABLE "Pregnancy" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "gravida" INTEGER NOT NULL,
    "para" INTEGER NOT NULL,
    "lmp" TIMESTAMP(3) NOT NULL,
    "edd" TIMESTAMP(3) NOT NULL,
    "bookingDate" TIMESTAMP(3),
    "status" "PregnancyStatus" NOT NULL DEFAULT 'ONGOING',
    "outcome" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "Pregnancy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AntenatalVisit" (
    "id" TEXT NOT NULL,
    "pregnancyId" TEXT NOT NULL,
    "visitDate" TIMESTAMP(3) NOT NULL,
    "gestationWeeks" DOUBLE PRECISION,
    "systolicBP" INTEGER,
    "diastolicBP" INTEGER,
    "weight" DOUBLE PRECISION,
    "fundalHeight" DOUBLE PRECISION,
    "fetalHeartRate" INTEGER,
    "presentation" "FetalPresentation",
    "urineProtein" TEXT,
    "notes" TEXT,
    "ultrasoundFindings" TEXT,
    "labResultsJson" JSONB,
    "staffId" TEXT NOT NULL,
    "encounterId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AntenatalVisit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LabourDelivery" (
    "id" TEXT NOT NULL,
    "pregnancyId" TEXT NOT NULL,
    "admissionId" TEXT,
    "deliveryDateTime" TIMESTAMP(3) NOT NULL,
    "mode" "DeliveryMode" NOT NULL,
    "outcome" "DeliveryOutcome" NOT NULL,
    "bloodLossMl" INTEGER,
    "placentaComplete" BOOLEAN,
    "episiotomy" BOOLEAN,
    "perinealTearGrade" TEXT,
    "notes" TEXT,
    "deliveredById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LabourDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartogramEntry" (
    "id" TEXT NOT NULL,
    "labourDeliveryId" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL,
    "cervicalDilationCm" DOUBLE PRECISION,
    "station" INTEGER,
    "contractionsPer10Min" INTEGER,
    "fetalHeartRate" INTEGER,
    "moulding" TEXT,
    "descent" TEXT,
    "oxytocin" TEXT,
    "comments" TEXT,
    "recordedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartogramEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Baby" (
    "id" TEXT NOT NULL,
    "labourDeliveryId" TEXT NOT NULL,
    "motherId" TEXT NOT NULL,
    "sex" "BabySex" NOT NULL,
    "birthWeightG" INTEGER,
    "birthLengthCm" DOUBLE PRECISION,
    "apgar1" INTEGER,
    "apgar5" INTEGER,
    "resuscitation" TEXT,
    "birthOrder" INTEGER NOT NULL DEFAULT 1,
    "registeredPatientId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "Baby_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostnatalVisit" (
    "id" TEXT NOT NULL,
    "labourDeliveryId" TEXT NOT NULL,
    "type" "PostnatalVisitType" NOT NULL,
    "visitDate" TIMESTAMP(3) NOT NULL,
    "patientId" TEXT,
    "babyId" TEXT,
    "uterusInvolution" TEXT,
    "lochia" TEXT,
    "perineum" TEXT,
    "bloodPressure" TEXT,
    "temperature" DOUBLE PRECISION,
    "breastfeeding" TEXT,
    "weight" DOUBLE PRECISION,
    "feeding" TEXT,
    "jaundice" TEXT,
    "immunisationGiven" TEXT,
    "notes" TEXT,
    "staffId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PostnatalVisit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GynaeProcedure" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "encounterId" TEXT,
    "admissionId" TEXT,
    "procedureType" TEXT NOT NULL,
    "procedureDate" TIMESTAMP(3) NOT NULL,
    "surgeonId" TEXT NOT NULL,
    "assistantId" TEXT,
    "findings" TEXT,
    "complications" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GynaeProcedure_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Pregnancy_patientId_idx" ON "Pregnancy"("patientId");

-- CreateIndex
CREATE INDEX "Pregnancy_status_idx" ON "Pregnancy"("status");

-- CreateIndex
CREATE INDEX "AntenatalVisit_pregnancyId_idx" ON "AntenatalVisit"("pregnancyId");

-- CreateIndex
CREATE INDEX "AntenatalVisit_visitDate_idx" ON "AntenatalVisit"("visitDate");

-- CreateIndex
CREATE INDEX "LabourDelivery_pregnancyId_idx" ON "LabourDelivery"("pregnancyId");

-- CreateIndex
CREATE INDEX "LabourDelivery_admissionId_idx" ON "LabourDelivery"("admissionId");

-- CreateIndex
CREATE INDEX "PartogramEntry_labourDeliveryId_idx" ON "PartogramEntry"("labourDeliveryId");

-- CreateIndex
CREATE INDEX "PartogramEntry_recordedAt_idx" ON "PartogramEntry"("recordedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Baby_registeredPatientId_key" ON "Baby"("registeredPatientId");

-- CreateIndex
CREATE INDEX "Baby_labourDeliveryId_idx" ON "Baby"("labourDeliveryId");

-- CreateIndex
CREATE INDEX "Baby_motherId_idx" ON "Baby"("motherId");

-- CreateIndex
CREATE INDEX "PostnatalVisit_labourDeliveryId_idx" ON "PostnatalVisit"("labourDeliveryId");

-- CreateIndex
CREATE INDEX "PostnatalVisit_type_idx" ON "PostnatalVisit"("type");

-- CreateIndex
CREATE INDEX "PostnatalVisit_visitDate_idx" ON "PostnatalVisit"("visitDate");

-- CreateIndex
CREATE INDEX "GynaeProcedure_patientId_idx" ON "GynaeProcedure"("patientId");

-- CreateIndex
CREATE INDEX "GynaeProcedure_procedureDate_idx" ON "GynaeProcedure"("procedureDate");

-- AddForeignKey
ALTER TABLE "Pregnancy" ADD CONSTRAINT "Pregnancy_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pregnancy" ADD CONSTRAINT "Pregnancy_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pregnancy" ADD CONSTRAINT "Pregnancy_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AntenatalVisit" ADD CONSTRAINT "AntenatalVisit_pregnancyId_fkey" FOREIGN KEY ("pregnancyId") REFERENCES "Pregnancy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AntenatalVisit" ADD CONSTRAINT "AntenatalVisit_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AntenatalVisit" ADD CONSTRAINT "AntenatalVisit_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "Encounter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabourDelivery" ADD CONSTRAINT "LabourDelivery_pregnancyId_fkey" FOREIGN KEY ("pregnancyId") REFERENCES "Pregnancy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabourDelivery" ADD CONSTRAINT "LabourDelivery_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "Admission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabourDelivery" ADD CONSTRAINT "LabourDelivery_deliveredById_fkey" FOREIGN KEY ("deliveredById") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartogramEntry" ADD CONSTRAINT "PartogramEntry_labourDeliveryId_fkey" FOREIGN KEY ("labourDeliveryId") REFERENCES "LabourDelivery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartogramEntry" ADD CONSTRAINT "PartogramEntry_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Baby" ADD CONSTRAINT "Baby_labourDeliveryId_fkey" FOREIGN KEY ("labourDeliveryId") REFERENCES "LabourDelivery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Baby" ADD CONSTRAINT "Baby_motherId_fkey" FOREIGN KEY ("motherId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Baby" ADD CONSTRAINT "Baby_registeredPatientId_fkey" FOREIGN KEY ("registeredPatientId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Baby" ADD CONSTRAINT "Baby_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Baby" ADD CONSTRAINT "Baby_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostnatalVisit" ADD CONSTRAINT "PostnatalVisit_labourDeliveryId_fkey" FOREIGN KEY ("labourDeliveryId") REFERENCES "LabourDelivery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostnatalVisit" ADD CONSTRAINT "PostnatalVisit_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostnatalVisit" ADD CONSTRAINT "PostnatalVisit_babyId_fkey" FOREIGN KEY ("babyId") REFERENCES "Baby"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostnatalVisit" ADD CONSTRAINT "PostnatalVisit_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GynaeProcedure" ADD CONSTRAINT "GynaeProcedure_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GynaeProcedure" ADD CONSTRAINT "GynaeProcedure_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "Encounter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GynaeProcedure" ADD CONSTRAINT "GynaeProcedure_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "Admission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GynaeProcedure" ADD CONSTRAINT "GynaeProcedure_surgeonId_fkey" FOREIGN KEY ("surgeonId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GynaeProcedure" ADD CONSTRAINT "GynaeProcedure_assistantId_fkey" FOREIGN KEY ("assistantId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
