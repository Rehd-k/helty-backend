-- CreateEnum
CREATE TYPE "PatientDeviceStatus" AS ENUM ('PENDING', 'APPROVED');

-- CreateTable
CREATE TABLE "PatientDevice" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "deviceKey" TEXT NOT NULL,
    "platform" TEXT,
    "deviceLabel" TEXT,
    "fcmToken" TEXT,
    "status" "PatientDeviceStatus" NOT NULL DEFAULT 'PENDING',
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PatientDevice_pkey" PRIMARY KEY ("id")
);

-- Migrate legacy FCM tokens into devices (if present)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'PatientDeviceToken'
  ) THEN
    INSERT INTO "PatientDevice" (
      "id",
      "patientId",
      "deviceKey",
      "platform",
      "fcmToken",
      "status",
      "approvedAt",
      "lastSeenAt",
      "createdAt",
      "updatedAt"
    )
    SELECT
      t."id",
      t."patientId",
      t."id",
      t."platform",
      t."token",
      'APPROVED'::"PatientDeviceStatus",
      t."createdAt",
      t."updatedAt",
      t."createdAt",
      t."updatedAt"
    FROM "PatientDeviceToken" t
    ON CONFLICT ("id") DO NOTHING;

    DROP TABLE "PatientDeviceToken";
  END IF;
END $$;

-- CreateTable
CREATE TABLE "PatientFamilyLink" (
    "id" TEXT NOT NULL,
    "parentPatientId" TEXT NOT NULL,
    "childPatientId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PatientFamilyLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PatientDevice_deviceKey_key" ON "PatientDevice"("deviceKey");

-- CreateIndex
CREATE UNIQUE INDEX "PatientDevice_fcmToken_key" ON "PatientDevice"("fcmToken");

-- CreateIndex
CREATE INDEX "PatientDevice_patientId_idx" ON "PatientDevice"("patientId");

-- CreateIndex
CREATE INDEX "PatientDevice_patientId_status_idx" ON "PatientDevice"("patientId", "status");

-- CreateIndex
CREATE INDEX "PatientDevice_status_idx" ON "PatientDevice"("status");

-- CreateIndex
CREATE INDEX "PatientFamilyLink_parentPatientId_idx" ON "PatientFamilyLink"("parentPatientId");

-- CreateIndex
CREATE INDEX "PatientFamilyLink_childPatientId_idx" ON "PatientFamilyLink"("childPatientId");

-- CreateIndex
CREATE UNIQUE INDEX "PatientFamilyLink_parentPatientId_childPatientId_key" ON "PatientFamilyLink"("parentPatientId", "childPatientId");

-- AddForeignKey
ALTER TABLE "PatientDevice" ADD CONSTRAINT "PatientDevice_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientDevice" ADD CONSTRAINT "PatientDevice_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientFamilyLink" ADD CONSTRAINT "PatientFamilyLink_parentPatientId_fkey" FOREIGN KEY ("parentPatientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientFamilyLink" ADD CONSTRAINT "PatientFamilyLink_childPatientId_fkey" FOREIGN KEY ("childPatientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientFamilyLink" ADD CONSTRAINT "PatientFamilyLink_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
