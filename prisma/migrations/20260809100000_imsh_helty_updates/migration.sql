-- CreateEnum
CREATE TYPE "AppointmentVisitType" AS ENUM ('IN_PERSON', 'TELEMEDICINE');

-- AlterTable Appointment
ALTER TABLE "Appointment" ADD COLUMN "specialty" TEXT,
ADD COLUMN "visitType" "AppointmentVisitType" NOT NULL DEFAULT 'IN_PERSON';

CREATE INDEX "Appointment_status_idx" ON "Appointment"("status");
CREATE INDEX "Appointment_specialty_idx" ON "Appointment"("specialty");
CREATE INDEX "Appointment_visitType_idx" ON "Appointment"("visitType");

-- AlterTable Admission
ALTER TABLE "Admission" ADD COLUMN "clinicallyDischargedAt" TIMESTAMP(3),
ADD COLUMN "nursesClearedAt" TIMESTAMP(3),
ADD COLUMN "nursesClearedById" TEXT;

ALTER TABLE "Admission" ADD CONSTRAINT "Admission_nursesClearedById_fkey" FOREIGN KEY ("nursesClearedById") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable AdmissionWardHistory
CREATE TABLE "AdmissionWardHistory" (
    "id" TEXT NOT NULL,
    "admissionId" TEXT NOT NULL,
    "fromWardId" TEXT,
    "toWardId" TEXT,
    "fromBedId" TEXT,
    "toBedId" TEXT,
    "reason" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdmissionWardHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AdmissionWardHistory_admissionId_idx" ON "AdmissionWardHistory"("admissionId");
CREATE INDEX "AdmissionWardHistory_toWardId_idx" ON "AdmissionWardHistory"("toWardId");
CREATE INDEX "AdmissionWardHistory_changedAt_idx" ON "AdmissionWardHistory"("changedAt");

ALTER TABLE "AdmissionWardHistory" ADD CONSTRAINT "AdmissionWardHistory_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "Admission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdmissionWardHistory" ADD CONSTRAINT "AdmissionWardHistory_fromWardId_fkey" FOREIGN KEY ("fromWardId") REFERENCES "Ward"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AdmissionWardHistory" ADD CONSTRAINT "AdmissionWardHistory_toWardId_fkey" FOREIGN KEY ("toWardId") REFERENCES "Ward"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AdmissionWardHistory" ADD CONSTRAINT "AdmissionWardHistory_fromBedId_fkey" FOREIGN KEY ("fromBedId") REFERENCES "Bed"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AdmissionWardHistory" ADD CONSTRAINT "AdmissionWardHistory_toBedId_fkey" FOREIGN KEY ("toBedId") REFERENCES "Bed"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AdmissionWardHistory" ADD CONSTRAINT "AdmissionWardHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable Prescription
ALTER TABLE "Prescription" ADD COLUMN "admissionId" TEXT,
ADD COLUMN "wardId" TEXT;

CREATE INDEX "Prescription_admissionId_idx" ON "Prescription"("admissionId");
CREATE INDEX "Prescription_wardId_idx" ON "Prescription"("wardId");

ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "Admission"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "Ward"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable LabRequest
ALTER TABLE "LabRequest" ADD COLUMN "admissionId" TEXT,
ADD COLUMN "wardId" TEXT;

CREATE INDEX "LabRequest_admissionId_idx" ON "LabRequest"("admissionId");
CREATE INDEX "LabRequest_wardId_idx" ON "LabRequest"("wardId");

ALTER TABLE "LabRequest" ADD CONSTRAINT "LabRequest_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "Admission"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LabRequest" ADD CONSTRAINT "LabRequest_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "Ward"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable RadiologyOrder
ALTER TABLE "RadiologyOrder" ADD COLUMN "admissionId" TEXT,
ADD COLUMN "wardId" TEXT;

CREATE INDEX "RadiologyOrder_admissionId_idx" ON "RadiologyOrder"("admissionId");
CREATE INDEX "RadiologyOrder_wardId_idx" ON "RadiologyOrder"("wardId");

ALTER TABLE "RadiologyOrder" ADD CONSTRAINT "RadiologyOrder_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "Admission"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RadiologyOrder" ADD CONSTRAINT "RadiologyOrder_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "Ward"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable MedicationRequest
ALTER TABLE "MedicationRequest" ADD COLUMN "admissionId" TEXT,
ADD COLUMN "wardId" TEXT;

CREATE INDEX "MedicationRequest_admissionId_idx" ON "MedicationRequest"("admissionId");
CREATE INDEX "MedicationRequest_wardId_idx" ON "MedicationRequest"("wardId");

ALTER TABLE "MedicationRequest" ADD CONSTRAINT "MedicationRequest_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "Admission"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MedicationRequest" ADD CONSTRAINT "MedicationRequest_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "Ward"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Health content
CREATE TABLE "HealthCampaign" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "imageUrl" TEXT,
    "publishedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "HealthCampaign_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "HealthCampaign_isPublished_publishedAt_idx" ON "HealthCampaign"("isPublished", "publishedAt");
CREATE INDEX "HealthCampaign_expiresAt_idx" ON "HealthCampaign"("expiresAt");

ALTER TABLE "HealthCampaign" ADD CONSTRAINT "HealthCampaign_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HealthCampaign" ADD CONSTRAINT "HealthCampaign_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "HealthNewsArticle" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "imageUrl" TEXT,
    "publishedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "HealthNewsArticle_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "HealthNewsArticle_isPublished_publishedAt_idx" ON "HealthNewsArticle"("isPublished", "publishedAt");
CREATE INDEX "HealthNewsArticle_expiresAt_idx" ON "HealthNewsArticle"("expiresAt");

ALTER TABLE "HealthNewsArticle" ADD CONSTRAINT "HealthNewsArticle_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HealthNewsArticle" ADD CONSTRAINT "HealthNewsArticle_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
