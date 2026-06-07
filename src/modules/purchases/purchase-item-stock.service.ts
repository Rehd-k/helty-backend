import { BadRequestException, Injectable } from '@nestjs/common';
import {
  Prisma,
  PurchaseItemAllocationDirection,
  PurchasesInventoryMovementType,
  PurchasesMovementReferenceType,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PurchaseItemStockService {
  constructor(private readonly prisma: PrismaService) {}

  async assertPurchasesLocation(
    tx: Prisma.TransactionClient,
    purchasesLocationId: string,
  ) {
    const loc = await tx.purchasesLocation.findUnique({
      where: { id: purchasesLocationId },
      select: { id: true, isActive: true },
    });
    if (!loc) {
      throw new BadRequestException(
        `Purchases location "${purchasesLocationId}" not found.`,
      );
    }
    if (!loc.isActive) {
      throw new BadRequestException(
        `Purchases location "${purchasesLocationId}" is not active.`,
      );
    }
  }

  async availableQuantity(
    tx: Prisma.TransactionClient,
    purchaseItemId: string,
    purchasesLocationId: string,
  ): Promise<number> {
    const agg = await tx.purchaseItemBatch.aggregate({
      where: {
        itemId: purchaseItemId,
        toLocationId: purchasesLocationId,
        quantityRemaining: { gt: 0 },
      },
      _sum: { quantityRemaining: true },
    });
    return agg._sum.quantityRemaining ?? 0;
  }

  private async loadFifoBatches(
    tx: Prisma.TransactionClient,
    purchaseItemId: string,
    purchasesLocationId: string,
  ) {
    const batches = await tx.purchaseItemBatch.findMany({
      where: {
        itemId: purchaseItemId,
        toLocationId: purchasesLocationId,
        quantityRemaining: { gt: 0 },
      },
      orderBy: [{ expiryDate: 'asc' }, { createdAt: 'asc' }],
    });
    return [...batches].sort((a, b) => {
      if (a.expiryDate == null && b.expiryDate == null) return 0;
      if (a.expiryDate == null) return 1;
      if (b.expiryDate == null) return -1;
      return a.expiryDate.getTime() - b.expiryDate.getTime();
    });
  }

  async assertEnoughStock(
    tx: Prisma.TransactionClient,
    purchaseItemId: string,
    purchasesLocationId: string,
    quantity: number,
  ) {
    if (quantity <= 0) return;
    const total = await this.availableQuantity(
      tx,
      purchaseItemId,
      purchasesLocationId,
    );
    if (total < quantity) {
      throw new BadRequestException(
        `Insufficient purchase item stock: need ${quantity} unit(s), ${total} available at this location.`,
      );
    }
  }

  async applyFifoOut(
    tx: Prisma.TransactionClient,
    params: {
      purchaseItemId: string;
      purchasesLocationId: string;
      quantity: number;
      performedById: string;
      invoiceItemId: string;
    },
  ) {
    const {
      purchaseItemId,
      purchasesLocationId,
      quantity,
      performedById,
      invoiceItemId,
    } = params;
    if (quantity <= 0) return;

    await this.assertEnoughStock(
      tx,
      purchaseItemId,
      purchasesLocationId,
      quantity,
    );

    const batches = await this.loadFifoBatches(
      tx,
      purchaseItemId,
      purchasesLocationId,
    );
    let remaining = quantity;

    for (const batch of batches) {
      if (remaining <= 0) break;
      const fresh = await tx.purchaseItemBatch.findUnique({
        where: { id: batch.id },
      });
      if (!fresh || (fresh.quantityRemaining ?? 0) <= 0) continue;
      const take = Math.min(fresh.quantityRemaining ?? 0, remaining);
      if (take <= 0) continue;

      await tx.purchaseItemBatch.update({
        where: { id: batch.id },
        data: { quantityRemaining: (fresh.quantityRemaining ?? 0) - take },
      });

      await tx.purchaseItemStockAllocation.create({
        data: {
          id: randomUUID(),
          batchId: batch.id,
          direction: PurchaseItemAllocationDirection.OUT,
          quantity: take,
          costPriceSnapshot: fresh.costPrice,
          sellingPriceSnapshot: fresh.sellingPrice,
          invoiceItemId,
          performedById,
        },
      });

      await tx.purchasesInventoryMovement.create({
        data: {
          batchId: batch.id,
          itemId: purchaseItemId,
          fromLocationId: purchasesLocationId,
          movementType: PurchasesInventoryMovementType.ADJUSTMENT,
          quantity: take,
          referenceType: PurchasesMovementReferenceType.INVOICE_ITEM,
          referenceId: invoiceItemId,
          performedById,
        },
      });

      remaining -= take;
    }
  }

  async releaseOutQuantityForInvoiceItem(
    tx: Prisma.TransactionClient,
    invoiceItemId: string,
    quantity: number,
    performedById: string,
  ) {
    if (quantity <= 0) return;
    let remaining = quantity;
    const outs = await tx.purchaseItemStockAllocation.findMany({
      where: {
        invoiceItemId,
        direction: PurchaseItemAllocationDirection.OUT,
      },
      orderBy: { createdAt: 'desc' },
    });

    for (const row of outs) {
      if (remaining <= 0) break;
      const take = Math.min(row.quantity, remaining);
      if (take <= 0) continue;

      const batchRow = await tx.purchaseItemBatch.findUniqueOrThrow({
        where: { id: row.batchId },
        select: { itemId: true, toLocationId: true },
      });

      await tx.purchaseItemBatch.update({
        where: { id: row.batchId },
        data: { quantityRemaining: { increment: take } },
      });

      await tx.purchaseItemStockAllocation.create({
        data: {
          id: randomUUID(),
          batchId: row.batchId,
          direction: PurchaseItemAllocationDirection.IN,
          quantity: take,
          costPriceSnapshot: row.costPriceSnapshot,
          sellingPriceSnapshot: row.sellingPriceSnapshot,
          invoiceItemId,
          performedById,
        },
      });

      await tx.purchasesInventoryMovement.create({
        data: {
          batchId: row.batchId,
          itemId: batchRow.itemId,
          toLocationId: batchRow.toLocationId,
          movementType: PurchasesInventoryMovementType.RETURN,
          quantity: take,
          referenceType: PurchasesMovementReferenceType.INVOICE_ITEM,
          referenceId: invoiceItemId,
          performedById,
        },
      });

      if (take === row.quantity) {
        await tx.purchaseItemStockAllocation.delete({ where: { id: row.id } });
      } else {
        await tx.purchaseItemStockAllocation.update({
          where: { id: row.id },
          data: { quantity: row.quantity - take },
        });
      }

      remaining -= take;
    }

    if (remaining > 0) {
      throw new BadRequestException(
        'Could not restore full quantity from purchase item allocations; data may be inconsistent.',
      );
    }
  }

  async releaseFifoOutForInvoiceItem(
    tx: Prisma.TransactionClient,
    invoiceItemId: string,
    performedById: string,
  ) {
    const outs = await tx.purchaseItemStockAllocation.findMany({
      where: {
        invoiceItemId,
        direction: PurchaseItemAllocationDirection.OUT,
      },
      orderBy: { createdAt: 'desc' },
    });
    const total = outs.reduce((s, r) => s + r.quantity, 0);
    if (total <= 0) return;
    await this.releaseOutQuantityForInvoiceItem(
      tx,
      invoiceItemId,
      total,
      performedById,
    );
  }
}
