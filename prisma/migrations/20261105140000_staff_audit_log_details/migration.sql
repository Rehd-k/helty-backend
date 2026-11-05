-- Staff activity columns and lookup indexes for the hospital-wide audit log.
ALTER TABLE "AuditLog"
  ADD COLUMN "summary" TEXT,
  ADD COLUMN "route" TEXT,
  ADD COLUMN "httpMethod" TEXT,
  ADD COLUMN "ipAddress" TEXT,
  ADD COLUMN "staffRole" TEXT,
  ADD COLUMN "accountType" TEXT,
  ADD COLUMN "departmentName" TEXT;

CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
CREATE INDEX "AuditLog_performedById_createdAt_idx" ON "AuditLog"("performedById", "createdAt");
CREATE INDEX "AuditLog_entity_createdAt_idx" ON "AuditLog"("entity", "createdAt");
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");
