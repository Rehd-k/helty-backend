import { BadRequestException, Injectable } from '@nestjs/common';
import {
  Prisma,
  MovementReferenceType,
  ConsumableAllocationDirection,
  InventoryMovementType,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';

export type ConsumableFifoContext =
  | {
      kind: 'invoice';
      invoiceItemId: string;
      referenceId: string;
    }
  | {
      kind: 'usage';
      usageEventId: string;
      referenceId: string;
    };

@Injectable()
export class ConsumableStockService {
  constructor(private readonly prisma: PrismaService) {}

  async assertStoreLocation(tx: Prisma.TransactionClient, storeLocationId: string) {
    const loc = await tx.storeLocation.findUnique({
      where: { id: storeLocationId },
      select: { id: true, isActive: true },
    });
    if (!loc) {
      throw new BadRequestException(`Store location "${storeLocationId}" not found.`);
    }
    if (!loc.isActive) {
      throw new BadRequestException(`Store location "${storeLocationId}" is not active.`);
    }
  }

  async availableQuantity(
    tx: Prisma.TransactionClient,
    consumableId: string,
    storeLocationId: string,
  ): Promise<number> {
    const agg = await tx.consumableBatch.aggregate({
      where: {
        consumableId,
        storeLocationId,
        quantityRemaining: { gt: 0 },
      },
      _sum: { quantityRemaining: true },
    });
    return agg._sum.quantityRemaining ?? 0;
  }

  /**
   * FIFO: earliest expiry (nulls last), then oldest batch.
   */
  private async loadFifoBatches(
    tx: Prisma.TransactionClient,
    consumableId: string,
    storeLocationId: string,
  ) {
    const batches = await tx.consumableBatch.findMany({
      where: {
        consumableId,
        storeLocationId,
        quantityRemaining: { gt: 0 },
      },
      orderBy: [{ expiryDate: 'asc' }, { createdAt: 'asc' }],
    });
    // Prisma sorts null expiry first in asc — move nulls to end for typical FIFO (use no-expiry last)
    return [...batches].sort((a, b) => {
      if (a.expiryDate == null && b.expiryDate == null) return 0;
      if (a.expiryDate == null) return 1;
      if (b.expiryDate == null) return -1;
      return a.expiryDate.getTime() - b.expiryDate.getTime();
    });
  }

  async assertEnoughStock(
    tx: Prisma.TransactionClient,
    consumableId: string,
    storeLocationId: string,
    quantity: number,
  ) {
    if (quantity <= 0) return;
    const total = await this.availableQuantity(tx, consumableId, storeLocationId);
    if (total < quantity) {
      throw new BadRequestException(
        `Insufficient consumable stock: need ${quantity} unit(s), ${total} available at this location.`,
      );
    }
  }

  /**
   * Deduct FIFO and write OUT allocations + DISPENSE movements.
   */
  async applyFifoOut(
    tx: Prisma.TransactionClient,
    params: {
      consumableId: string;
      storeLocationId: string;
      quantity: number;
      performedById: string;
      ctx: ConsumableFifoContext;
    },
  ) {
    const { consumableId, storeLocationId, quantity, performedById, ctx } = params;
    if (quantity <= 0) return;

    await this.assertEnoughStock(tx, consumableId, storeLocationId, quantity);

    const batches = await this.loadFifoBatches(tx, consumableId, storeLocationId);
    let remaining = quantity;
    const refType =
      ctx.kind === 'invoice'
        ? MovementReferenceType.INVOICE_ITEM
        : MovementReferenceType.CONSUMABLE_USAGE_EVENT;
    const refId = ctx.referenceId;

    for (const batch of batches) {
      if (remaining <= 0) break;
      const fresh = await tx.consumableBatch.findUnique({
        where: { id: batch.id },
      });
      if (!fresh || fresh.quantityRemaining <= 0) continue;
      const take = Math.min(fresh.quantityRemaining, remaining);
      if (take <= 0) continue;

      await tx.consumableBatch.update({
        where: { id: batch.id },
        data: { quantityRemaining: fresh.quantityRemaining - take },
      });

      await tx.consumableStockAllocation.create({
        data: {
          id: randomUUID(),
          batchId: batch.id,
          direction: ConsumableAllocationDirection.OUT,
          quantity: take,
          costPriceSnapshot: fresh.costPrice,
          sellingPriceSnapshot: fresh.sellingPrice,
          invoiceItemId: ctx.kind === 'invoice' ? ctx.invoiceItemId : null,
          usageEventId: ctx.kind === 'usage' ? ctx.usageEventId : null,
          performedById,
        },
      });

      await tx.consumableMovement.create({
        data: {
          id: randomUUID(),
          batchId: batch.id,
          consumableId,
          movementType: InventoryMovementType.DISPENSE,
          storeLocationId,
          quantity: take,
          referenceType: refType,
          referenceId: refId,
          performedById,
        },
      });

      remaining -= take;
    }
  }

  /**
   * Restore up to `quantity` units from OUT allocations (LIFO). Creates IN rows + RETURN movements.
   */
  async releaseOutQuantityForInvoiceItem(
    tx: Prisma.TransactionClient,
    invoiceItemId: string,
    quantity: number,
    performedById: string,
  ) {
    if (quantity <= 0) return;
    let remaining = quantity;
    const outs = await tx.consumableStockAllocation.findMany({
      where: {
        invoiceItemId,
        direction: ConsumableAllocationDirection.OUT,
      },
      orderBy: { createdAt: 'desc' },
    });

    for (const row of outs) {
      if (remaining <= 0) break;
      const take = Math.min(row.quantity, remaining);
      if (take <= 0) continue;

      const batchRow = await tx.consumableBatch.findUniqueOrThrow({
        where: { id: row.batchId },
        select: { consumableId: true, storeLocationId: true },
      });

      await tx.consumableBatch.update({
        where: { id: row.batchId },
        data: { quantityRemaining: { increment: take } },
      });

      await tx.consumableStockAllocation.create({
        data: {
          id: randomUUID(),
          batchId: row.batchId,
          direction: ConsumableAllocationDirection.IN,
          quantity: take,
          costPriceSnapshot: row.costPriceSnapshot,
          sellingPriceSnapshot: row.sellingPriceSnapshot,
          invoiceItemId,
          performedById,
        },
      });

      await tx.consumableMovement.create({
        data: {
          id: randomUUID(),
          batchId: row.batchId,
          consumableId: batchRow.consumableId,
          movementType: InventoryMovementType.RETURN,
          storeLocationId: batchRow.storeLocationId,
          quantity: take,
          referenceType: MovementReferenceType.INVOICE_ITEM,
          referenceId: invoiceItemId,
          performedById,
        },
      });

      if (take === row.quantity) {
        await tx.consumableStockAllocation.delete({ where: { id: row.id } });
      } else {
        await tx.consumableStockAllocation.update({
          where: { id: row.id },
          data: { quantity: row.quantity - take },
        });
      }

      remaining -= take;
    }

    if (remaining > 0) {
      throw new BadRequestException(
        'Could not restore full quantity from consumable allocations; data may be inconsistent.',
      );
    }
  }

  /**
   * Restore all OUT stock for an invoice consumable line (full release before re-apply or delete).
   */
  async releaseFifoOutForInvoiceItem(
    tx: Prisma.TransactionClient,
    invoiceItemId: string,
    performedById: string,
  ) {
    const outs = await tx.consumableStockAllocation.findMany({
      where: {
        invoiceItemId,
        direction: ConsumableAllocationDirection.OUT,
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

  /**
   * Restore stock from OUT allocations tied to a usage event (non-billable), delete OUT rows.
   */
  async releaseFifoOutForUsageEvent(
    tx: Prisma.TransactionClient,
    usageEventId: string,
    performedById: string,
  ) {
    const outs = await tx.consumableStockAllocation.findMany({
      where: {
        usageEventId,
        direction: ConsumableAllocationDirection.OUT,
      },
      orderBy: { createdAt: 'desc' },
    });

    for (const row of outs) {
      const batch = await tx.consumableBatch.findUniqueOrThrow({
        where: { id: row.batchId },
        select: { consumableId: true, storeLocationId: true },
      });

      await tx.consumableBatch.update({
        where: { id: row.batchId },
        data: { quantityRemaining: { increment: row.quantity } },
      });

      await tx.consumableStockAllocation.create({
        data: {
          id: randomUUID(),
          batchId: row.batchId,
          direction: ConsumableAllocationDirection.IN,
          quantity: row.quantity,
          costPriceSnapshot: row.costPriceSnapshot,
          sellingPriceSnapshot: row.sellingPriceSnapshot,
          usageEventId,
          performedById,
        },
      });

      await tx.consumableMovement.create({
        data: {
          id: randomUUID(),
          batchId: row.batchId,
          consumableId: batch.consumableId,
          movementType: InventoryMovementType.RETURN,
          storeLocationId: batch.storeLocationId,
          quantity: row.quantity,
          referenceType: MovementReferenceType.CONSUMABLE_USAGE_EVENT,
          referenceId: usageEventId,
          performedById,
        },
      });

      await tx.consumableStockAllocation.delete({ where: { id: row.id } });
    }
  }
}
