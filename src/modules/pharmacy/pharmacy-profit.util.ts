import { Prisma } from '@prisma/client';
import type { PharmacyPayerType } from './pharmacy-payer-type.util';

export function toNumber(v: Prisma.Decimal | number | null | undefined): number {
  if (v == null) return 0;
  if (v instanceof Prisma.Decimal) return v.toNumber();
  return Number(v) || 0;
}

export function lineSales(quantity: number, unitSellingPrice: Prisma.Decimal | number): number {
  return quantity * toNumber(unitSellingPrice);
}

export function lineCogs(quantity: number, unitCost: Prisma.Decimal | number): number {
  return quantity * toNumber(unitCost);
}

export function lineProfit(sales: number, cogs: number): number {
  return sales - cogs;
}

export function marginPercent(sales: number, profit: number): number {
  if (sales <= 0) return 0;
  return Math.round((profit / sales) * 10000) / 100;
}

export type PharmacyReportDateFilters = {
  fromDate?: string;
  toDate?: string;
  storeId?: string;
  locationId?: string;
  payerType?: PharmacyPayerType;
};

export function allocationWhereFromQuery(
  from: Date,
  to: Date,
  q: PharmacyReportDateFilters,
): Prisma.DispenseBatchAllocationWhereInput {
  const where: Prisma.DispenseBatchAllocationWhereInput = {
    dispensedAt: { gte: from, lte: to },
  };
  if (q.locationId) {
    where.locationId = q.locationId;
  }
  if (q.payerType) {
    where.payerType = q.payerType;
  }
  if (q.storeId) {
    where.batch = { fromLocationId: q.storeId };
  }
  return where;
}

export function dispensedDrugItemWhere(
  from: Date,
  to: Date,
  q: PharmacyReportDateFilters,
): Prisma.InvoiceItemWhereInput {
  return {
    settled: true,
    drugId: { not: null },
    dispensedAt: { not: null, gte: from, lte: to },
    ...(q.locationId ? { dispensaryLocationId: q.locationId } : {}),
  };
}

type Bucket = { label: string; start: Date; end: Date };

export function getChartBuckets(
  from: Date,
  to: Date,
  bucketBy?: 'day' | 'week' | 'month',
): Bucket[] {
  const rangeDays = Math.ceil((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
  const resolved =
    bucketBy ??
    (rangeDays > 90 ? 'month' : rangeDays > 31 ? 'week' : 'day');

  const buckets: Bucket[] = [];
  const cursor = new Date(from);
  cursor.setHours(0, 0, 0, 0);

  while (cursor <= to) {
    const start = new Date(cursor);
    const end = new Date(cursor);

    if (resolved === 'day') {
      end.setHours(23, 59, 59, 999);
      cursor.setDate(cursor.getDate() + 1);
    } else if (resolved === 'week') {
      end.setDate(end.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      cursor.setDate(cursor.getDate() + 7);
    } else {
      end.setMonth(end.getMonth() + 1);
      end.setDate(0);
      end.setHours(23, 59, 59, 999);
      cursor.setMonth(cursor.getMonth() + 1, 1);
    }

    const clampedEnd = end > to ? new Date(to) : end;
    buckets.push({
      label: start.toISOString().slice(0, 10),
      start,
      end: clampedEnd,
    });
  }

  return buckets;
}
