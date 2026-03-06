/*
  Warnings:

  - The values [STORE,DISPENSARY] on the enum `AccountType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "AccountType_new" AS ENUM ('PHARMACY_STORE', 'PHARMACY_DISPENSARY', 'PHARMACY_HEAD', 'INPATIENT_NURSE', 'OUTPATIENT_NURSE', 'INPATIENT_DOCTOR', 'MEDICAL_RECORDS', 'OTHER', 'FRONTDESK', 'CONSULTANT', 'NURSE', 'LAB', 'RADIOLOGY', 'ACCOUNTS', 'BILLS', 'PHARMACY', 'THEATERE', 'ONG', 'DIALYSIS');
ALTER TABLE "Staff" ALTER COLUMN "accountType" TYPE "AccountType_new" USING ("accountType"::text::"AccountType_new");
ALTER TYPE "AccountType" RENAME TO "AccountType_old";
ALTER TYPE "AccountType_new" RENAME TO "AccountType";
DROP TYPE "public"."AccountType_old";
COMMIT;
