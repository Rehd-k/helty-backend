-- CreateEnum
CREATE TYPE "AppointmentNotificationChannel" AS ENUM ('EMAIL', 'SMS');

-- CreateEnum
CREATE TYPE "AppointmentNotificationKind" AS ENUM ('CREATED', 'RESCHEDULED', 'CANCELLED', 'REMINDER_DAY_OF');

-- CreateEnum
CREATE TYPE "AppointmentNotificationStatus" AS ENUM ('PENDING', 'SKIPPED_CONFIG', 'SKIPPED_NO_CONTACT', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "AppointmentNotification" (
    "id" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "channel" "AppointmentNotificationChannel" NOT NULL,
    "kind" "AppointmentNotificationKind" NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "scheduledFor" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "status" "AppointmentNotificationStatus" NOT NULL DEFAULT 'PENDING',
    "provider" TEXT,
    "providerMessageId" TEXT,
    "errorMessage" TEXT,
    "payloadSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppointmentNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AppointmentNotification_idempotencyKey_key" ON "AppointmentNotification"("idempotencyKey");

-- CreateIndex
CREATE INDEX "AppointmentNotification_appointmentId_idx" ON "AppointmentNotification"("appointmentId");

-- CreateIndex
CREATE INDEX "AppointmentNotification_patientId_idx" ON "AppointmentNotification"("patientId");

-- CreateIndex
CREATE INDEX "AppointmentNotification_kind_status_idx" ON "AppointmentNotification"("kind", "status");

-- AddForeignKey
ALTER TABLE "AppointmentNotification" ADD CONSTRAINT "AppointmentNotification_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentNotification" ADD CONSTRAINT "AppointmentNotification_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
