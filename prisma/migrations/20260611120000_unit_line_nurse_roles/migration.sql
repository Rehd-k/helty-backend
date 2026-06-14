-- AlterEnum: unit-specific line nurse roles
ALTER TYPE "StaffRole" ADD VALUE 'EMERGENCY_NURSE';
ALTER TYPE "StaffRole" ADD VALUE 'ICU_NURSE';
ALTER TYPE "StaffRole" ADD VALUE 'ONG_NURSE';
