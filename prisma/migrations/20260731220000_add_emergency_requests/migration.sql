-- CreateEnum
CREATE TYPE "EmergencyRequestStatus" AS ENUM ('SUBMITTED', 'ACKNOWLEDGED', 'DISPATCHED', 'CLOSED', 'CANCELLED');

-- CreateTable
CREATE TABLE "EmergencyRequest" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "status" "EmergencyRequestStatus" NOT NULL DEFAULT 'SUBMITTED',
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "accuracyMeters" DOUBLE PRECISION,
    "addressText" TEXT,
    "description" TEXT,
    "voiceUrl" TEXT,
    "videoUrl" TEXT,
    "staffNote" TEXT,
    "respondedById" TEXT,
    "acknowledgedAt" TIMESTAMP(3),
    "dispatchedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmergencyRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmergencyRequest_patientId_idx" ON "EmergencyRequest"("patientId");

-- CreateIndex
CREATE INDEX "EmergencyRequest_status_createdAt_idx" ON "EmergencyRequest"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "EmergencyRequest" ADD CONSTRAINT "EmergencyRequest_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencyRequest" ADD CONSTRAINT "EmergencyRequest_respondedById_fkey" FOREIGN KEY ("respondedById") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
