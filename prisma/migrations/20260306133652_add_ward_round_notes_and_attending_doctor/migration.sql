-- AlterTable
ALTER TABLE "Admission" ADD COLUMN     "attendingDoctorId" TEXT;

-- CreateTable
CREATE TABLE "WardRoundNote" (
    "id" TEXT NOT NULL,
    "admissionId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "roundDate" TIMESTAMP(3) NOT NULL,
    "subjective" TEXT,
    "objective" TEXT,
    "assessment" TEXT,
    "plan" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WardRoundNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WardRoundNote_admissionId_idx" ON "WardRoundNote"("admissionId");

-- CreateIndex
CREATE INDEX "WardRoundNote_doctorId_idx" ON "WardRoundNote"("doctorId");

-- CreateIndex
CREATE INDEX "WardRoundNote_roundDate_idx" ON "WardRoundNote"("roundDate");

-- CreateIndex
CREATE INDEX "Admission_attendingDoctorId_idx" ON "Admission"("attendingDoctorId");

-- AddForeignKey
ALTER TABLE "Admission" ADD CONSTRAINT "Admission_attendingDoctorId_fkey" FOREIGN KEY ("attendingDoctorId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WardRoundNote" ADD CONSTRAINT "WardRoundNote_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "Admission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WardRoundNote" ADD CONSTRAINT "WardRoundNote_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
