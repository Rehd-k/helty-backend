-- Move nursing waiting queue linkage to Invoice:
-- - Invoice.consultingRoomId
-- - Invoice.vitalsId (one vitals per invoice)

ALTER TABLE "Invoice" ADD COLUMN "consultingRoomId" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "vitalsId" TEXT;

CREATE UNIQUE INDEX "Invoice_vitalsId_key" ON "Invoice"("vitalsId");
CREATE INDEX "Invoice_consultingRoomId_idx" ON "Invoice"("consultingRoomId");

ALTER TABLE "Invoice"
ADD CONSTRAINT "Invoice_consultingRoomId_fkey"
FOREIGN KEY ("consultingRoomId") REFERENCES "ConsultingRoom"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Invoice"
ADD CONSTRAINT "Invoice_vitalsId_fkey"
FOREIGN KEY ("vitalsId") REFERENCES "PatientVitals"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

