import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  getSellableDrugBatchWhere,
  mergeDrugBatchWhere,
} from './pharmacy-sellable-stock.util';

type DbClient = Prisma.TransactionClient | PrismaService;

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

  /**
   * Reduce quantityRemaining across batches (earliest manufacturingDate, then createdAt),
   * skipping batches with zero remaining until enough units are taken.
   */
  async deductDrugStockFifo(
    tx: Prisma.TransactionClient,
    drugId: string,
    quantityToDeduct: number,
    locationId?: string,
  ) {
    if (quantityToDeduct <= 0) return;

    const sellableWhere = await getSellableDrugBatchWhere(tx);
    const batches = await tx.drugBatch.findMany({
      where: mergeDrugBatchWhere(sellableWhere, {
        drugId,
        quantityRemaining: { gt: 0 },
        ...(locationId ? { toLocationId: locationId } : {}),
      }),
      orderBy: [{ manufacturingDate: 'asc' }, { createdAt: 'asc' }],
    });

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
