/*
  Warnings:

  - You are about to drop the `PurchaseNote` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PurchaseNoteItem` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "PurchasesLocationType" AS ENUM ('STORE', 'WAREHOUSE', 'DEPARTMENT', 'COLD_ROOM');

-- CreateEnum
CREATE TYPE "PurchasesOrderStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PurchasesStockTransferStatus" AS ENUM ('PENDING', 'APPROVED', 'IN_TRANSIT', 'COMPLETED', 'REJECTED');

-- CreateEnum
CREATE TYPE "RequisitionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'FULFILLED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RequestingDepartment" AS ENUM ('PHARMACY', 'STORE', 'PURCHASES', 'LAB', 'RADIOLOGY', 'OTHER');

-- CreateEnum
CREATE TYPE "PurchasesInventoryMovementType" AS ENUM ('PURCHASE', 'TRANSFER_OUT', 'TRANSFER_IN', 'ADJUSTMENT', 'RETURN', 'EXPIRY_WRITEOFF');

-- CreateEnum
CREATE TYPE "PurchasesMovementReferenceType" AS ENUM ('PURCHASE_ORDER', 'TRANSFER', 'GOODS_RECEIPT', 'ADJUSTMENT', 'REQUISITION');

-- CreateEnum
CREATE TYPE "RequisitionLinePriority" AS ENUM ('NORMAL', 'URGENT', 'CRITICAL');

-- CreateEnum
CREATE TYPE "RequisitionItemType" AS ENUM ('DRUG', 'CONSUMABLE', 'PURCHASE_ITEM');

-- AlterEnum
ALTER TYPE "AccountType" ADD VALUE 'PURCHASES';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "StaffRole" ADD VALUE 'PURCHASES_STORE';
ALTER TYPE "StaffRole" ADD VALUE 'PURCHASES_HEAD';

-- CreateTable
CREATE TABLE "PurchasesManufacturer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT,
    "contactInfo" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "PurchasesManufacturer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchasesSupplier" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "licenseNumber" TEXT,
    "contactInfo" JSONB,
    "creditTerms" TEXT,
    "leadTimeDays" INTEGER,
    "rating" INTEGER,
    "isBlacklisted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "PurchasesSupplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseItem" (
    "id" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "sku" TEXT,
    "category" TEXT,
    "description" TEXT,
    "manufacturerId" TEXT,
    "unitOfMeasure" TEXT,
    "reorderLevel" INTEGER NOT NULL DEFAULT 0,
    "reorderQuantity" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "PurchaseItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchasesLocation" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "locationType" "PurchasesLocationType" NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "staffId" TEXT,

    CONSTRAINT "PurchasesLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseItemBatch" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "purchaseOrderId" TEXT,
    "supplierId" TEXT,
    "batchNumber" TEXT,
    "manufacturingDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "quantityReceived" INTEGER NOT NULL,
    "quantityRemaining" INTEGER,
    "costPrice" DECIMAL(12,2),
    "sellingPrice" DECIMAL(12,2),
    "fromLocationId" TEXT,
    "toLocationId" TEXT,
    "grnId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PurchaseItemBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchasesInventoryMovement" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "fromLocationId" TEXT,
    "toLocationId" TEXT,
    "movementType" "PurchasesInventoryMovementType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "referenceType" "PurchasesMovementReferenceType" NOT NULL,
    "referenceId" TEXT NOT NULL,
    "performedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PurchasesInventoryMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchasesPurchaseOrder" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "status" "PurchasesOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "totalAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "requisitionId" TEXT,
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchasesPurchaseOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchasesPurchaseOrderLine" (
    "id" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitCost" DECIMAL(12,2) NOT NULL,
    "lineTotal" DECIMAL(12,2) NOT NULL,
    "externalItemName" TEXT,

    CONSTRAINT "PurchasesPurchaseOrderLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchasesGoodsReceipt" (
    "id" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "receivedById" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "PurchasesGoodsReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchasesGoodsReceiptItem" (
    "id" TEXT NOT NULL,
    "goodsReceiptId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "batchNumber" TEXT,
    "manufacturingDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "quantityReceived" INTEGER NOT NULL,
    "costPrice" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "PurchasesGoodsReceiptItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchasesStockTransfer" (
    "id" TEXT NOT NULL,
    "fromLocationId" TEXT NOT NULL,
    "toLocationId" TEXT NOT NULL,
    "status" "PurchasesStockTransferStatus" NOT NULL DEFAULT 'PENDING',
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "PurchasesStockTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchasesStockTransferLine" (
    "id" TEXT NOT NULL,
    "stockTransferId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "PurchasesStockTransferLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Requisition" (
    "id" TEXT NOT NULL,
    "requestingDepartment" "RequestingDepartment" NOT NULL,
    "requestedById" TEXT NOT NULL,
    "status" "RequisitionStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "rejectReason" TEXT,
    "approvedById" TEXT,
    "rejectedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Requisition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequisitionLine" (
    "id" TEXT NOT NULL,
    "requisitionId" TEXT NOT NULL,
    "itemType" "RequisitionItemType" NOT NULL,
    "itemId" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "priority" "RequisitionLinePriority" NOT NULL DEFAULT 'NORMAL',
    "notes" TEXT,
    "purchaseItemId" TEXT,

    CONSTRAINT "RequisitionLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PurchasesManufacturer_name_idx" ON "PurchasesManufacturer"("name");

-- CreateIndex
CREATE INDEX "PurchasesSupplier_name_idx" ON "PurchasesSupplier"("name");

-- CreateIndex
CREATE INDEX "PurchaseItem_manufacturerId_idx" ON "PurchaseItem"("manufacturerId");

-- CreateIndex
CREATE INDEX "PurchaseItem_itemName_idx" ON "PurchaseItem"("itemName");

-- CreateIndex
CREATE INDEX "PurchaseItem_deletedAt_idx" ON "PurchaseItem"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PurchasesLocation_staffId_key" ON "PurchasesLocation"("staffId");

-- CreateIndex
CREATE INDEX "PurchaseItemBatch_itemId_idx" ON "PurchaseItemBatch"("itemId");

-- CreateIndex
CREATE INDEX "PurchaseItemBatch_supplierId_idx" ON "PurchaseItemBatch"("supplierId");

-- CreateIndex
CREATE INDEX "PurchaseItemBatch_expiryDate_idx" ON "PurchaseItemBatch"("expiryDate");

-- CreateIndex
CREATE INDEX "PurchaseItemBatch_fromLocationId_toLocationId_idx" ON "PurchaseItemBatch"("fromLocationId", "toLocationId");

-- CreateIndex
CREATE INDEX "PurchasesInventoryMovement_batchId_idx" ON "PurchasesInventoryMovement"("batchId");

-- CreateIndex
CREATE INDEX "PurchasesInventoryMovement_itemId_idx" ON "PurchasesInventoryMovement"("itemId");

-- CreateIndex
CREATE INDEX "PurchasesInventoryMovement_createdAt_idx" ON "PurchasesInventoryMovement"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PurchasesPurchaseOrder_requisitionId_key" ON "PurchasesPurchaseOrder"("requisitionId");

-- CreateIndex
CREATE INDEX "PurchasesPurchaseOrder_supplierId_idx" ON "PurchasesPurchaseOrder"("supplierId");

-- CreateIndex
CREATE INDEX "PurchasesPurchaseOrder_status_idx" ON "PurchasesPurchaseOrder"("status");

-- CreateIndex
CREATE INDEX "PurchasesPurchaseOrderLine_purchaseOrderId_idx" ON "PurchasesPurchaseOrderLine"("purchaseOrderId");

-- CreateIndex
CREATE INDEX "PurchasesPurchaseOrderLine_itemId_idx" ON "PurchasesPurchaseOrderLine"("itemId");

-- CreateIndex
CREATE INDEX "Requisition_status_idx" ON "Requisition"("status");

-- CreateIndex
CREATE INDEX "Requisition_requestingDepartment_idx" ON "Requisition"("requestingDepartment");

-- CreateIndex
CREATE INDEX "Requisition_createdAt_idx" ON "Requisition"("createdAt");

-- CreateIndex
CREATE INDEX "RequisitionLine_requisitionId_idx" ON "RequisitionLine"("requisitionId");

-- AddForeignKey
ALTER TABLE "PurchasesManufacturer" ADD CONSTRAINT "PurchasesManufacturer_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchasesSupplier" ADD CONSTRAINT "PurchasesSupplier_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseItem" ADD CONSTRAINT "PurchaseItem_manufacturerId_fkey" FOREIGN KEY ("manufacturerId") REFERENCES "PurchasesManufacturer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseItem" ADD CONSTRAINT "PurchaseItem_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseItem" ADD CONSTRAINT "PurchaseItem_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchasesLocation" ADD CONSTRAINT "PurchasesLocation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchasesLocation" ADD CONSTRAINT "PurchasesLocation_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchasesLocation" ADD CONSTRAINT "PurchasesLocation_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseItemBatch" ADD CONSTRAINT "PurchaseItemBatch_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "PurchaseItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseItemBatch" ADD CONSTRAINT "PurchaseItemBatch_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchasesPurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseItemBatch" ADD CONSTRAINT "PurchaseItemBatch_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "PurchasesSupplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseItemBatch" ADD CONSTRAINT "PurchaseItemBatch_fromLocationId_fkey" FOREIGN KEY ("fromLocationId") REFERENCES "PurchasesLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseItemBatch" ADD CONSTRAINT "PurchaseItemBatch_toLocationId_fkey" FOREIGN KEY ("toLocationId") REFERENCES "PurchasesLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseItemBatch" ADD CONSTRAINT "PurchaseItemBatch_grnId_fkey" FOREIGN KEY ("grnId") REFERENCES "PurchasesGoodsReceipt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchasesInventoryMovement" ADD CONSTRAINT "PurchasesInventoryMovement_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "PurchaseItemBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchasesInventoryMovement" ADD CONSTRAINT "PurchasesInventoryMovement_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "PurchaseItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchasesInventoryMovement" ADD CONSTRAINT "PurchasesInventoryMovement_fromLocationId_fkey" FOREIGN KEY ("fromLocationId") REFERENCES "PurchasesLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchasesInventoryMovement" ADD CONSTRAINT "PurchasesInventoryMovement_toLocationId_fkey" FOREIGN KEY ("toLocationId") REFERENCES "PurchasesLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchasesInventoryMovement" ADD CONSTRAINT "PurchasesInventoryMovement_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchasesPurchaseOrder" ADD CONSTRAINT "PurchasesPurchaseOrder_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "PurchasesSupplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchasesPurchaseOrder" ADD CONSTRAINT "PurchasesPurchaseOrder_requisitionId_fkey" FOREIGN KEY ("requisitionId") REFERENCES "Requisition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchasesPurchaseOrder" ADD CONSTRAINT "PurchasesPurchaseOrder_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchasesPurchaseOrder" ADD CONSTRAINT "PurchasesPurchaseOrder_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchasesPurchaseOrderLine" ADD CONSTRAINT "PurchasesPurchaseOrderLine_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchasesPurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchasesPurchaseOrderLine" ADD CONSTRAINT "PurchasesPurchaseOrderLine_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "PurchaseItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchasesGoodsReceipt" ADD CONSTRAINT "PurchasesGoodsReceipt_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchasesPurchaseOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchasesGoodsReceipt" ADD CONSTRAINT "PurchasesGoodsReceipt_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchasesGoodsReceiptItem" ADD CONSTRAINT "PurchasesGoodsReceiptItem_goodsReceiptId_fkey" FOREIGN KEY ("goodsReceiptId") REFERENCES "PurchasesGoodsReceipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchasesGoodsReceiptItem" ADD CONSTRAINT "PurchasesGoodsReceiptItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "PurchaseItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchasesStockTransfer" ADD CONSTRAINT "PurchasesStockTransfer_fromLocationId_fkey" FOREIGN KEY ("fromLocationId") REFERENCES "PurchasesLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchasesStockTransfer" ADD CONSTRAINT "PurchasesStockTransfer_toLocationId_fkey" FOREIGN KEY ("toLocationId") REFERENCES "PurchasesLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchasesStockTransfer" ADD CONSTRAINT "PurchasesStockTransfer_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchasesStockTransfer" ADD CONSTRAINT "PurchasesStockTransfer_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchasesStockTransferLine" ADD CONSTRAINT "PurchasesStockTransferLine_stockTransferId_fkey" FOREIGN KEY ("stockTransferId") REFERENCES "PurchasesStockTransfer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchasesStockTransferLine" ADD CONSTRAINT "PurchasesStockTransferLine_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "PurchaseItemBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Requisition" ADD CONSTRAINT "Requisition_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Requisition" ADD CONSTRAINT "Requisition_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Requisition" ADD CONSTRAINT "Requisition_rejectedById_fkey" FOREIGN KEY ("rejectedById") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequisitionLine" ADD CONSTRAINT "RequisitionLine_requisitionId_fkey" FOREIGN KEY ("requisitionId") REFERENCES "Requisition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequisitionLine" ADD CONSTRAINT "RequisitionLine_purchaseItemId_fkey" FOREIGN KEY ("purchaseItemId") REFERENCES "PurchaseItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Migrate PurchaseNote -> Requisition (if legacy tables exist)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'PurchaseNote') THEN
    INSERT INTO "Requisition" (
      "id", "requestingDepartment", "requestedById", "status", "notes",
      "createdAt", "updatedAt"
    )
    SELECT
      pn."id",
      CASE
        WHEN LOWER(d."name") LIKE '%pharm%' THEN 'PHARMACY'::"RequestingDepartment"
        WHEN LOWER(d."name") LIKE '%store%' THEN 'STORE'::"RequestingDepartment"
        WHEN LOWER(d."name") LIKE '%lab%' THEN 'LAB'::"RequestingDepartment"
        WHEN LOWER(d."name") LIKE '%radio%' THEN 'RADIOLOGY'::"RequestingDepartment"
        WHEN LOWER(d."name") LIKE '%purch%' THEN 'PURCHASES'::"RequestingDepartment"
        ELSE 'OTHER'::"RequestingDepartment"
      END,
      pn."requestedById",
      CASE pn."status"
        WHEN 'PENDING' THEN 'PENDING'::"RequisitionStatus"
        WHEN 'APPROVED' THEN 'APPROVED'::"RequisitionStatus"
        WHEN 'REJECTED' THEN 'REJECTED'::"RequisitionStatus"
        WHEN 'ORDERED' THEN 'APPROVED'::"RequisitionStatus"
        WHEN 'COMPLETED' THEN 'FULFILLED'::"RequisitionStatus"
        ELSE 'PENDING'::"RequisitionStatus"
      END,
      pn."remarks",
      pn."createdAt",
      pn."updatedAt"
    FROM "PurchaseNote" pn
    JOIN "Department" d ON d."id" = pn."requestingDepartmentId";

    INSERT INTO "RequisitionLine" (
      "id", "requisitionId", "itemType", "itemId", "itemName", "quantity",
      "priority", "purchaseItemId"
    )
    SELECT
      pni."id",
      pni."purchaseNoteId",
      CASE WHEN pni."storeItemId" IS NOT NULL THEN 'CONSUMABLE'::"RequisitionItemType" ELSE 'PURCHASE_ITEM'::"RequisitionItemType" END,
      COALESCE(pni."storeItemId", pni."id"),
      pni."description",
      GREATEST(1, ROUND(pni."quantity")::int),
      CASE pni."priority"
        WHEN 'LOW' THEN 'NORMAL'::"RequisitionLinePriority"
        WHEN 'NORMAL' THEN 'NORMAL'::"RequisitionLinePriority"
        WHEN 'HIGH' THEN 'URGENT'::"RequisitionLinePriority"
        WHEN 'CRITICAL' THEN 'CRITICAL'::"RequisitionLinePriority"
        ELSE 'NORMAL'::"RequisitionLinePriority"
      END,
      NULL
    FROM "PurchaseNoteItem" pni;

    ALTER TABLE "PurchaseNoteItem" DROP CONSTRAINT IF EXISTS "PurchaseNoteItem_purchaseNoteId_fkey";
    ALTER TABLE "PurchaseNoteItem" DROP CONSTRAINT IF EXISTS "PurchaseNoteItem_storeItemId_fkey";
    ALTER TABLE "PurchaseNote" DROP CONSTRAINT IF EXISTS "PurchaseNote_requestedById_fkey";
    ALTER TABLE "PurchaseNote" DROP CONSTRAINT IF EXISTS "PurchaseNote_requestingDepartmentId_fkey";
    DROP TABLE "PurchaseNoteItem";
    DROP TABLE "PurchaseNote";
    DROP TYPE IF EXISTS "PurchaseNotePriority";
    DROP TYPE IF EXISTS "PurchaseNoteStatus";
  END IF;
END $$;

-- Seed default purchases warehouse (requires at least one staff row)
INSERT INTO "PurchasesLocation" (
  "id", "name", "locationType", "description", "isActive",
  "createdAt", "updatedAt", "createdById", "updatedById"
)
SELECT
  gen_random_uuid()::text,
  'Main Warehouse',
  'WAREHOUSE'::"PurchasesLocationType",
  'Default purchases storage location',
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  s."id",
  s."id"
FROM "Staff" s
ORDER BY s."createdAt" ASC
LIMIT 1;
