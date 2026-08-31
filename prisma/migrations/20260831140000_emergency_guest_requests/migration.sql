-- Allow emergency requests without a registered patient (pre-login guest callers).
ALTER TABLE "EmergencyRequest" ALTER COLUMN "patientId" DROP NOT NULL;

ALTER TABLE "EmergencyRequest" ADD COLUMN "guestName" TEXT;
ALTER TABLE "EmergencyRequest" ADD COLUMN "guestPhone" TEXT;
