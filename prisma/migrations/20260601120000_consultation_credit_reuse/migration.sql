-- AlterTable
ALTER TABLE "InvoiceItem" ADD COLUMN "consultationVisitsConsumed" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "InvoiceItem" ADD COLUMN "consultationCreditExpiresAt" TIMESTAMP(3);

-- Backfill expiry for paid consultation lines (latest payment + 14 days, else invoice updatedAt + 14 days)
UPDATE "InvoiceItem" ii
SET "consultationCreditExpiresAt" = COALESCE(
  (
    SELECT MAX(ip."paidAt") + INTERVAL '14 days'
    FROM "InvoicePayment" ip
    WHERE ip."invoiceId" = ii."invoiceId"
  ),
  (
    SELECT inv."updatedAt" + INTERVAL '14 days'
    FROM "Invoice" inv
    WHERE inv.id = ii."invoiceId"
  )
)
WHERE ii."serviceId" IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM "Service" s
    INNER JOIN "ServiceCategory" sc ON sc.id = s."categoryId"
    WHERE s.id = ii."serviceId"
      AND LOWER(sc.name) = LOWER('Consultations & Reviews')
  )
  AND EXISTS (
    SELECT 1 FROM "Invoice" inv
    WHERE inv.id = ii."invoiceId" AND inv.status = 'PAID'
  );

-- Already-settled consultation lines treated as fully consumed
UPDATE "InvoiceItem" ii
SET "consultationVisitsConsumed" = 2
WHERE ii."settled" = true
  AND ii."serviceId" IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM "Service" s
    INNER JOIN "ServiceCategory" sc ON sc.id = s."categoryId"
    WHERE s.id = ii."serviceId"
      AND LOWER(sc.name) = LOWER('Consultations & Reviews')
  );

-- Clear encounter link on invoices that still have reusable consultation credit
UPDATE "Invoice" inv
SET "encounterId" = NULL
WHERE inv."encounterId" IS NOT NULL
  AND inv.status = 'PAID'
  AND EXISTS (
    SELECT 1
    FROM "InvoiceItem" ii
    INNER JOIN "Service" s ON s.id = ii."serviceId"
    INNER JOIN "ServiceCategory" sc ON sc.id = s."categoryId"
    WHERE ii."invoiceId" = inv.id
      AND LOWER(sc.name) = LOWER('Consultations & Reviews')
      AND ii."settled" = false
      AND ii."consultationVisitsConsumed" < 2
      AND (ii."consultationCreditExpiresAt" IS NULL OR ii."consultationCreditExpiresAt" > NOW())
  );
