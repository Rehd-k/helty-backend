-- CreateEnum
CREATE TYPE "PurchaseItemAllocationDirection" AS ENUM ('OUT', 'IN');

-- AlterEnum
ALTER TYPE "InvoiceAuditAction" ADD VALUE 'PURCHASE_ITEM_RETURNED';

-- AlterEnum
ALTER TYPE "PurchasesMovementReferenceType" ADD VALUE 'INVOICE_ITEM';

-- AlterTable
ALTER TABLE "InvoiceItem" ADD COLUMN     "purchaseItemId" TEXT,
ADD COLUMN     "purchasesLocationId" TEXT;

-- CreateTable
CREATE TABLE "InvoicePurchaseItemReturn" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "invoiceItemId" TEXT,
    "purchaseItemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "purchasesLocationId" TEXT NOT NULL,
    "performedById" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoicePurchaseItemReturn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseItemStockAllocation" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "direction" "PurchaseItemAllocationDirection" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "costPriceSnapshot" DECIMAL(12,2),
    "sellingPriceSnapshot" DECIMAL(12,2),
    "invoiceItemId" TEXT,
    "performedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PurchaseItemStockAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InvoicePurchaseItemReturn_invoiceId_createdAt_idx" ON "InvoicePurchaseItemReturn"("invoiceId", "createdAt");

-- CreateIndex
CREATE INDEX "InvoicePurchaseItemReturn_purchaseItemId_idx" ON "InvoicePurchaseItemReturn"("purchaseItemId");

-- CreateIndex
CREATE INDEX "InvoicePurchaseItemReturn_purchasesLocationId_idx" ON "InvoicePurchaseItemReturn"("purchasesLocationId");

-- CreateIndex
CREATE INDEX "PurchaseItemStockAllocation_batchId_idx" ON "PurchaseItemStockAllocation"("batchId");

-- CreateIndex
CREATE INDEX "PurchaseItemStockAllocation_invoiceItemId_idx" ON "PurchaseItemStockAllocation"("invoiceItemId");

-- CreateIndex
CREATE INDEX "PurchaseItemStockAllocation_createdAt_idx" ON "PurchaseItemStockAllocation"("createdAt");

-- CreateIndex
CREATE INDEX "InvoiceItem_purchaseItemId_idx" ON "InvoiceItem"("purchaseItemId");

-- CreateIndex
CREATE INDEX "InvoiceItem_purchasesLocationId_idx" ON "InvoiceItem"("purchasesLocationId");

-- AddForeignKey
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_purchaseItemId_fkey" FOREIGN KEY ("purchaseItemId") REFERENCES "PurchaseItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_purchasesLocationId_fkey" FOREIGN KEY ("purchasesLocationId") REFERENCES "PurchasesLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoicePurchaseItemReturn" ADD CONSTRAINT "InvoicePurchaseItemReturn_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoicePurchaseItemReturn" ADD CONSTRAINT "InvoicePurchaseItemReturn_invoiceItemId_fkey" FOREIGN KEY ("invoiceItemId") REFERENCES "InvoiceItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoicePurchaseItemReturn" ADD CONSTRAINT "InvoicePurchaseItemReturn_purchaseItemId_fkey" FOREIGN KEY ("purchaseItemId") REFERENCES "PurchaseItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoicePurchaseItemReturn" ADD CONSTRAINT "InvoicePurchaseItemReturn_purchasesLocationId_fkey" FOREIGN KEY ("purchasesLocationId") REFERENCES "PurchasesLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoicePurchaseItemReturn" ADD CONSTRAINT "InvoicePurchaseItemReturn_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseItemStockAllocation" ADD CONSTRAINT "PurchaseItemStockAllocation_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "PurchaseItemBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseItemStockAllocation" ADD CONSTRAINT "PurchaseItemStockAllocation_invoiceItemId_fkey" FOREIGN KEY ("invoiceItemId") REFERENCES "InvoiceItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseItemStockAllocation" ADD CONSTRAINT "PurchaseItemStockAllocation_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
