import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

type DbClient = Prisma.TransactionClient | PrismaService;

export type DrugWithLatestCost = {
  id: string;
  genericName: string;
  latestCost: Prisma.Decimal | null;
};

/**
 * Load a drug with the most recently entered batch cost (for billing).
 * Dispensing continues to use FIFO sellable batches separately.
 */
export async function loadDrugWithLatestCost(
  tx: DbClient,
  drugId: string,
): Promise<DrugWithLatestCost> {
  const drug = await tx.drug.findUnique({
    where: { id: drugId },
    select: { id: true, genericName: true },
  });
  if (!drug) {
    throw new NotFoundException(`Drug "${drugId}" not found.`);
  }

  const latestBatch = await tx.drugBatch.findFirst({
    where: { drugId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: { costPrice: true },
  });

  return {
    ...drug,
    latestCost: latestBatch?.costPrice ?? null,
  };
}

export function asDrugPricingDecimal(
  value: number | string | Prisma.Decimal,
): Prisma.Decimal {
  return value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value);
}

/**
 * unitPrice = latest batch costPrice × ward multiplier (0 when no cost history).
 */
export function computeDrugUnitPrice(
  drug: DrugWithLatestCost,
  multiplier: Prisma.Decimal,
): Prisma.Decimal {
  const cost = drug.latestCost
    ? asDrugPricingDecimal(drug.latestCost)
    : new Prisma.Decimal(0);
  return cost.mul(multiplier);
}
