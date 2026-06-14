-- CreateTable
CREATE TABLE "EncounterTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "encounterType" "EncounterType",
    "chiefComplaint" TEXT,
    "hpi" TEXT,
    "pmh" TEXT,
    "surgicalHistory" TEXT,
    "drugHistory" TEXT,
    "allergyHistory" TEXT,
    "familyHistory" TEXT,
    "socialHistory" TEXT,
    "examinationNotes" TEXT,
    "soapSubjective" TEXT,
    "soapObjective" TEXT,
    "soapAssessment" TEXT,
    "soapPlan" TEXT,
    "triageNotes" TEXT,
    "visitType" TEXT,
    "primaryIcdCode" TEXT,
    "primaryIcdDescription" TEXT,
    "secondaryDiagnosesJson" TEXT,
    "proceduresJson" TEXT,
    "specialtyModulesJson" TEXT,
    "clinicalSectionsJson" TEXT,
    "followUpDate" TEXT,
    "followUpInstructions" TEXT,
    "referral" TEXT,
    "doctorId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EncounterTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EncounterTemplate_doctorId_idx" ON "EncounterTemplate"("doctorId");

-- CreateIndex
CREATE UNIQUE INDEX "EncounterTemplate_doctorId_name_key" ON "EncounterTemplate"("doctorId", "name");

-- AddForeignKey
ALTER TABLE "EncounterTemplate" ADD CONSTRAINT "EncounterTemplate_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EncounterTemplate" ADD CONSTRAINT "EncounterTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EncounterTemplate" ADD CONSTRAINT "EncounterTemplate_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
