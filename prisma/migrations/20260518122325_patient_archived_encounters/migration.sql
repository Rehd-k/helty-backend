-- CreateTable
CREATE TABLE "PatientArchivedEncounter" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "encounterOccurredAt" TIMESTAMP(3) NOT NULL,
    "title" TEXT,
    "notes" TEXT,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PatientArchivedEncounter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatientArchivedEncounterDocument" (
    "id" TEXT NOT NULL,
    "archivedEncounterId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "mimeType" TEXT,
    "fileSize" INTEGER,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PatientArchivedEncounterDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PatientArchivedEncounter_patientId_encounterOccurredAt_idx" ON "PatientArchivedEncounter"("patientId", "encounterOccurredAt");

-- CreateIndex
CREATE INDEX "PatientArchivedEncounterDocument_archivedEncounterId_idx" ON "PatientArchivedEncounterDocument"("archivedEncounterId");

-- AddForeignKey
ALTER TABLE "PatientArchivedEncounter" ADD CONSTRAINT "PatientArchivedEncounter_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientArchivedEncounter" ADD CONSTRAINT "PatientArchivedEncounter_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientArchivedEncounterDocument" ADD CONSTRAINT "PatientArchivedEncounterDocument_archivedEncounterId_fkey" FOREIGN KEY ("archivedEncounterId") REFERENCES "PatientArchivedEncounter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
