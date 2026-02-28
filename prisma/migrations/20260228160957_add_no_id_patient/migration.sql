-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "noIdPatientId" TEXT;

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "noIdPatientid" TEXT;

-- CreateTable
CREATE TABLE "NoIdPatient" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastname" TEXT NOT NULL,

    CONSTRAINT "NoIdPatient_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_noIdPatientId_fkey" FOREIGN KEY ("noIdPatientId") REFERENCES "NoIdPatient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_noIdPatientid_fkey" FOREIGN KEY ("noIdPatientid") REFERENCES "NoIdPatient"("id") ON DELETE SET NULL ON UPDATE CASCADE;
