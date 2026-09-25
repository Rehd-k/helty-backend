-- CreateTable
CREATE TABLE "PatientMedicationStreak" (
    "patientId" TEXT NOT NULL,
    "currentStreak" INTEGER NOT NULL DEFAULT 0,
    "longestStreak" INTEGER NOT NULL DEFAULT 0,
    "lastPerfectDate" TEXT,
    "shieldsRemaining" INTEGER NOT NULL DEFAULT 1,
    "lastShieldDate" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PatientMedicationStreak_pkey" PRIMARY KEY ("patientId")
);

-- AddForeignKey
ALTER TABLE "PatientMedicationStreak" ADD CONSTRAINT "PatientMedicationStreak_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
