-- CreateEnum
CREATE TYPE "NursingUnit" AS ENUM ('INPATIENT_WARD', 'ICU', 'EMERGENCY', 'OPD', 'ONG');

-- AlterEnum: add new nursing staff roles
ALTER TYPE "StaffRole" ADD VALUE 'MATRON';
ALTER TYPE "StaffRole" ADD VALUE 'WARD_CHARGE_NURSE';
ALTER TYPE "StaffRole" ADD VALUE 'ICU_CHARGE_NURSE';
ALTER TYPE "StaffRole" ADD VALUE 'EMERGENCY_CHARGE_NURSE';
ALTER TYPE "StaffRole" ADD VALUE 'OPD_CHARGE_NURSE';
ALTER TYPE "StaffRole" ADD VALUE 'ONG_CHARGE_NURSE';

-- Migrate HEAD_NURSE to MATRON
UPDATE "Staff" SET "staffRole" = 'MATRON' WHERE "staffRole" = 'HEAD_NURSE';

-- Recreate StaffRole enum without HEAD_NURSE
CREATE TYPE "StaffRole_new" AS ENUM (
  'BILLING_HEAD',
  'BILLING_STAFF',
  'ACCOUNT_HEAD',
  'ACCOUNTING_STAFF',
  'PHARMACY_STORE',
  'PHARMACY_DISPENSARY',
  'PHARMACY_HEAD',
  'MATRON',
  'WARD_CHARGE_NURSE',
  'ICU_CHARGE_NURSE',
  'EMERGENCY_CHARGE_NURSE',
  'OPD_CHARGE_NURSE',
  'ONG_CHARGE_NURSE',
  'INPATIENT_NURSE',
  'OUTPATIENT_NURSE',
  'CONSULTANT',
  'RESIDENT',
  'INTERN',
  'JUNIOR_RESIDENT',
  'SENIOR_RESIDENT',
  'CHIEF_RESIDENT',
  'MEDICAL_STUDENT',
  'LAB_HEAD',
  'LAB_SCIENTIST',
  'RADIOLOGY_HEAD',
  'RADIOGRAPHER',
  'RADIOLOGY_RECEPTIONIST',
  'HEAD_OF_STORE',
  'STOREKEEPER',
  'MEDICAL_RECORDS',
  'FRONT_DESK',
  'ICT_STAFF',
  'CMD',
  'CMAC',
  'HMO_STAFF',
  'PURCHASES_STORE',
  'PURCHASES_STAFF',
  'PURCHASES_HEAD',
  'DIALYSIS_HEAD',
  'DIALYSIS_NURSE',
  'DIALYSIS_TECH',
  'DIALYSIS_RECEPTIONIST',
  'SUPER_ADMIN'
);

ALTER TABLE "Staff" ALTER COLUMN "staffRole" TYPE "StaffRole_new" USING ("staffRole"::text::"StaffRole_new");
DROP TYPE "StaffRole";
ALTER TYPE "StaffRole_new" RENAME TO "StaffRole";

-- AlterTable: extend NurseAssignment
ALTER TABLE "NurseAssignment" ADD COLUMN "nursingUnit" "NursingUnit",
ADD COLUMN "assignedById" TEXT;

CREATE INDEX "NurseAssignment_nursingUnit_shiftDate_idx" ON "NurseAssignment"("nursingUnit", "shiftDate");

ALTER TABLE "NurseAssignment" ADD CONSTRAINT "NurseAssignment_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable: NurseShiftRoster
CREATE TABLE "NurseShiftRoster" (
    "id" TEXT NOT NULL,
    "nurseId" TEXT NOT NULL,
    "nursingUnit" "NursingUnit" NOT NULL,
    "wardId" TEXT,
    "departmentId" TEXT,
    "shiftDate" TIMESTAMP(3) NOT NULL,
    "shiftType" "ShiftType" NOT NULL,
    "assignedById" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NurseShiftRoster_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NurseShiftRoster_nurseId_nursingUnit_shiftDate_shiftType_wardId_key" ON "NurseShiftRoster"("nurseId", "nursingUnit", "shiftDate", "shiftType", "wardId");
CREATE INDEX "NurseShiftRoster_nursingUnit_shiftDate_idx" ON "NurseShiftRoster"("nursingUnit", "shiftDate");
CREATE INDEX "NurseShiftRoster_wardId_shiftDate_idx" ON "NurseShiftRoster"("wardId", "shiftDate");

ALTER TABLE "NurseShiftRoster" ADD CONSTRAINT "NurseShiftRoster_nurseId_fkey" FOREIGN KEY ("nurseId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "NurseShiftRoster" ADD CONSTRAINT "NurseShiftRoster_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "Ward"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "NurseShiftRoster" ADD CONSTRAINT "NurseShiftRoster_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "NurseShiftRoster" ADD CONSTRAINT "NurseShiftRoster_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable: OutpatientNurseAssignment
CREATE TABLE "OutpatientNurseAssignment" (
    "id" TEXT NOT NULL,
    "nurseId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "nursingUnit" "NursingUnit" NOT NULL,
    "assignedById" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "shiftDate" TIMESTAMP(3),
    "shiftType" "ShiftType",

    CONSTRAINT "OutpatientNurseAssignment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OutpatientNurseAssignment_invoiceId_key" ON "OutpatientNurseAssignment"("invoiceId");
CREATE INDEX "OutpatientNurseAssignment_nurseId_idx" ON "OutpatientNurseAssignment"("nurseId");
CREATE INDEX "OutpatientNurseAssignment_nursingUnit_assignedAt_idx" ON "OutpatientNurseAssignment"("nursingUnit", "assignedAt");

ALTER TABLE "OutpatientNurseAssignment" ADD CONSTRAINT "OutpatientNurseAssignment_nurseId_fkey" FOREIGN KEY ("nurseId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OutpatientNurseAssignment" ADD CONSTRAINT "OutpatientNurseAssignment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OutpatientNurseAssignment" ADD CONSTRAINT "OutpatientNurseAssignment_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
