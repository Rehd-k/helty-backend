-- RadiologyRequest / LabOrder optional link to paid invoice line (one request or order per item)

ALTER TABLE "RadiologyRequest" ADD COLUMN "invoiceItemId" TEXT;

ALTER TABLE "LabOrder" ADD COLUMN "invoiceItemId" TEXT;

CREATE UNIQUE INDEX "RadiologyRequest_invoiceItemId_key" ON "RadiologyRequest"("invoiceItemId");

CREATE UNIQUE INDEX "LabOrder_invoiceItemId_key" ON "LabOrder"("invoiceItemId");

CREATE INDEX "RadiologyRequest_invoiceItemId_idx" ON "RadiologyRequest"("invoiceItemId");

CREATE INDEX "LabOrder_invoiceItemId_idx" ON "LabOrder"("invoiceItemId");

ALTER TABLE "RadiologyRequest" ADD CONSTRAINT "RadiologyRequest_invoiceItemId_fkey" FOREIGN KEY ("invoiceItemId") REFERENCES "InvoiceItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "LabOrder" ADD CONSTRAINT "LabOrder_invoiceItemId_fkey" FOREIGN KEY ("invoiceItemId") REFERENCES "InvoiceItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
