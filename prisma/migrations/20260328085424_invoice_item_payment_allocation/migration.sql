-- AlterTable
ALTER TABLE "InvoiceItem" ADD COLUMN     "amountPaid" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "InvoiceItemPayment" (
    "id" TEXT NOT NULL,
    "invoiceItemId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoiceItemPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InvoiceItemPayment_invoiceItemId_idx" ON "InvoiceItemPayment"("invoiceItemId");

-- CreateIndex
CREATE INDEX "InvoiceItemPayment_transactionId_idx" ON "InvoiceItemPayment"("transactionId");

-- AddForeignKey
ALTER TABLE "InvoiceItemPayment" ADD CONSTRAINT "InvoiceItemPayment_invoiceItemId_fkey" FOREIGN KEY ("invoiceItemId") REFERENCES "InvoiceItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceItemPayment" ADD CONSTRAINT "InvoiceItemPayment_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
