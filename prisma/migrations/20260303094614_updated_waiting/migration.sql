-- AlterTable
ALTER TABLE "WaitingPatient" ADD COLUMN     "seen" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "serviceId" TEXT;

-- AddForeignKey
ALTER TABLE "WaitingPatient" ADD CONSTRAINT "WaitingPatient_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;
