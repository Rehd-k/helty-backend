import { BadRequestException, Injectable } from '@nestjs/common';
import {
  InventoryMovementType,
  MovementReferenceType,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  getSellableDrugBatchWhere,
  mergeDrugBatchWhere,
} from './pharmacy-sellable-stock.util';

type DbClient = Prisma.TransactionClient | PrismaService;

export type DrugDispenseFifoContext = {
  invoiceItemId: string;
  unitSellingPrice: Prisma.Decimal;
  payerType?: string;
  dispensedById: string;
  dispensedAt: Date;
  dispensationId?: string;
};

@Injectable()
export class DrugStockService {
  /**
   * Sum sellable batch quantity for a drug at an optional location.
   */
  async getAvailableQuantity(
    tx: DbClient,
    drugId: string,
    locationId: string,
  ): Promise<number> {
    const sellableWhere = await getSellableDrugBatchWhere(tx);
    const batches = await tx.drugBatch.findMany({
      where: mergeDrugBatchWhere(sellableWhere, {
        drugId,
        quantityRemaining: { gt: 0 },
        toLocationId: locationId,
      }),
      select: { quantityRemaining: true },
    });
    return batches.reduce((sum, b) => sum + b.quantityRemaining, 0);
  }

  private async loadFifoBatches(
    tx: Prisma.TransactionClient,
    drugId: string,
    locationId?: string,
  ) {
    const sellableWhere = await getSellableDrugBatchWhere(tx);
    const batches = await tx.drugBatch.findMany({
      where: mergeDrugBatchWhere(sellableWhere, {
        drugId,
        quantityRemaining: { gt: 0 },
        ...(locationId ? { toLocationId: locationId } : {}),
      }),
      orderBy: [{ expiryDate: 'asc' }, { manufacturingDate: 'asc' }],
    });
    return batches;
  }

  /**
   * FIFO dispense: decrement batches, snapshot cost onto DispenseBatchAllocation,
   * and write DISPENSE inventory movements.
   */
  async applyFifoOut(
    tx: Prisma.TransactionClient,
    params: {
      drugId: string;
      locationId: string;
      quantity: number;
      ctx: DrugDispenseFifoContext;
    },
  ) {
    const { drugId, locationId, quantity, ctx } = params;
    if (quantity <= 0) return;

    const batches = await this.loadFifoBatches(tx, drugId, locationId);
    const totalAvailable = batches.reduce(
      (sum, b) => sum + b.quantityRemaining,
      0,
    );
    if (totalAvailable < quantity) {
      throw new BadRequestException(
        `Insufficient stock for this drug: need ${quantity} unit(s), ` +
          `${totalAvailable} available across batches.`,
      );
    }

    let remaining = quantity;
    for (const batch of batches) {
      if (remaining <= 0) break;
      const fresh = await tx.drugBatch.findUnique({ where: { id: batch.id } });
      if (!fresh || fresh.quantityRemaining <= 0) continue;
      const take = Math.min(fresh.quantityRemaining, remaining);
      if (take <= 0) continue;

      await tx.drugBatch.update({
        where: { id: batch.id },
        data: { quantityRemaining: fresh.quantityRemaining - take },
      });

      await tx.dispenseBatchAllocation.create({
        data: {
          invoiceItemId: ctx.invoiceItemId,
          dispensationId: ctx.dispensationId ?? null,
          drugId,
          batchId: batch.id,
          locationId,
          quantity: take,
          unitCost: fresh.costPrice,
          unitSellingPrice: ctx.unitSellingPrice,
          payerType: ctx.payerType ?? null,
          dispensedById: ctx.dispensedById,
          dispensedAt: ctx.dispensedAt,
        },
      });

      await tx.inventoryMovement.create({
        data: {
          batchId: batch.id,
          drugId,
          fromLocationId: locationId,
          toLocationId: locationId,
          movementType: InventoryMovementType.DISPENSE,
          quantity: take,
          referenceType: MovementReferenceType.INVOICE_ITEM,
          referenceId: ctx.invoiceItemId,
          performedById: ctx.dispensedById,
        },
      });

      remaining -= take;
    }
  }

  /**
   * Restore stock from dispense allocations (LIFO) for returns/reversals.
   */
  async releaseDispenseAllocationsForInvoiceItem(
    tx: Prisma.TransactionClient,
    invoiceItemId: string,
    quantity: number,
    performedById: string,
  ) {
    if (quantity <= 0) return;
    let remaining = quantity;
    const allocations = await tx.dispenseBatchAllocation.findMany({
      where: { invoiceItemId },
      orderBy: { createdAt: 'desc' },
    });

    for (const row of allocations) {
      if (remaining <= 0) break;
      const take = Math.min(row.quantity, remaining);
      if (take <= 0) continue;

      await tx.drugBatch.update({
        where: { id: row.batchId },
        data: { quantityRemaining: { increment: take } },
      });

      await tx.inventoryMovement.create({
        data: {
          batchId: row.batchId,
          drugId: row.drugId,
          fromLocationId: row.locationId,
          toLocationId: row.locationId,
          movementType: InventoryMovementType.RETURN,
          quantity: take,
          referenceType: MovementReferenceType.INVOICE_ITEM,
          referenceId: invoiceItemId,
          performedById,
        },
      });

      if (take === row.quantity) {
        await tx.dispenseBatchAllocation.delete({ where: { id: row.id } });
      } else {
        await tx.dispenseBatchAllocation.update({
          where: { id: row.id },
          data: { quantity: row.quantity - take },
        });
      }

      remaining -= take;
    }

    if (remaining > 0 && allocations.length > 0) {
      throw new BadRequestException(
        'Could not restore full quantity from dispense allocations; data may be inconsistent.',
      );
    }
  }

  /**
   * @deprecated Use applyFifoOut when invoice context is available.
   */
  async deductDrugStockFifo(
    tx: Prisma.TransactionClient,
    drugId: string,
    quantityToDeduct: number,
    locationId?: string,
  ) {
    if (quantityToDeduct <= 0) return;

    const batches = await this.loadFifoBatches(tx, drugId, locationId);
    const totalAvailable = batches.reduce(
      (sum, b) => sum + b.quantityRemaining,
      0,
    );
    if (totalAvailable < quantityToDeduct) {
      throw new BadRequestException(
        `Insufficient stock for this drug: need ${quantityToDeduct} unit(s), ` +
          `${totalAvailable} available across batches.`,
      );
    }

    let remaining = quantityToDeduct;
    for (const batch of batches) {
      if (remaining <= 0) break;
      const take = Math.min(batch.quantityRemaining, remaining);
      if (take <= 0) continue;
      await tx.drugBatch.update({
        where: { id: batch.id },
        data: { quantityRemaining: batch.quantityRemaining - take },
      });
      remaining -= take;
    }
  }
}
