-- AlterEnum
ALTER TYPE "AdmissionStatus" ADD VALUE 'PENDING_BILLING_CLEARANCE';

-- AlterTable
ALTER TABLE "Admission" ADD COLUMN "clinicallyDischargedById" TEXT,
ADD COLUMN "billingClearedAt" TIMESTAMP(3),
ADD COLUMN "billingClearedById" TEXT;

-- AddForeignKey
ALTER TABLE "Admission" ADD CONSTRAINT "Admission_clinicallyDischargedById_fkey" FOREIGN KEY ("clinicallyDischargedById") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Admission" ADD CONSTRAINT "Admission_billingClearedById_fkey" FOREIGN KEY ("billingClearedById") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
