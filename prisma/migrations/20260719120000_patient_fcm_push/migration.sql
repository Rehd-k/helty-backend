-- AlterEnum
ALTER TYPE "AppointmentNotificationChannel" ADD VALUE 'PUSH';

-- AlterEnum
ALTER TYPE "AppointmentNotificationKind" ADD VALUE 'REMINDER_DAY_BEFORE';

-- CreateEnum
CREATE TYPE "CustomPushTargetType" AS ENUM ('ALL', 'SELECTED');

-- CreateTable
CREATE TABLE "PatientDeviceToken" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PatientDeviceToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomPushNotification" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "imageUrl" TEXT,
    "targetType" "CustomPushTargetType" NOT NULL,
    "patientIds" JSONB NOT NULL,
    "sentById" TEXT NOT NULL,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomPushNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PatientDeviceToken_token_key" ON "PatientDeviceToken"("token");

-- CreateIndex
CREATE INDEX "PatientDeviceToken_patientId_idx" ON "PatientDeviceToken"("patientId");

-- CreateIndex
CREATE INDEX "CustomPushNotification_sentById_idx" ON "CustomPushNotification"("sentById");

-- CreateIndex
CREATE INDEX "CustomPushNotification_createdAt_idx" ON "CustomPushNotification"("createdAt");

-- AddForeignKey
ALTER TABLE "PatientDeviceToken" ADD CONSTRAINT "PatientDeviceToken_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomPushNotification" ADD CONSTRAINT "CustomPushNotification_sentById_fkey" FOREIGN KEY ("sentById") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
