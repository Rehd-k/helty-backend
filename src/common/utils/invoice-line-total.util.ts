import { Prisma } from '@prisma/client';

const DAY_MS = 24 * 60 * 60 * 1000;

export type UsageSegmentRow = {
  startAt: Date;
  endAt: Date | null;
};

export type InvoiceLineTotalInput = {
  unitPrice: Prisma.Decimal | number | string;
  quantity: number;
  isRecurringDaily: boolean;
  usageSegments: UsageSegmentRow[];
};

export function asInvoiceDecimal(
  value: number | string | Prisma.Decimal,
): Prisma.Decimal {
  if (value instanceof Prisma.Decimal) return value;
  return new Prisma.Decimal(value);
}

/**
 * Billable day count per usage segment.
 * - Closed segments: ceil(partial 24h periods) so a same-day partial still counts as one day.
 * - Open (active) segments: floor only — avoids charging a full day the instant a segment
 *   starts. Full days accrue after each completed 24h; pausing closes the segment and ceil
 *   applies to that final stretch.
 */
export function computeRecurringDays(
  segments: UsageSegmentRow[],
  now: Date = new Date(),
): number {
  let totalDays = 0;
  for (const segment of segments) {
    const endAt = segment.endAt ?? now;
    const duration = endAt.getTime() - segment.startAt.getTime();
    if (duration <= 0) continue;
    const isOpen = segment.endAt === null;
    const days = isOpen
      ? Math.floor(duration / DAY_MS)
      : Math.ceil(duration / DAY_MS);
    totalDays += days;
  }
  return totalDays;
}

export function invoiceLineTotal(
  item: InvoiceLineTotalInput,
  now: Date = new Date(),
): Prisma.Decimal {
  const unitPrice = asInvoiceDecimal(item.unitPrice);
  if (item.isRecurringDaily) {
    const totalDays = computeRecurringDays(item.usageSegments, now);
    return unitPrice.mul(totalDays);
  }
  return unitPrice.mul(item.quantity);
}

export function formatDecimalAmount(value: Prisma.Decimal | number | string): string {
  return asInvoiceDecimal(value).toFixed(2);
}

export function decimalBalance(
  total: Prisma.Decimal | number | string,
  paid: Prisma.Decimal | number | string,
): Prisma.Decimal {
  const balance = asInvoiceDecimal(total).sub(asInvoiceDecimal(paid));
  return balance.gt(0) ? balance : new Prisma.Decimal(0);
}
