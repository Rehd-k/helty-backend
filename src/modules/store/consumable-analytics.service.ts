import { Injectable } from '@nestjs/common';
import {
  ConsumableAllocationDirection,
  ConsumableUsageDirection,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ConsumableAnalyticsQueryDto } from './dto/consumable-analytics-query.dto';
import { parseDateRange } from '../../common/utils/date-range';

@Injectable()
export class ConsumableAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(query: ConsumableAnalyticsQueryDto) {
    const { from, to } = parseDateRange(query.fromDate, query.toDate);
    const topLimit = Math.min(Math.max(1, query.topLimit ?? 10), 50);

    const outWhere: Prisma.ConsumableStockAllocationWhereInput = {
      direction: ConsumableAllocationDirection.OUT,
      createdAt: { gte: from, lte: to },
      ...(query.storeLocationId && {
        batch: { storeLocationId: query.storeLocationId },
      }),
    };

    const [outs, usageBySource] = await Promise.all([
      this.prisma.consumableStockAllocation.findMany({
        where: outWhere,
        include: {
          batch: {
            select: {
              consumableId: true,
              storeLocationId: true,
              consumable: { select: { id: true, name: true } },
            },
          },
          invoiceItem: {
            select: {
              id: true,
              quantity: true,
              unitPrice: true,
            },
          },
        },
      }),
      this.prisma.consumableUsageEvent.groupBy({
        by: ['source'],
        where: {
          createdAt: { gte: from, lte: to },
          direction: ConsumableUsageDirection.USE,
        },
        _sum: { quantity: true },
      }),
    ]);

    let revenue = new Prisma.Decimal(0);
    let cogs = new Prisma.Decimal(0);
    let unitsSold = 0;

    const byConsumable = new Map<
      string,
      { name: string; units: number; revenue: Prisma.Decimal; cogs: Prisma.Decimal }
    >();

    for (const row of outs) {
      const qty = row.quantity;
      unitsSold += qty;
      const cost = row.costPriceSnapshot.mul(qty);
      const listRev = row.sellingPriceSnapshot.mul(qty);
      cogs = cogs.add(cost);

      const billRev = row.invoiceItem
        ? row.invoiceItem.unitPrice.mul(qty)
        : listRev;
      revenue = revenue.add(billRev);

      const cid = row.batch.consumableId;
      const cur = byConsumable.get(cid) ?? {
        name: row.batch.consumable.name,
        units: 0,
        revenue: new Prisma.Decimal(0),
        cogs: new Prisma.Decimal(0),
      };
      cur.units += qty;
      cur.revenue = cur.revenue.add(billRev);
      cur.cogs = cur.cogs.add(cost);
      byConsumable.set(cid, cur);
    }

    const margin = revenue.sub(cogs);
    const topByRevenue = [...byConsumable.entries()]
      .map(([consumableId, v]) => ({
        consumableId,
        name: v.name,
        units: v.units,
        revenue: v.revenue.toNumber(),
        cogs: v.cogs.toNumber(),
        margin: v.revenue.sub(v.cogs).toNumber(),
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, topLimit);

    return {
      period: { from, to },
      unitsSold,
      revenue: revenue.toNumber(),
      cogs: cogs.toNumber(),
      margin: margin.toNumber(),
      topByRevenue,
      nonBillableUsageBySource: usageBySource.map((u) => ({
        source: u.source,
        quantity: u._sum.quantity ?? 0,
      })),
    };
  }
}
