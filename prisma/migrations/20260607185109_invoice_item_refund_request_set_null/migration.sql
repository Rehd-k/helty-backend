-- DropForeignKey
ALTER TABLE "InvoiceItemRefundRequest" DROP CONSTRAINT "InvoiceItemRefundRequest_invoiceItemId_fkey";

-- AlterTable
ALTER TABLE "InvoiceItemRefundRequest" ALTER COLUMN "invoiceItemId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "InvoiceItemRefundRequest" ADD CONSTRAINT "InvoiceItemRefundRequest_invoiceItemId_fkey" FOREIGN KEY ("invoiceItemId") REFERENCES "InvoiceItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
