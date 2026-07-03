import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { parseDateRange } from '../../common/utils/date-range';
import {
  PHARMACY_NEAR_EXPIRY_DAYS,
} from './pharmacy.constants';
import {
  PharmacyHeadSummaryQueryDto,
  PharmacySalesProfitChartQueryDto,
} from './dto/pharmacy-reports-query.dto';
import {
  allocationWhereFromQuery,
  dispensedDrugItemWhere,
  getChartBuckets,
  lineCogs,
  lineProfit,
  lineSales,
  marginPercent,
  toNumber,
} from './pharmacy-profit.util';
import {
  getEligibleDrugBatchWhere,
  getSellableDrugBatchWhere,
  mergeDrugBatchWhere,
} from './pharmacy-sellable-stock.util';

@Injectable()
export class PharmacyHeadDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  private storeBatchWhere(storeId?: string): Prisma.DrugBatchWhereInput {
    return storeId ? { toLocationId: storeId } : {};
  }

  private async inventoryKpis(storeId?: string) {
    const now = new Date();
    const nearExpiryDate = new Date(now);
    nearExpiryDate.setDate(now.getDate() + PHARMACY_NEAR_EXPIRY_DAYS);

    const eligible = await getEligibleDrugBatchWhere(this.prisma);
    const sellable = await getSellableDrugBatchWhere(this.prisma);
    const storeWhere = this.storeBatchWhere(storeId);

    const drugStocks = await this.prisma.drugBatch.groupBy({
      by: ['drugId'],
      where: mergeDrugBatchWhere(eligible, storeWhere),
      _sum: { quantityRemaining: true },
    });
    const reorderDrugs = await this.prisma.drug.findMany({
      where: { id: { in: drugStocks.map((s) => s.drugId) }, deletedAt: null },
      select: { id: true, reorderLevel: true },
    });
    const reorderMap = new Map(reorderDrugs.map((d) => [d.id, d.reorderLevel]));

    let lowStockCount = 0;
    let outOfStockCount = 0;
    for (const s of drugStocks) {
      const qty = s._sum.quantityRemaining ?? 0;
      const reorderLevel = reorderMap.get(s.drugId) ?? 0;
      if (qty <= 0) outOfStockCount += 1;
      if (qty > 0 && qty <= reorderLevel) lowStockCount += 1;
    }

    const [nearExpiryBatches, expiredBatches, inventoryBatches] =
      await Promise.all([
        this.prisma.drugBatch.findMany({
          where: mergeDrugBatchWhere(storeWhere, {
            quantityRemaining: { gt: 0 },
            expiryDate: { gte: now, lte: nearExpiryDate },
          }),
          select: { quantityRemaining: true, costPrice: true },
        }),
        this.prisma.drugBatch.findMany({
          where: mergeDrugBatchWhere(storeWhere, {
            quantityRemaining: { gt: 0 },
            expiryDate: { lt: now },
          }),
          select: { quantityRemaining: true, costPrice: true },
        }),
        this.prisma.drugBatch.findMany({
          where: mergeDrugBatchWhere(sellable, storeWhere),
          select: {
            quantityRemaining: true,
            costPrice: true,
            sellingPrice: true,
          },
        }),
      ]);

    const inventoryValueAtCost = inventoryBatches.reduce(
      (sum, row) => sum + row.quantityRemaining * toNumber(row.costPrice),
      0,
    );
    const inventoryValueAtSellingPrice = inventoryBatches.reduce(
      (sum, row) => sum + row.quantityRemaining * toNumber(row.sellingPrice),
      0,
    );
    const nearExpiryValueAtCost = nearExpiryBatches.reduce(
      (sum, row) => sum + row.quantityRemaining * toNumber(row.costPrice),
      0,
    );
    const expiredValueAtCost = expiredBatches.reduce(
      (sum, row) => sum + row.quantityRemaining * toNumber(row.costPrice),
      0,
    );

    return {
      inventoryValueAtCost,
      inventoryValueAtSellingPrice,
      nearExpiryValueAtCost,
      expiredValueAtCost,
      lowStockCount,
      outOfStockCount,
    };
  }

  async getHeadSummary(q: PharmacyHeadSummaryQueryDto) {
    const { from, to } = parseDateRange(q.fromDate, q.toDate);
    const allocWhere = allocationWhereFromQuery(from, to, q);
    const itemWhere = dispensedDrugItemWhere(from, to, q);

    const [allocations, netCollectionsAgg, profitUnknownCount, inventory] =
      await Promise.all([
        this.prisma.dispenseBatchAllocation.findMany({
          where: allocWhere,
          select: {
            quantity: true,
            unitCost: true,
            unitSellingPrice: true,
            invoiceItemId: true,
          },
        }),
        this.prisma.invoiceItem.aggregate({
          where: itemWhere,
          _sum: { amountPaid: true },
        }),
        this.prisma.invoiceItem.count({
          where: {
            ...itemWhere,
            dispenseBatchAllocations: { none: {} },
          },
        }),
        this.inventoryKpis(q.storeId),
      ]);

    let totalSales = 0;
    let totalCogs = 0;
    let totalQuantitySold = 0;
    const txnIds = new Set<string>();

    for (const row of allocations) {
      const sales = lineSales(row.quantity, row.unitSellingPrice);
      const cogs = lineCogs(row.quantity, row.unitCost);
      totalSales += sales;
      totalCogs += cogs;
      totalQuantitySold += row.quantity;
      txnIds.add(row.invoiceItemId);
    }

    const grossProfit = lineProfit(totalSales, totalCogs);
    const transactionCount = txnIds.size;
    const netCollections = toNumber(netCollectionsAgg._sum.amountPaid);

    return {
      totalSales,
      totalQuantitySold,
      totalCogs,
      grossProfit,
      grossMarginPercent: marginPercent(totalSales, grossProfit),
      netCollections,
      transactionCount,
      avgSellingPrice:
        totalQuantitySold > 0 ? totalSales / totalQuantitySold : 0,
      avgProfitPerTransaction:
        transactionCount > 0 ? grossProfit / transactionCount : 0,
      profitUnknownCount,
      ...inventory,
    };
  }

  async getSalesProfitChart(q: PharmacySalesProfitChartQueryDto) {
    const { from, to } = parseDateRange(q.fromDate, q.toDate);
    const buckets = getChartBuckets(from, to, q.bucketBy);
    const allocWhere = allocationWhereFromQuery(from, to, q);

    const allocations = await this.prisma.dispenseBatchAllocation.findMany({
      where: allocWhere,
      select: {
        quantity: true,
        unitCost: true,
        unitSellingPrice: true,
        dispensedAt: true,
      },
    });

    return buckets.map((b) => {
      let grossSales = 0;
      let cogs = 0;
      let quantitySold = 0;
      for (const row of allocations) {
        if (row.dispensedAt < b.start || row.dispensedAt > b.end) continue;
        grossSales += lineSales(row.quantity, row.unitSellingPrice);
        cogs += lineCogs(row.quantity, row.unitCost);
        quantitySold += row.quantity;
      }
      return {
        label: b.label,
        grossSales,
        cogs,
        grossProfit: lineProfit(grossSales, cogs),
        quantitySold,
      };
    });
  }
}
