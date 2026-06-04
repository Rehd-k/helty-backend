-- Add PURCHASES_STAFF to StaffRole (client-facing role; same access tier as PURCHASES_STORE)
ALTER TYPE "StaffRole" ADD VALUE 'PURCHASES_STAFF';
