import { Injectable } from '@nestjs/common';
import { InventoryMovementType } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import type { CmacPeriodContext, NamedCount, SeriesPoint } from '../cmac-analytics.types';
import { ANTIBIOTIC_ATC_PREFIX, buildKpi, inRange } from '../cmac-analytics.helpers';
import { getRevenueSeriesBuckets } from '../../billing-analytics/billing-analytics-period';
import type { AnalyticsPeriod } from '../../billing-analytics/billing-analytics-period';
import { seriesForPeriod } from '../cmac-analytics.helpers';

@Injectable()
export class CmacPharmacyService {
  constructor(private readonly prisma: PrismaService) {}

  async getReport(ctx: CmacPeriodContext, limit = 10) {
    const range = inRange(ctx, 'current');
    const prevRange = inRange(ctx, 'previous');

    const [
      stockouts,
      lowStock,
      expiredBatches,
      wastedCur,
      wastedPrev,
      abxCur,
      abxPrev,
      topPrescribed,
      antibioticSeries,
    ] = await Promise.all([
      this.countStockouts(),
      this.countLowStock(),
      this.countExpiredBatches(),
      this.expiryWriteoffValue(range),
      this.expiryWriteoffValue(prevRange),
      this.antibioticDispenseUnits(range),
      this.antibioticDispenseUnits(prevRange),
      this.topPrescribed(limit),
      this.antibioticTrendSeries(ctx),
    ]);

    return {
      period: ctx.period,
      asOf: ctx.asOf.toISOString(),
      kpis: [
        buildKpi('stockouts', 'Drugs at stockout', stockouts, stockouts, {
          positiveWhenUp: false,
        }),
        buildKpi('lowStock', 'Low stock items', lowStock, lowStock, {
          positiveWhenUp: false,
        }),
        buildKpi('expiredBatches', 'Expired batches', expiredBatches, expiredBatches, {
          positiveWhenUp: false,
        }),
        buildKpi(
          'antibioticUnits',
          'Antibiotic units dispensed',
          abxCur,
          abxPrev,
          { positiveWhenUp: false },
        ),
        buildKpi(
          'wastedValue',
          'Expired / wasted (write-off qty)',
          wastedCur,
          wastedPrev,
          { positiveWhenUp: false },
        ),
      ],
      topPrescribed,
      antibioticTrend: antibioticSeries,
    };
  }

  private async countStockouts() {
    const drugs = await this.prisma.drug.findMany({
      where: { reorderLevel: { gt: 0 } },
      select: { id: true, reorderLevel: true },
    });
    let n = 0;
    for (const d of drugs) {
      const agg = await this.prisma.drugBatch.aggregate({
        where: { drugId: d.id, quantityRemaining: { gt: 0 } },
        _sum: { quantityRemaining: true },
      });
      const total = agg._sum.quantityRemaining ?? 0;
      if (total <= (d.reorderLevel ?? 0)) n += 1;
    }
    return n;
  }

  private async countLowStock() {
    const drugs = await this.prisma.drug.findMany({
      where: { reorderLevel: { gt: 0 } },
      select: { id: true, reorderLevel: true },
    });
    let n = 0;
    for (const d of drugs) {
      const agg = await this.prisma.drugBatch.aggregate({
        where: { drugId: d.id, quantityRemaining: { gt: 0 } },
        _sum: { quantityRemaining: true },
      });
      const total = agg._sum.quantityRemaining ?? 0;
      const level = d.reorderLevel ?? 0;
      if (total > 0 && total <= level * 1.5) n += 1;
    }
    return n;
  }

  private async countExpiredBatches() {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return this.prisma.drugBatch.count({
      where: { expiryDate: { lt: start }, quantityRemaining: { gt: 0 } },
    });
  }

  private async expiryWriteoffValue(range: { gte: Date; lte: Date }) {
    const rows = await this.prisma.inventoryMovement.aggregate({
      where: {
        movementType: InventoryMovementType.EXPIRY_WRITEOFF,
        createdAt: range,
      },
      _sum: { quantity: true },
    });
    return Math.abs(rows._sum.quantity ?? 0);
  }

  private async antibioticDispenseUnits(range: { gte: Date; lte: Date }) {
    const rows = await this.prisma.inventoryMovement.findMany({
      where: {
        movementType: InventoryMovementType.DISPENSE,
        createdAt: range,
        drug: { atcCode: { startsWith: ANTIBIOTIC_ATC_PREFIX } },
      },
      select: { quantity: true },
    });
    return rows.reduce((s, r) => s + Math.abs(r.quantity), 0);
  }

  private async topPrescribed(limit: number): Promise<NamedCount[]> {
    const items = await this.prisma.prescriptionItem.groupBy({
      by: ['drugId'],
      where: { drugId: { not: null } },
      _sum: { quantityPrescribed: true },
      orderBy: { _sum: { quantityPrescribed: 'desc' } },
      take: limit,
    });
    const drugIds = items.map((i) => i.drugId!).filter(Boolean);
    const drugs = await this.prisma.drug.findMany({
      where: { id: { in: drugIds } },
      select: { id: true, genericName: true, brandName: true },
    });
    const names = new Map(
      drugs.map((d) => [d.id, d.brandName || d.genericName]),
    );
    return items.map((i) => ({
      name: names.get(i.drugId!) ?? i.drugId!,
      count: i._sum.quantityPrescribed ?? 0,
    }));
  }

  private async antibioticTrendSeries(
    ctx: CmacPeriodContext,
  ): Promise<SeriesPoint[]> {
    const buckets = getRevenueSeriesBuckets(
      ctx.period as AnalyticsPeriod,
      ctx.asOf,
    );
    const values: number[] = [];
    for (const b of buckets) {
      values.push(
        await this.antibioticDispenseUnits({ gte: b.start, lte: b.end }),
      );
    }
    return seriesForPeriod(ctx.period as AnalyticsPeriod, ctx.asOf, values);
  }
}
