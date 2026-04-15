import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export const EXCLUDED_STOCK_LOCATION_NAMES = ['sold stock', 'damaged stock'] as const;

type DbClient = Prisma.TransactionClient | PrismaService;

export function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function getExcludedStockLocationIds(
  client: DbClient,
): Promise<string[]> {
  const rows = await client.pharmacyLocation.findMany({
    where: {
      OR: EXCLUDED_STOCK_LOCATION_NAMES.map((name) => ({
        name: { equals: name, mode: 'insensitive' as const },
      })),
    },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

/** Batches that count toward sellable quantity (FIFO, stock displays). */
export function sellableDrugBatchWhereInput(
  excludedToLocationIds: string[],
  startOfDay: Date,
): Prisma.DrugBatchWhereInput {
  return {
    quantityRemaining: { gt: 0 },
    expiryDate: { gte: startOfDay },
    ...(excludedToLocationIds.length > 0
      ? { toLocationId: { notIn: excludedToLocationIds } }
      : {}),
  };
}

/**
 * Batches included in per-drug sums where zero-qty rows still matter for
 * out-of-stock detection (same expiry/location rules as sellable).
 */
export function eligibleDrugBatchWhereInput(
  excludedToLocationIds: string[],
  startOfDay: Date,
): Prisma.DrugBatchWhereInput {
  return {
    quantityRemaining: { gte: 0 },
    expiryDate: { gte: startOfDay },
    ...(excludedToLocationIds.length > 0
      ? { toLocationId: { notIn: excludedToLocationIds } }
      : {}),
  };
}

export async function getSellableDrugBatchWhere(
  client: DbClient,
): Promise<Prisma.DrugBatchWhereInput> {
  const excluded = await getExcludedStockLocationIds(client);
  return sellableDrugBatchWhereInput(excluded, startOfToday());
}

export async function getEligibleDrugBatchWhere(
  client: DbClient,
): Promise<Prisma.DrugBatchWhereInput> {
  const excluded = await getExcludedStockLocationIds(client);
  return eligibleDrugBatchWhereInput(excluded, startOfToday());
}

export function mergeDrugBatchWhere(
  ...parts: Prisma.DrugBatchWhereInput[]
): Prisma.DrugBatchWhereInput {
  const filtered = parts.filter(
    (p) => p && Object.keys(p).length > 0,
  ) as Prisma.DrugBatchWhereInput[];
  if (filtered.length === 0) return {};
  if (filtered.length === 1) return filtered[0];
  return { AND: filtered };
}
