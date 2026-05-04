-- Store reset code in plaintext for admin lookup until SMTP is configured (replaces bcrypt hash column).
DELETE FROM "StaffPasswordReset";

ALTER TABLE "StaffPasswordReset" DROP COLUMN "codeHash";
ALTER TABLE "StaffPasswordReset" ADD COLUMN "code" TEXT NOT NULL;
