import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { parseDateRange } from '../../common/utils/date-range';
import {
  patientNameFieldsSelect,
  toPatientNameWithLegacyKey,
} from '../../common/utils/patient-display-name.util';
import { PHARMACY_NEAR_EXPIRY_DAYS } from './pharmacy.constants';
import {
  PharmacyInventoryValuationBatchesQueryDto,
  PharmacyInventoryValuationQueryDto,
  PharmacySalesBreakdownDetailsQueryDto,
  PharmacySalesBreakdownQueryDto,
} from './dto/pharmacy-reports-query.dto';
import {
  allocationWhereFromQuery,
  dispensedDrugItemWhere,
  lineCogs,
  lineProfit,
  lineSales,
  marginPercent,
  toNumber,
} from './pharmacy-profit.util';
import {
  getSellableDrugBatchWhere,
  mergeDrugBatchWhere,
} from './pharmacy-sellable-stock.util';

type GroupRow = {
  groupKey: string;
  groupLabel: string;
  quantitySold: number;
  grossSales: number;
  cogs: number;
  grossProfit: number;
  transactionCount: number;
};

@Injectable()
export class PharmacyReportsService {
  constructor(private readonly prisma: PrismaService) {}

  private groupKeyForAllocation(
    row: {
      drugId: string;
      payerType: string | null;
      locationId: string;
      drug: { brandName: string; genericName: string; therapeuticClass: string | null };
      location: { name: string };
    },
    groupBy: string,
  ): { key: string; label: string } {
    switch (groupBy) {
      case 'therapeuticClass':
        return {
          key: row.drug.therapeuticClass ?? 'Uncategorized',
          label: row.drug.therapeuticClass ?? 'Uncategorized',
        };
      case 'payer':
        return {
          key: row.payerType ?? 'Cash',
          label: row.payerType ?? 'Cash',
        };
      case 'dispensary':
        return { key: row.locationId, label: row.location.name };
      case 'drug':
      default:
        return {
          key: row.drugId,
          label: row.drug.brandName || row.drug.genericName,
        };
    }
  }

  async getSalesBreakdown(q: PharmacySalesBreakdownQueryDto) {
    const { from, to } = parseDateRange(q.fromDate, q.toDate);
    const groupBy = q.groupBy ?? 'drug';
    const allocWhere = allocationWhereFromQuery(from, to, q);

    const allocations = await this.prisma.dispenseBatchAllocation.findMany({
      where: allocWhere,
      include: {
        drug: {
          select: {
            brandName: true,
            genericName: true,
            therapeuticClass: true,
          },
        },
        location: { select: { name: true } },
      },
    });

    const grouped = new Map<string, GroupRow>();
    const txnByGroup = new Map<string, Set<string>>();

    for (const row of allocations) {
      const { key, label } = this.groupKeyForAllocation(row, groupBy);
      const sales = lineSales(row.quantity, row.unitSellingPrice);
      const cogs = lineCogs(row.quantity, row.unitCost);
      const cur = grouped.get(key) ?? {
        groupKey: key,
        groupLabel: label,
        quantitySold: 0,
        grossSales: 0,
        cogs: 0,
        grossProfit: 0,
        transactionCount: 0,
      };
      cur.quantitySold += row.quantity;
      cur.grossSales += sales;
      cur.cogs += cogs;
      cur.grossProfit += lineProfit(sales, cogs);
      grouped.set(key, cur);

      const txns = txnByGroup.get(key) ?? new Set<string>();
      txns.add(row.invoiceItemId);
      txnByGroup.set(key, txns);
    }

    const rows = [...grouped.values()]
      .map((r) => ({
        ...r,
        transactionCount: txnByGroup.get(r.groupKey)?.size ?? 0,
        marginPercent: marginPercent(r.grossSales, r.grossProfit),
        percentOfTotalSales: 0,
      }))
      .sort((a, b) => b.grossSales - a.grossSales);

    const totals = rows.reduce(
      (acc, r) => ({
        quantitySold: acc.quantitySold + r.quantitySold,
        grossSales: acc.grossSales + r.grossSales,
        cogs: acc.cogs + r.cogs,
        grossProfit: acc.grossProfit + r.grossProfit,
        transactionCount: acc.transactionCount + r.transactionCount,
      }),
      {
        quantitySold: 0,
        grossSales: 0,
        cogs: 0,
        grossProfit: 0,
        transactionCount: 0,
      },
    );

    const totalSales = totals.grossSales;
    for (const row of rows) {
      row.percentOfTotalSales =
        totalSales > 0
          ? Math.round((row.grossSales / totalSales) * 10000) / 100
          : 0;
    }

    return {
      totals: {
        ...totals,
        marginPercent: marginPercent(totals.grossSales, totals.grossProfit),
      },
      rows,
    };
  }

