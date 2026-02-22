/*
  Warnings:

  - You are about to drop the column `billId` on the `InsuranceClaim` table. All the data in the column will be lost.
  - You are about to drop the `Bill` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `BillAuditLog` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `BillDiscount` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `BillItem` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `BillPayment` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `BillRefund` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PatientService` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `transactionId` to the `InsuranceClaim` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PARTIALLY_PAID', 'PAID', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "TransactionItemSource" AS ENUM ('LAB', 'PHARMACY', 'CONSULTATION', 'ADMISSION', 'RADIOLOGY', 'OTHER');

-- CreateEnum
CREATE TYPE "TransactionPaymentMethod" AS ENUM ('CASH', 'CARD', 'TRANSFER', 'INSURANCE', 'WAIVER');

-- CreateEnum
CREATE TYPE "TransactionAuditAction" AS ENUM ('BILL_CREATED', 'ITEM_ADDED', 'ITEM_EDITED', 'DISCOUNT_APPLIED', 'PAYMENT_RECEIVED', 'BILL_CANCELLED', 'REFUND_ISSUED', 'INSURANCE_APPLIED', 'BILL_REOPENED');

-- DropForeignKey
ALTER TABLE "Bill" DROP CONSTRAINT "Bill_admissionId_fkey";

-- DropForeignKey
ALTER TABLE "Bill" DROP CONSTRAINT "Bill_cancelledById_fkey";

-- DropForeignKey
ALTER TABLE "Bill" DROP CONSTRAINT "Bill_createdById_fkey";

-- DropForeignKey
ALTER TABLE "Bill" DROP CONSTRAINT "Bill_patientId_fkey";

-- DropForeignKey
ALTER TABLE "Bill" DROP CONSTRAINT "Bill_updatedById_fkey";

-- DropForeignKey
ALTER TABLE "BillAuditLog" DROP CONSTRAINT "BillAuditLog_billId_fkey";

-- DropForeignKey
ALTER TABLE "BillAuditLog" DROP CONSTRAINT "BillAuditLog_createdById_fkey";

-- DropForeignKey
ALTER TABLE "BillAuditLog" DROP CONSTRAINT "BillAuditLog_performedById_fkey";

-- DropForeignKey
ALTER TABLE "BillAuditLog" DROP CONSTRAINT "BillAuditLog_updatedById_fkey";

-- DropForeignKey
ALTER TABLE "BillDiscount" DROP CONSTRAINT "BillDiscount_billId_fkey";

-- DropForeignKey
ALTER TABLE "BillDiscount" DROP CONSTRAINT "BillDiscount_createdById_fkey";

-- DropForeignKey
ALTER TABLE "BillDiscount" DROP CONSTRAINT "BillDiscount_grantedById_fkey";

-- DropForeignKey
ALTER TABLE "BillDiscount" DROP CONSTRAINT "BillDiscount_updatedById_fkey";

-- DropForeignKey
ALTER TABLE "BillItem" DROP CONSTRAINT "BillItem_addedById_fkey";

-- DropForeignKey
ALTER TABLE "BillItem" DROP CONSTRAINT "BillItem_billId_fkey";

-- DropForeignKey
ALTER TABLE "BillItem" DROP CONSTRAINT "BillItem_createdById_fkey";

-- DropForeignKey
ALTER TABLE "BillItem" DROP CONSTRAINT "BillItem_priceEditedById_fkey";

-- DropForeignKey
ALTER TABLE "BillItem" DROP CONSTRAINT "BillItem_updatedById_fkey";

-- DropForeignKey
ALTER TABLE "BillPayment" DROP CONSTRAINT "BillPayment_billId_fkey";

-- DropForeignKey
ALTER TABLE "BillPayment" DROP CONSTRAINT "BillPayment_createdById_fkey";

-- DropForeignKey
ALTER TABLE "BillPayment" DROP CONSTRAINT "BillPayment_receivedById_fkey";

-- DropForeignKey
ALTER TABLE "BillPayment" DROP CONSTRAINT "BillPayment_updatedById_fkey";

-- DropForeignKey
ALTER TABLE "BillRefund" DROP CONSTRAINT "BillRefund_billId_fkey";

-- DropForeignKey
ALTER TABLE "BillRefund" DROP CONSTRAINT "BillRefund_createdById_fkey";

-- DropForeignKey
ALTER TABLE "BillRefund" DROP CONSTRAINT "BillRefund_processedById_fkey";

-- DropForeignKey
ALTER TABLE "BillRefund" DROP CONSTRAINT "BillRefund_updatedById_fkey";

-- DropForeignKey
ALTER TABLE "InsuranceClaim" DROP CONSTRAINT "InsuranceClaim_billId_fkey";

-- DropForeignKey
ALTER TABLE "PatientService" DROP CONSTRAINT "PatientService_createdById_fkey";

-- DropForeignKey
ALTER TABLE "PatientService" DROP CONSTRAINT "PatientService_patientId_fkey";

-- DropForeignKey
ALTER TABLE "PatientService" DROP CONSTRAINT "PatientService_serviceId_fkey";

-- DropForeignKey
ALTER TABLE "PatientService" DROP CONSTRAINT "PatientService_updatedById_fkey";

-- AlterTable
ALTER TABLE "InsuranceClaim" DROP COLUMN "billId",
ADD COLUMN     "transactionId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "invoiceId" TEXT;

-- DropTable
DROP TABLE "Bill";

-- DropTable
DROP TABLE "BillAuditLog";

-- DropTable
DROP TABLE "BillDiscount";

-- DropTable
DROP TABLE "BillItem";

-- DropTable
DROP TABLE "BillPayment";

-- DropTable
DROP TABLE "BillRefund";

-- DropTable
DROP TABLE "PatientService";

-- DropEnum
DROP TYPE "BillAuditAction";

-- DropEnum
DROP TYPE "BillItemSource";

-- DropEnum
DROP TYPE "BillPaymentMethod";

-- DropEnum
DROP TYPE "BillStatus";

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "status" "TransactionStatus" NOT NULL,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "staffId" TEXT,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceItem" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "priceAtTime" INTEGER NOT NULL,

    CONSTRAINT "InvoiceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "transactionNumber" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "admissionId" TEXT,
    "status" "TransactionStatus" NOT NULL DEFAULT 'DRAFT',
    "totalAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "discountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "insuranceCovered" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "amountPaid" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "cancelledById" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransactionItem" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "source" "TransactionItemSource" NOT NULL,
    "referenceId" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "totalPrice" DECIMAL(12,2) NOT NULL,
    "addedById" TEXT NOT NULL,
    "priceEditedById" TEXT,
    "priceEditedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransactionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransactionPayment" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "method" "TransactionPaymentMethod" NOT NULL,
    "reference" TEXT,
    "notes" TEXT,
    "receivedById" TEXT NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "updatedById" TEXT,

    CONSTRAINT "TransactionPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransactionDiscount" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "type" "DiscountType" NOT NULL,
    "value" DECIMAL(12,2) NOT NULL,
    "computedAmount" DECIMAL(12,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "grantedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "updatedById" TEXT,

    CONSTRAINT "TransactionDiscount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransactionRefund" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "processedById" TEXT NOT NULL,
    "refundedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "updatedById" TEXT,

    CONSTRAINT "TransactionRefund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransactionAuditLog" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "action" "TransactionAuditAction" NOT NULL,
    "description" TEXT NOT NULL,
    "performedById" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "updatedById" TEXT,

    CONSTRAINT "TransactionAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_transactionNumber_key" ON "Transaction"("transactionNumber");

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "Admission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionItem" ADD CONSTRAINT "TransactionItem_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionItem" ADD CONSTRAINT "TransactionItem_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionItem" ADD CONSTRAINT "TransactionItem_priceEditedById_fkey" FOREIGN KEY ("priceEditedById") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionItem" ADD CONSTRAINT "TransactionItem_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionItem" ADD CONSTRAINT "TransactionItem_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionPayment" ADD CONSTRAINT "TransactionPayment_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionPayment" ADD CONSTRAINT "TransactionPayment_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionPayment" ADD CONSTRAINT "TransactionPayment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionPayment" ADD CONSTRAINT "TransactionPayment_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionDiscount" ADD CONSTRAINT "TransactionDiscount_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionDiscount" ADD CONSTRAINT "TransactionDiscount_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionDiscount" ADD CONSTRAINT "TransactionDiscount_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionDiscount" ADD CONSTRAINT "TransactionDiscount_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsuranceClaim" ADD CONSTRAINT "InsuranceClaim_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionRefund" ADD CONSTRAINT "TransactionRefund_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionRefund" ADD CONSTRAINT "TransactionRefund_processedById_fkey" FOREIGN KEY ("processedById") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionRefund" ADD CONSTRAINT "TransactionRefund_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionRefund" ADD CONSTRAINT "TransactionRefund_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionAuditLog" ADD CONSTRAINT "TransactionAuditLog_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionAuditLog" ADD CONSTRAINT "TransactionAuditLog_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionAuditLog" ADD CONSTRAINT "TransactionAuditLog_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionAuditLog" ADD CONSTRAINT "TransactionAuditLog_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
