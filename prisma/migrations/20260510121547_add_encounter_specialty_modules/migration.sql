-- CreateEnum
CREATE TYPE "MedicalSpecialty" AS ENUM ('CARDIOLOGY', 'NEUROLOGY', 'DERMATOLOGY', 'PEDIATRICS', 'OBSTETRICS_GYNECOLOGY', 'ORTHOPEDICS', 'PSYCHIATRY', 'OPHTHALMOLOGY', 'OTOLARYNGOLOGY', 'UROLOGY', 'NEPHROLOGY', 'ENDOCRINOLOGY', 'GASTROENTEROLOGY', 'PULMONOLOGY', 'HEMATOLOGY', 'ONCOLOGY', 'RADIOLOGY', 'ANESTHESIOLOGY', 'EMERGENCY_MEDICINE', 'FAMILY_MEDICINE', 'INTERNAL_MEDICINE', 'GENERAL_SURGERY', 'NEUROSURGERY', 'PLASTIC_SURGERY', 'PATHOLOGY', 'INFECTIOUS_DISEASE', 'RHEUMATOLOGY', 'CRITICAL_CARE_MEDICINE', 'PHYSICAL_MEDICINE_REHABILITATION', 'ALLERGY_IMMUNOLOGY');

-- CreateTable
CREATE TABLE "EncounterSpecialtyModule" (
    "id" TEXT NOT NULL,
    "encounterId" TEXT NOT NULL,
    "specialty" "MedicalSpecialty" NOT NULL,
    "enabledSectionKeys" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "EncounterSpecialtyModule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EncounterClinicalSection" (
    "id" TEXT NOT NULL,
    "encounterId" TEXT NOT NULL,
    "specialty" "MedicalSpecialty" NOT NULL,
    "sectionKey" TEXT NOT NULL,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "EncounterClinicalSection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EncounterSpecialtyModule_encounterId_idx" ON "EncounterSpecialtyModule"("encounterId");

-- CreateIndex
CREATE UNIQUE INDEX "EncounterSpecialtyModule_encounterId_specialty_key" ON "EncounterSpecialtyModule"("encounterId", "specialty");

-- CreateIndex
CREATE INDEX "EncounterClinicalSection_encounterId_idx" ON "EncounterClinicalSection"("encounterId");

-- CreateIndex
CREATE INDEX "EncounterClinicalSection_specialty_sectionKey_idx" ON "EncounterClinicalSection"("specialty", "sectionKey");

-- CreateIndex
CREATE UNIQUE INDEX "EncounterClinicalSection_encounterId_specialty_sectionKey_key" ON "EncounterClinicalSection"("encounterId", "specialty", "sectionKey");

-- AddForeignKey
ALTER TABLE "EncounterSpecialtyModule" ADD CONSTRAINT "EncounterSpecialtyModule_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "Encounter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EncounterSpecialtyModule" ADD CONSTRAINT "EncounterSpecialtyModule_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EncounterSpecialtyModule" ADD CONSTRAINT "EncounterSpecialtyModule_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EncounterClinicalSection" ADD CONSTRAINT "EncounterClinicalSection_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "Encounter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EncounterClinicalSection" ADD CONSTRAINT "EncounterClinicalSection_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EncounterClinicalSection" ADD CONSTRAINT "EncounterClinicalSection_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