  private allocationMatchesGroup(
    row: {
      drugId: string;
      payerType: string | null;
      locationId: string;
      drug: { therapeuticClass: string | null };
    },
    groupBy: string,
    groupKey: string,
  ): boolean {
    switch (groupBy) {
      case 'therapeuticClass':
        return (row.drug.therapeuticClass ?? 'Uncategorized') === groupKey;
      case 'payer':
        return (row.payerType ?? 'Cash') === groupKey;
      case 'dispensary':
        return row.locationId === groupKey;
      case 'drug':
      default:
        return row.drugId === groupKey;
    }
  }

  async getSalesBreakdownDetails(q: PharmacySalesBreakdownDetailsQueryDto) {
    const { from, to } = parseDateRange(q.fromDate, q.toDate);
    const groupBy = q.groupBy ?? 'drug';
    const skip = Math.max(0, q.skip ?? 0);
    const take = Math.min(Math.max(1, q.take ?? 50), 100);
    const search = q.q?.trim();

    const allocWhere = allocationWhereFromQuery(from, to, q);
    let allocations = await this.prisma.dispenseBatchAllocation.findMany({
      where: allocWhere,
      include: {
        drug: { select: { brandName: true, genericName: true, therapeuticClass: true } },
        batch: { select: { batchNumber: true } },
        location: { select: { name: true } },
        dispensedBy: { select: { firstName: true, lastName: true } },
        invoiceItem: {
          select: {
            id: true,
            invoice: {
              select: {
                id: true,
                invoiceID: true,
                patient: { select: patientNameFieldsSelect },
              },
            },
          },
        },
      },
      orderBy: { dispensedAt: 'desc' },
    });

    if (q.groupKey) {
      allocations = allocations.filter((row) =>
        this.allocationMatchesGroup(row, groupBy, q.groupKey!),
      );
    }

    const unknownWhere = {
      ...dispensedDrugItemWhere(from, to, q),
      dispenseBatchAllocations: { none: {} },
    };

    let unknownItems = await this.prisma.invoiceItem.findMany({
      where: unknownWhere,
      include: {
        drug: {
          select: {
            id: true,
            brandName: true,
            genericName: true,
            therapeuticClass: true,
          },
        },
        dispensedBy: { select: { firstName: true, lastName: true } },
        dispensaryLocation: { select: { id: true, name: true } },
        invoice: {
          select: {
            id: true,
            invoiceID: true,
            patient: { select: patientNameFieldsSelect },
          },
        },
      },
      orderBy: { dispensedAt: 'desc' },
    });

    if (q.groupKey) {
      unknownItems = unknownItems.filter((item) => {
        switch (groupBy) {
          case 'therapeuticClass':
            return (
              (item.drug?.therapeuticClass ?? 'Uncategorized') === q.groupKey
            );
          case 'payer':
            return false;
          case 'dispensary':
            return item.dispensaryLocationId === q.groupKey;
          case 'drug':
          default:
            return item.drugId === q.groupKey;
        }
      });
    }

    type DetailRow = {
      sortAt: Date;
      row: Record<string, unknown>;
    };

    const merged: DetailRow[] = [];

    for (const row of allocations) {
      const sales = lineSales(row.quantity, row.unitSellingPrice);
      const cogs = lineCogs(row.quantity, row.unitCost);
      const profit = lineProfit(sales, cogs);
      const patient = row.invoiceItem.invoice.patient;
      const detail = {
        dispensedAt: row.dispensedAt.toISOString(),
        drugName: row.drug.brandName || row.drug.genericName,
        batchNumber: row.batch.batchNumber,
        quantity: row.quantity,
        unitSellingPrice: toNumber(row.unitSellingPrice),
        unitCost: toNumber(row.unitCost),
        lineSales: sales,
        lineCogs: cogs,
        lineProfit: profit,
        profitUnknown: false,
        patientName: toPatientNameWithLegacyKey(patient, 'name').name,
        payerType: row.payerType ?? 'Cash',
        dispensaryName: row.location.name,
        dispensedByName: row.dispensedBy
          ? `${row.dispensedBy.firstName ?? ''} ${row.dispensedBy.lastName ?? ''}`.trim()
          : null,
        invoiceId: row.invoiceItem.invoice.id,
      };
      merged.push({ sortAt: row.dispensedAt, row: detail });
    }

    for (const item of unknownItems) {
      const sales = lineSales(item.quantity, item.unitPrice);
      const patient = item.invoice.patient;
      merged.push({
        sortAt: item.dispensedAt!,
        row: {
          dispensedAt: item.dispensedAt!.toISOString(),
          drugName: item.drug?.brandName || item.drug?.genericName || 'Unknown',
          batchNumber: null,
          quantity: item.quantity,
          unitSellingPrice: toNumber(item.unitPrice),
          unitCost: null,
          lineSales: sales,
          lineCogs: null,
          lineProfit: null,
          profitUnknown: true,
          patientName: toPatientNameWithLegacyKey(patient, 'name').name,
          payerType: null,
          dispensaryName: item.dispensaryLocation?.name ?? null,
          dispensedByName: item.dispensedBy
            ? `${item.dispensedBy.firstName ?? ''} ${item.dispensedBy.lastName ?? ''}`.trim()
            : null,
          invoiceId: item.invoice.id,
        },
      });
    }

    merged.sort((a, b) => b.sortAt.getTime() - a.sortAt.getTime());

    let filtered = merged;
    if (search) {
      const lower = search.toLowerCase();
      filtered = merged.filter(({ row }) => {
        const text = [
          row.drugName,
          row.batchNumber,
          row.patientName,
          row.invoiceId,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return text.includes(lower);
      });
    }

    const total = filtered.length;
    const page = filtered.slice(skip, skip + take);

    return {
      total,
      rows: page.map((x) => x.row),
    };
  }

  private expiryFilter(
    expiryWithinDays?: number,
  ): Prisma.DrugBatchWhereInput | undefined {
    const now = new Date();
    if (expiryWithinDays === undefined) return undefined;
    if (expiryWithinDays === 0) {
      return { expiryDate: { lt: now } };
    }
    const end = new Date(now);
    end.setDate(end.getDate() + expiryWithinDays);
    return { expiryDate: { gte: now, lte: end } };
  }

  async getInventoryValuation(q: PharmacyInventoryValuationQueryDto) {
    const now = new Date();
    const nearExpiryDate = new Date(now);
    nearExpiryDate.setDate(
      now.getDate() + (q.expiryWithinDays ?? PHARMACY_NEAR_EXPIRY_DAYS),
    );

    const sellable = await getSellableDrugBatchWhere(this.prisma);
    const baseWhere = mergeDrugBatchWhere(
      sellable,
      q.storeId ? { toLocationId: q.storeId } : {},
      { quantityRemaining: { gt: 0 } },
    );

    const batches = await this.prisma.drugBatch.findMany({
      where: baseWhere,
      include: {
        toLocation: { select: { id: true, name: true, locationType: true } },
      },
    });

    type StoreAgg = {
      locationId: string;
      locationName: string;
      locationType: string;
      batchCount: number;
      totalQuantity: number;
      valueAtCost: number;
      valueAtSellingPrice: number;
      nearExpiryValueAtCost: number;
    };

    const byLocation = new Map<string, StoreAgg>();

    let batchCount = 0;
    let totalQuantity = 0;
    let valueAtCost = 0;
    let valueAtSellingPrice = 0;
    let nearExpiryValueAtCost = 0;

    for (const batch of batches) {
      const qty = batch.quantityRemaining;
      const cost = qty * toNumber(batch.costPrice);
      const selling = qty * toNumber(batch.sellingPrice);
      const loc = batch.toLocation;

      batchCount += 1;
      totalQuantity += qty;
      valueAtCost += cost;
      valueAtSellingPrice += selling;

      const isNearExpiry =
        batch.expiryDate >= now && batch.expiryDate <= nearExpiryDate;
      if (isNearExpiry) {
        nearExpiryValueAtCost += cost;
      }

      const cur = byLocation.get(loc.id) ?? {
        locationId: loc.id,
        locationName: loc.name,
        locationType: loc.locationType,
        batchCount: 0,
        totalQuantity: 0,
        valueAtCost: 0,
        valueAtSellingPrice: 0,
        nearExpiryValueAtCost: 0,
      };
      cur.batchCount += 1;
      cur.totalQuantity += qty;
      cur.valueAtCost += cost;
      cur.valueAtSellingPrice += selling;
      if (isNearExpiry) cur.nearExpiryValueAtCost += cost;
      byLocation.set(loc.id, cur);
    }

    return {
      totals: {
        batchCount,
        totalQuantity,
        valueAtCost,
        valueAtSellingPrice,
        nearExpiryValueAtCost,
      },
      stores: [...byLocation.values()].sort(
        (a, b) => b.valueAtCost - a.valueAtCost,
      ),
    };
  }

  async getInventoryValuationBatches(
    q: PharmacyInventoryValuationBatchesQueryDto,
  ) {
    const skip = Math.max(0, q.skip ?? 0);
    const take = Math.min(Math.max(1, q.take ?? 50), 100);
    const search = q.q?.trim();
    const sellable =
      q.expiryWithinDays === 0
        ? {}
        : await getSellableDrugBatchWhere(this.prisma);
    const where = mergeDrugBatchWhere(
      sellable,
      { quantityRemaining: { gt: 0 } },
      q.storeId ? { toLocationId: q.storeId } : {},
      q.locationId ? { toLocationId: q.locationId } : {},
      this.expiryFilter(q.expiryWithinDays) ?? {},
    );

    if (search) {
      where.OR = [
        { batchNumber: { contains: search, mode: 'insensitive' } },
        {
          drug: {
            OR: [
              { brandName: { contains: search, mode: 'insensitive' } },
              { genericName: { contains: search, mode: 'insensitive' } },
            ],
          },
        },
      ];
    }

    const [rows, total] = await Promise.all([
      this.prisma.drugBatch.findMany({
        where,
        skip,
        take,
        orderBy: [{ expiryDate: 'asc' }, { drug: { brandName: 'asc' } }],
        include: {
          drug: { select: { id: true, brandName: true, genericName: true } },
          toLocation: { select: { name: true } },
          supplier: { select: { name: true } },
        },
      }),
      this.prisma.drugBatch.count({ where }),
    ]);

    return {
      total,
      rows: rows.map((batch) => {
        const qty = batch.quantityRemaining;
        const unitCost = toNumber(batch.costPrice);
        const unitSelling = toNumber(batch.sellingPrice);
        return {
          batchId: batch.id,
          drugId: batch.drugId,
          drugName: batch.drug.brandName || batch.drug.genericName,
          batchNumber: batch.batchNumber,
          expiryDate: batch.expiryDate.toISOString(),
          quantityRemaining: qty,
          unitCost,
          unitSellingPrice: unitSelling,
          lineValueAtCost: qty * unitCost,
          lineValueAtSelling: qty * unitSelling,
          locationName: batch.toLocation.name,
          supplierName: batch.supplier?.name ?? null,
        };
      }),
    };
  }
}
