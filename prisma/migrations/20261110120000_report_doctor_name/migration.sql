-- Free-text doctor name printed on lab and radiology results.
ALTER TABLE "LabOrder" ADD COLUMN "reportDoctorName" VARCHAR(200);
ALTER TABLE "RadiologyOrder" ADD COLUMN "reportDoctorName" VARCHAR(200);
