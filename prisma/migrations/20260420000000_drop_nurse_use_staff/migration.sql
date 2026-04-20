-- Drop the separate `Nurse` table and point every nursing-record FK
-- (nurseId / administeredByNurseId / recordedByNurseId) directly at Staff.id.
-- Existing values (which currently reference Nurse.id) are remapped to the
-- corresponding Staff.id via Nurse.staffId before the FK target changes.

-- 1. Drop existing FKs from child tables that reference "Nurse"."id"
ALTER TABLE "NurseAssignment" DROP CONSTRAINT "NurseAssignment_nurseId_fkey";
ALTER TABLE "MedicationAdministration" DROP CONSTRAINT "MedicationAdministration_administeredByNurseId_fkey";
ALTER TABLE "IVMonitoring" DROP CONSTRAINT "IVMonitoring_nurseId_fkey";
ALTER TABLE "IntakeOutputRecord" DROP CONSTRAINT "IntakeOutputRecord_nurseId_fkey";
ALTER TABLE "NursingNote" DROP CONSTRAINT "NursingNote_nurseId_fkey";
ALTER TABLE "ProcedureRecord" DROP CONSTRAINT "ProcedureRecord_nurseId_fkey";
ALTER TABLE "WoundAssessment" DROP CONSTRAINT "WoundAssessment_nurseId_fkey";
ALTER TABLE "CarePlan" DROP CONSTRAINT "CarePlan_nurseId_fkey";
ALTER TABLE "MonitoringChart" DROP CONSTRAINT "MonitoringChart_nurseId_fkey";
ALTER TABLE "HandoverReport" DROP CONSTRAINT "HandoverReport_nurseId_fkey";
ALTER TABLE "PatientVitals" DROP CONSTRAINT "PatientVitals_recordedByNurseId_fkey";

-- 2. Remap values in child tables from Nurse.id to Nurse.staffId
UPDATE "NurseAssignment" t SET "nurseId" = n."staffId" FROM "Nurse" n WHERE t."nurseId" = n."id";
UPDATE "MedicationAdministration" t SET "administeredByNurseId" = n."staffId" FROM "Nurse" n WHERE t."administeredByNurseId" = n."id";
UPDATE "IVMonitoring" t SET "nurseId" = n."staffId" FROM "Nurse" n WHERE t."nurseId" = n."id";
UPDATE "IntakeOutputRecord" t SET "nurseId" = n."staffId" FROM "Nurse" n WHERE t."nurseId" = n."id";
UPDATE "NursingNote" t SET "nurseId" = n."staffId" FROM "Nurse" n WHERE t."nurseId" = n."id";
UPDATE "ProcedureRecord" t SET "nurseId" = n."staffId" FROM "Nurse" n WHERE t."nurseId" = n."id";
UPDATE "WoundAssessment" t SET "nurseId" = n."staffId" FROM "Nurse" n WHERE t."nurseId" = n."id";
UPDATE "CarePlan" t SET "nurseId" = n."staffId" FROM "Nurse" n WHERE t."nurseId" = n."id";
UPDATE "MonitoringChart" t SET "nurseId" = n."staffId" FROM "Nurse" n WHERE t."nurseId" = n."id";
UPDATE "HandoverReport" t SET "nurseId" = n."staffId" FROM "Nurse" n WHERE t."nurseId" = n."id";
UPDATE "PatientVitals" t SET "recordedByNurseId" = n."staffId" FROM "Nurse" n WHERE t."recordedByNurseId" = n."id";

-- 3. Add new FKs pointing at "Staff"."id"
ALTER TABLE "NurseAssignment" ADD CONSTRAINT "NurseAssignment_nurseId_fkey" FOREIGN KEY ("nurseId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MedicationAdministration" ADD CONSTRAINT "MedicationAdministration_administeredByNurseId_fkey" FOREIGN KEY ("administeredByNurseId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "IVMonitoring" ADD CONSTRAINT "IVMonitoring_nurseId_fkey" FOREIGN KEY ("nurseId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "IntakeOutputRecord" ADD CONSTRAINT "IntakeOutputRecord_nurseId_fkey" FOREIGN KEY ("nurseId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "NursingNote" ADD CONSTRAINT "NursingNote_nurseId_fkey" FOREIGN KEY ("nurseId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProcedureRecord" ADD CONSTRAINT "ProcedureRecord_nurseId_fkey" FOREIGN KEY ("nurseId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WoundAssessment" ADD CONSTRAINT "WoundAssessment_nurseId_fkey" FOREIGN KEY ("nurseId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CarePlan" ADD CONSTRAINT "CarePlan_nurseId_fkey" FOREIGN KEY ("nurseId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MonitoringChart" ADD CONSTRAINT "MonitoringChart_nurseId_fkey" FOREIGN KEY ("nurseId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HandoverReport" ADD CONSTRAINT "HandoverReport_nurseId_fkey" FOREIGN KEY ("nurseId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PatientVitals" ADD CONSTRAINT "PatientVitals_recordedByNurseId_fkey" FOREIGN KEY ("recordedByNurseId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 4. Drop the "Nurse" table (its own FKs to Staff/Department drop automatically).
DROP TABLE "Nurse";
