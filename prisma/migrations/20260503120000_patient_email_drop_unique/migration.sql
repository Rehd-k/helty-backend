-- Drop unique on Patient.email so multiple patients may share an email or omit it.
-- Safe for existing rows: no data rewrite required.
DROP INDEX IF EXISTS "Patient_email_key";
