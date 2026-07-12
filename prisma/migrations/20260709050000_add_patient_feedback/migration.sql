-- CreateEnum
CREATE TYPE "PatientFeedbackKind" AS ENUM ('COMPLAINT', 'SUGGESTION', 'GENERAL');

-- CreateEnum
CREATE TYPE "PatientFeedbackStatus" AS ENUM ('OPEN', 'IN_REVIEW', 'RESOLVED', 'CLOSED');

-- CreateTable
CREATE TABLE "PatientFeedback" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "kind" "PatientFeedbackKind" NOT NULL,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "PatientFeedbackStatus" NOT NULL DEFAULT 'OPEN',
    "departmentId" TEXT,
    "staffResponse" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "respondedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PatientFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PatientFeedback_patientId_idx" ON "PatientFeedback"("patientId");

-- CreateIndex
CREATE INDEX "PatientFeedback_status_createdAt_idx" ON "PatientFeedback"("status", "createdAt");

-- CreateIndex
CREATE INDEX "PatientFeedback_kind_createdAt_idx" ON "PatientFeedback"("kind", "createdAt");

-- CreateIndex
CREATE INDEX "PatientFeedback_departmentId_idx" ON "PatientFeedback"("departmentId");

-- AddForeignKey
ALTER TABLE "PatientFeedback" ADD CONSTRAINT "PatientFeedback_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientFeedback" ADD CONSTRAINT "PatientFeedback_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientFeedback" ADD CONSTRAINT "PatientFeedback_respondedById_fkey" FOREIGN KEY ("respondedById") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
