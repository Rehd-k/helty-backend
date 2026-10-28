-- Patient portal password and one-time login codes.

ALTER TABLE "Patient" ADD COLUMN "password" TEXT;
ALTER TABLE "Patient" ADD COLUMN "portalActivatedAt" TIMESTAMP(3);

ALTER TABLE "PatientDevice" ADD COLUMN "refreshTokenHash" TEXT;
ALTER TABLE "PatientDevice" ADD COLUMN "refreshTokenExpiresAt" TIMESTAMP(3);

CREATE TYPE "PatientPortalOtpPurpose" AS ENUM ('ACTIVATION', 'PASSWORD_RESET');

CREATE TABLE "PatientPortalOtp" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "purpose" "PatientPortalOtpPurpose" NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "setupTokenHash" TEXT,
    "setupTokenExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PatientPortalOtp_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PatientPortalOtp_setupTokenHash_key" ON "PatientPortalOtp"("setupTokenHash");
CREATE INDEX "PatientPortalOtp_patientId_purpose_idx" ON "PatientPortalOtp"("patientId", "purpose");
CREATE INDEX "PatientPortalOtp_expiresAt_idx" ON "PatientPortalOtp"("expiresAt");

ALTER TABLE "PatientPortalOtp"
ADD CONSTRAINT "PatientPortalOtp_patientId_fkey"
FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
