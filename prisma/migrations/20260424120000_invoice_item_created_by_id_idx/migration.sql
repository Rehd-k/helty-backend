-- Index for FK lookups and listing/filtering lines by creator (nullable column; safe additive migration)
CREATE INDEX "InvoiceItem_createdById_idx" ON "InvoiceItem"("createdById");
