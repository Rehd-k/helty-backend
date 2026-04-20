-- AlterTable
ALTER TABLE "Patient" ADD COLUMN     "hmoId" TEXT;

-- CreateTable
CREATE TABLE "Hmo" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "Hmo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HmoServicePrice" (
    "id" TEXT NOT NULL,
    "hmoId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "fullCost" DECIMAL(12,2) NOT NULL,
    "hmoPays" DECIMAL(12,2) NOT NULL,
    "patientPays" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HmoServicePrice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Hmo_name_key" ON "Hmo"("name");

-- CreateIndex
CREATE INDEX "HmoServicePrice_hmoId_idx" ON "HmoServicePrice"("hmoId");

-- CreateIndex
CREATE INDEX "HmoServicePrice_serviceId_idx" ON "HmoServicePrice"("serviceId");

-- CreateIndex
CREATE UNIQUE INDEX "HmoServicePrice_hmoId_serviceId_key" ON "HmoServicePrice"("hmoId", "serviceId");

-- CreateIndex
CREATE INDEX "Patient_hmoId_idx" ON "Patient"("hmoId");

-- AddForeignKey
ALTER TABLE "Patient" ADD CONSTRAINT "Patient_hmoId_fkey" FOREIGN KEY ("hmoId") REFERENCES "Hmo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Hmo" ADD CONSTRAINT "Hmo_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Hmo" ADD CONSTRAINT "Hmo_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HmoServicePrice" ADD CONSTRAINT "HmoServicePrice_hmoId_fkey" FOREIGN KEY ("hmoId") REFERENCES "Hmo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HmoServicePrice" ADD CONSTRAINT "HmoServicePrice_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;
