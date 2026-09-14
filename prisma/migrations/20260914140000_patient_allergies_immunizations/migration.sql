-- AlterTable
ALTER TABLE "PatientAllergy" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "PatientAllergy" ADD COLUMN "createdById" TEXT;
ALTER TABLE "PatientAllergy" ADD COLUMN "updatedById" TEXT;

-- CreateIndex
CREATE INDEX "PatientAllergy_patientId_idx" ON "PatientAllergy"("patientId");

-- AddForeignKey
ALTER TABLE "PatientAllergy" ADD CONSTRAINT "PatientAllergy_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PatientAllergy" ADD CONSTRAINT "PatientAllergy_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "PatientImmunization" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "vaccineName" TEXT NOT NULL,
    "detail" TEXT,
    "doseNumber" INTEGER,
    "administeredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "PatientImmunization_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PatientImmunization_patientId_idx" ON "PatientImmunization"("patientId");

-- CreateIndex
CREATE INDEX "PatientImmunization_patientId_administeredAt_idx" ON "PatientImmunization"("patientId", "administeredAt");

-- AddForeignKey
ALTER TABLE "PatientImmunization" ADD CONSTRAINT "PatientImmunization_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PatientImmunization" ADD CONSTRAINT "PatientImmunization_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PatientImmunization" ADD CONSTRAINT "PatientImmunization_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
