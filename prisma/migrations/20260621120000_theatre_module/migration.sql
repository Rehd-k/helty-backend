-- AlterEnum
ALTER TYPE "AccountType" ADD VALUE 'THEATRE';

-- AlterEnum
ALTER TYPE "StaffRole" ADD VALUE 'THEATRE_HEAD';
ALTER TYPE "StaffRole" ADD VALUE 'THEATRE_NURSE';
ALTER TYPE "StaffRole" ADD VALUE 'THEATRE_SCRUB';
ALTER TYPE "StaffRole" ADD VALUE 'THEATRE_ANAESTHETIST';
ALTER TYPE "StaffRole" ADD VALUE 'THEATRE_RECEPTIONIST';

-- AlterEnum
ALTER TYPE "ConsumableUsageSource" ADD VALUE 'THEATRE';

-- CreateEnum
CREATE TYPE "SurgeryRequestStatus" AS ENUM ('REQUESTED', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'BILLED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SurgeryPriority" AS ENUM ('ROUTINE', 'URGENT', 'EMERGENCY');

-- CreateEnum
CREATE TYPE "TheatreCaseStaffRole" AS ENUM ('SURGEON', 'ASSISTANT', 'SCRUB', 'CIRCULATING', 'ANAESTHETIST');

-- CreateTable
CREATE TABLE "TheatreRoom" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TheatreRoom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SurgeryRequest" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "encounterId" TEXT NOT NULL,
    "admissionId" TEXT,
    "requestedById" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "priority" "SurgeryPriority" NOT NULL DEFAULT 'ROUTINE',
    "clinicalNotes" TEXT,
    "preferredDate" TIMESTAMP(3),
    "status" "SurgeryRequestStatus" NOT NULL DEFAULT 'REQUESTED',
    "invoiceId" TEXT,
    "invoiceItemId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SurgeryRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TheatreSchedule" (
    "id" TEXT NOT NULL,
    "surgeryRequestId" TEXT NOT NULL,
    "theatreRoomId" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "estimatedDurationMins" INTEGER,
    "surgeonId" TEXT NOT NULL,
    "anaesthetistId" TEXT,
    "scrubNurseId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TheatreSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TheatreCase" (
    "id" TEXT NOT NULL,
    "surgeryRequestId" TEXT NOT NULL,
    "performedById" TEXT,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "findings" TEXT,
    "complications" TEXT,
    "operativeNotes" TEXT,
    "transferNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TheatreCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TheatreCaseConsumable" (
    "id" TEXT NOT NULL,
    "theatreCaseId" TEXT NOT NULL,
    "consumableId" TEXT NOT NULL,
    "storeLocationId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "billable" BOOLEAN NOT NULL DEFAULT true,
    "invoiceId" TEXT,
    "invoiceItemId" TEXT,
    "usageEventId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "TheatreCaseConsumable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TheatreCaseStaff" (
    "id" TEXT NOT NULL,
    "theatreCaseId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "role" "TheatreCaseStaffRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TheatreCaseStaff_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TheatreRoom_isActive_idx" ON "TheatreRoom"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "SurgeryRequest_invoiceItemId_key" ON "SurgeryRequest"("invoiceItemId");

-- CreateIndex
CREATE INDEX "SurgeryRequest_encounterId_idx" ON "SurgeryRequest"("encounterId");

-- CreateIndex
CREATE INDEX "SurgeryRequest_patientId_idx" ON "SurgeryRequest"("patientId");

-- CreateIndex
CREATE INDEX "SurgeryRequest_admissionId_idx" ON "SurgeryRequest"("admissionId");

-- CreateIndex
CREATE INDEX "SurgeryRequest_status_idx" ON "SurgeryRequest"("status");

-- CreateIndex
CREATE INDEX "SurgeryRequest_createdAt_idx" ON "SurgeryRequest"("createdAt");

-- CreateIndex
CREATE INDEX "SurgeryRequest_invoiceItemId_idx" ON "SurgeryRequest"("invoiceItemId");

-- CreateIndex
CREATE UNIQUE INDEX "TheatreSchedule_surgeryRequestId_key" ON "TheatreSchedule"("surgeryRequestId");

-- CreateIndex
CREATE INDEX "TheatreSchedule_scheduledAt_idx" ON "TheatreSchedule"("scheduledAt");

-- CreateIndex
CREATE INDEX "TheatreSchedule_theatreRoomId_idx" ON "TheatreSchedule"("theatreRoomId");

-- CreateIndex
CREATE INDEX "TheatreSchedule_surgeonId_idx" ON "TheatreSchedule"("surgeonId");

-- CreateIndex
CREATE UNIQUE INDEX "TheatreCase_surgeryRequestId_key" ON "TheatreCase"("surgeryRequestId");

-- CreateIndex
CREATE INDEX "TheatreCase_startedAt_idx" ON "TheatreCase"("startedAt");

-- CreateIndex
CREATE INDEX "TheatreCaseConsumable_theatreCaseId_idx" ON "TheatreCaseConsumable"("theatreCaseId");

-- CreateIndex
CREATE INDEX "TheatreCaseConsumable_consumableId_idx" ON "TheatreCaseConsumable"("consumableId");

-- CreateIndex
CREATE INDEX "TheatreCaseConsumable_storeLocationId_idx" ON "TheatreCaseConsumable"("storeLocationId");

-- CreateIndex
CREATE UNIQUE INDEX "TheatreCaseStaff_theatreCaseId_staffId_role_key" ON "TheatreCaseStaff"("theatreCaseId", "staffId", "role");

-- CreateIndex
CREATE INDEX "TheatreCaseStaff_theatreCaseId_idx" ON "TheatreCaseStaff"("theatreCaseId");

-- CreateIndex
CREATE INDEX "TheatreCaseStaff_staffId_idx" ON "TheatreCaseStaff"("staffId");

-- AddForeignKey
ALTER TABLE "SurgeryRequest" ADD CONSTRAINT "SurgeryRequest_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurgeryRequest" ADD CONSTRAINT "SurgeryRequest_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "Encounter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurgeryRequest" ADD CONSTRAINT "SurgeryRequest_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "Admission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurgeryRequest" ADD CONSTRAINT "SurgeryRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurgeryRequest" ADD CONSTRAINT "SurgeryRequest_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurgeryRequest" ADD CONSTRAINT "SurgeryRequest_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurgeryRequest" ADD CONSTRAINT "SurgeryRequest_invoiceItemId_fkey" FOREIGN KEY ("invoiceItemId") REFERENCES "InvoiceItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TheatreSchedule" ADD CONSTRAINT "TheatreSchedule_surgeryRequestId_fkey" FOREIGN KEY ("surgeryRequestId") REFERENCES "SurgeryRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TheatreSchedule" ADD CONSTRAINT "TheatreSchedule_theatreRoomId_fkey" FOREIGN KEY ("theatreRoomId") REFERENCES "TheatreRoom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TheatreSchedule" ADD CONSTRAINT "TheatreSchedule_surgeonId_fkey" FOREIGN KEY ("surgeonId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TheatreSchedule" ADD CONSTRAINT "TheatreSchedule_anaesthetistId_fkey" FOREIGN KEY ("anaesthetistId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TheatreSchedule" ADD CONSTRAINT "TheatreSchedule_scrubNurseId_fkey" FOREIGN KEY ("scrubNurseId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TheatreCase" ADD CONSTRAINT "TheatreCase_surgeryRequestId_fkey" FOREIGN KEY ("surgeryRequestId") REFERENCES "SurgeryRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TheatreCase" ADD CONSTRAINT "TheatreCase_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TheatreCaseConsumable" ADD CONSTRAINT "TheatreCaseConsumable_theatreCaseId_fkey" FOREIGN KEY ("theatreCaseId") REFERENCES "TheatreCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TheatreCaseConsumable" ADD CONSTRAINT "TheatreCaseConsumable_consumableId_fkey" FOREIGN KEY ("consumableId") REFERENCES "Consumable"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TheatreCaseConsumable" ADD CONSTRAINT "TheatreCaseConsumable_storeLocationId_fkey" FOREIGN KEY ("storeLocationId") REFERENCES "StoreLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TheatreCaseConsumable" ADD CONSTRAINT "TheatreCaseConsumable_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TheatreCaseConsumable" ADD CONSTRAINT "TheatreCaseConsumable_invoiceItemId_fkey" FOREIGN KEY ("invoiceItemId") REFERENCES "InvoiceItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TheatreCaseConsumable" ADD CONSTRAINT "TheatreCaseConsumable_usageEventId_fkey" FOREIGN KEY ("usageEventId") REFERENCES "ConsumableUsageEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TheatreCaseConsumable" ADD CONSTRAINT "TheatreCaseConsumable_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TheatreCaseStaff" ADD CONSTRAINT "TheatreCaseStaff_theatreCaseId_fkey" FOREIGN KEY ("theatreCaseId") REFERENCES "TheatreCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TheatreCaseStaff" ADD CONSTRAINT "TheatreCaseStaff_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
