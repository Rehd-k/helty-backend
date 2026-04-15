import { Injectable } from '@nestjs/common';
import {
  AlertSeverity,
  DispensationStatus,
  InventoryMovementType,
  InvoicePaymentSource,
  PrescriptionStatus,
  Prisma,
  PurchaseOrderStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { parseDateRange } from '../../common/utils/date-range';
import {
  PharmacyDashboardChartQueryDto,
  PharmacyDashboardQueryDto,
  PharmacyDrugUsageChartQueryDto,
} from './dto/pharmacy-dashboard-query.dto';
import {
  getEligibleDrugBatchWhere,
  getExcludedStockLocationIds,
  getSellableDrugBatchWhere,
  mergeDrugBatchWhere,
} from './pharmacy-sellable-stock.util';

type Bucket = { label: string; start: Date; end: Date };

function toNumber(v: Prisma.Decimal | number | null | undefined): number {
  if (v == null) return 0;
  if (v instanceof Prisma.Decimal) return v.toNumber();
  return Number(v) || 0;
}

function parseDrugIds(input?: string): string[] {
  if (!input) return [];
  return input
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

@Injectable()
export class PharmacyDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  private getDateWindow(q: PharmacyDashboardQueryDto) {
    return parseDateRange(q.fromDate, q.toDate);
  }

  private storeDrugBatchWhere(
    q: PharmacyDashboardQueryDto,
  ): Prisma.DrugBatchWhereInput {
    return q.storeId ? { toLocationId: q.storeId } : {};
  }

  private getBuckets(
    from: Date,
    to: Date,
    bucketBy: 'day' | 'week' | 'month' = 'day',
  ): Bucket[] {
    const buckets: Bucket[] = [];
    const cursor = new Date(from);
    cursor.setHours(0, 0, 0, 0);

    while (cursor <= to) {
      const start = new Date(cursor);
      const end = new Date(cursor);

      if (bucketBy === 'day') {
        end.setHours(23, 59, 59, 999);
        cursor.setDate(cursor.getDate() + 1);
      } else if (bucketBy === 'week') {
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

  private movementWhere(
    from: Date,
    to: Date,
    q: PharmacyDashboardQueryDto,
  ): Prisma.InventoryMovementWhereInput {
    return {
      createdAt: { gte: from, lte: to },
      ...(q.storeId ? { toLocationId: q.storeId } : {}),
      ...(q.drugId ? { drugId: q.drugId } : {}),
    };
  }

  async getSummary(q: PharmacyDashboardQueryDto) {
    const { from, to } = this.getDateWindow(q);
    const now = new Date();
    const nearExpiryDate = new Date(now);
    nearExpiryDate.setDate(now.getDate() + 90);

    const [prescriptionsProcessed, pendingOrders, dispensedOrders, revenueAgg] =
      await Promise.all([
        this.prisma.prescription.count({
          where: {},
        }),
        this.prisma.prescription.count({
          where: {
            status: {
              in: [
                PrescriptionStatus.PENDING,
                PrescriptionStatus.PARTIALLY_DISPENSED,
              ],
            },
          },
        }),
        this.prisma.dispensation.count({
          where: {
            createdAt: { gte: from, lte: to },
            status: DispensationStatus.COMPLETED,
            ...(q.storeId ? { locationId: q.storeId } : {}),
            ...(q.pharmacistId ? { pharmacistId: q.pharmacistId } : {}),
          },
        }),
        this.prisma.invoiceItem.aggregate({
          where: {
            invoice: { createdAt: { gte: from, lte: to } },
            drugId: { not: null },
          },
          _sum: { amountPaid: true },
        }),
      ]);

    const eligible = await getEligibleDrugBatchWhere(this.prisma);
    const sellable = await getSellableDrugBatchWhere(this.prisma);
    const excludedIds = await getExcludedStockLocationIds(this.prisma);

    const drugStocks = await this.prisma.drugBatch.groupBy({
      by: ['drugId'],
      where: mergeDrugBatchWhere(eligible, this.storeDrugBatchWhere(q)),
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

    const locationExclude: Prisma.DrugBatchWhereInput =
      excludedIds.length > 0
        ? { toLocationId: { notIn: excludedIds } }
        : {};

    const [nearExpiryCount, expiredCount, inventoryBatches] = await Promise.all([
      this.prisma.drugBatch.count({
        where: mergeDrugBatchWhere(
          locationExclude,
          {
            quantityRemaining: { gt: 0 },
            expiryDate: { gte: now, lte: nearExpiryDate },
          },
          this.storeDrugBatchWhere(q),
        ),
      }),
      this.prisma.drugBatch.count({
        where: mergeDrugBatchWhere(
          locationExclude,
          {
            quantityRemaining: { gt: 0 },
            expiryDate: { lt: now },
          },
          this.storeDrugBatchWhere(q),
        ),
      }),
      this.prisma.drugBatch.findMany({
        where: mergeDrugBatchWhere(sellable, this.storeDrugBatchWhere(q)),
        select: { quantityRemaining: true, costPrice: true },
      }),
    ]);

    const inventoryValue = inventoryBatches.reduce(
      (sum, row) => sum + row.quantityRemaining * toNumber(row.costPrice),
      0,
    );

    return {
      prescriptionsProcessed,
      pendingOrders,
      dispensedOrders,
      revenue: toNumber(revenueAgg._sum.amountPaid),
      inventoryValue,
      lowStockCount,
      outOfStockCount,
      nearExpiryCount,
      expiredCount,
      window: { from: from.toISOString(), to: to.toISOString() },
    };
  }

  async getOrdersStatus(q: PharmacyDashboardQueryDto) {
    const { from, to } = this.getDateWindow(q);
    const statuses = await this.prisma.prescription.groupBy({
      by: ['status'],
      where: {},
      _count: { id: true },
    });
    const total = statuses.reduce((sum, row) => sum + (row._count.id ?? 0), 0);
    return {
      total,
      breakdown: statuses.map((row) => ({
        status: row.status,
        count: row._count.id ?? 0,
        percentage: total
          ? Number((((row._count.id ?? 0) / total) * 100).toFixed(2))
          : 0,
      })),
    };
  }

  async getTopSelling(q: PharmacyDashboardQueryDto) {
    const { from, to } = this.getDateWindow(q);
    const take = Math.min(Math.max(1, q.take ?? 20), 100);
    const rows = await this.prisma.dispensationItem.groupBy({
      by: ['prescriptionItemId'],
      where: {
        dispensation: {
          createdAt: { gte: from, lte: to },
          status: DispensationStatus.COMPLETED,
          ...(q.storeId ? { locationId: q.storeId } : {}),
        },
      },
      _sum: { quantityDispensed: true },
    });

    const prescriptionItemIds = rows.map((r) => r.prescriptionItemId);
    const items = prescriptionItemIds.length
      ? await this.prisma.prescriptionItem.findMany({
          where: { id: { in: prescriptionItemIds }, drugId: { not: null } },
          select: { id: true, drugId: true, drug: { select: { brandName: true, genericName: true } } },
        })
      : [];
    const itemMap = new Map(items.map((i) => [i.id, i]));
    const qtyByDrug = new Map<string, number>();
    for (const row of rows) {
      const item = itemMap.get(row.prescriptionItemId);
      if (!item?.drugId) continue;
      qtyByDrug.set(
        item.drugId,
        (qtyByDrug.get(item.drugId) ?? 0) + (row._sum.quantityDispensed ?? 0),
      );
    }

    const drugIds = [...qtyByDrug.keys()];
    const sellableTop = await getSellableDrugBatchWhere(this.prisma);
    const [stockRows, revenueRows] = await Promise.all([
      drugIds.length
        ? this.prisma.drugBatch.groupBy({
            by: ['drugId'],
            where: mergeDrugBatchWhere(sellableTop, {
              drugId: { in: drugIds },
              ...(q.storeId ? { toLocationId: q.storeId } : {}),
            }),
            _sum: { quantityRemaining: true },
          })
        : [],
      drugIds.length
        ? this.prisma.invoiceItem.groupBy({
            by: ['drugId'],
            where: {
              drugId: { in: drugIds },
              invoice: { createdAt: { gte: from, lte: to } },
            },
            _sum: { amountPaid: true, quantity: true },
          })
        : [],
    ]);
    const stockMap = new Map<string, number>(
      stockRows.map((r): [string, number] => [r.drugId, r._sum.quantityRemaining ?? 0]),
    );
    const revenueMap = new Map<string, { revenue: number; quantity: number }>();
    for (const row of revenueRows as Array<{
      drugId: string | null;
      _sum: { amountPaid: Prisma.Decimal | null; quantity: number | null };
    }>) {
      if (!row.drugId) continue;
      revenueMap.set(row.drugId, {
        revenue: toNumber(row._sum.amountPaid),
        quantity: row._sum.quantity ?? 0,
      });
    }
    const drugMap = new Map(
      items
        .filter((i) => i.drugId)
        .map((i) => [i.drugId!, i.drug]),
    );

    const data = [...qtyByDrug.entries()]
      .map(([drugId, quantitySold]) => {
        const rev = revenueMap.get(drugId);
        const revenue = rev?.revenue ?? 0;
        const denomQty = rev?.quantity ?? quantitySold;
        return {
          drugId,
          drugName: drugMap.get(drugId)?.brandName || drugMap.get(drugId)?.genericName || 'Unknown',
          quantitySold,
          revenue,
          avgSellingPrice: denomQty > 0 ? revenue / denomQty : 0,
          stockRemaining: stockMap.get(drugId) ?? 0,
        };
      })
      .sort((a, b) => b.quantitySold - a.quantitySold)
      .slice(0, take);

    return { data, total: data.length, take };
  }

  async getMostPrescribed(q: PharmacyDashboardQueryDto) {
    const { from, to } = this.getDateWindow(q);
    const take = Math.min(Math.max(1, q.take ?? 20), 100);
    const grouped = await this.prisma.prescriptionItem.groupBy({
      by: ['drugId'],
      where: {
        drugId: { not: null },
      },
      _count: { id: true },
      _sum: { quantityPrescribed: true, quantityDispensed: true },
    });
    const top = grouped
      .sort((a, b) => (b._count.id ?? 0) - (a._count.id ?? 0))
      .slice(0, take);
    const ids = top.map((t) => t.drugId!).filter(Boolean);
    const drugs = ids.length
      ? await this.prisma.drug.findMany({
          where: { id: { in: ids } },
          select: { id: true, brandName: true, genericName: true },
        })
      : [];
    const drugMap = new Map(drugs.map((d) => [d.id, d]));

    const prescriptions = ids.length
      ? await this.prisma.prescription.findMany({
          where: {
            items: { some: { drugId: { in: ids }, prescription: { patientId: { not: '' } } } },
          },
          include: { items: { select: { drugId: true } } },
        })
      : [];
    const prescriberMap = new Map<string, Set<string>>();
    for (const p of prescriptions) {
      for (const i of p.items) {
        if (!i.drugId || !p.doctorId) continue;
        if (!prescriberMap.has(i.drugId)) prescriberMap.set(i.drugId, new Set());
        prescriberMap.get(i.drugId)!.add(p.doctorId);
      }
    }

    return {
      data: top.map((t) => {
        const qtyPrescribed = t._sum.quantityPrescribed ?? 0;
        const qtyDispensed = t._sum.quantityDispensed ?? 0;
        const rate = qtyPrescribed > 0 ? (qtyDispensed / qtyPrescribed) * 100 : 0;
        return {
          drugId: t.drugId,
          drugName:
            drugMap.get(t.drugId!)?.brandName ||
            drugMap.get(t.drugId!)?.genericName ||
            'Unknown',
          timesPrescribed: t._count.id ?? 0,
          distinctPrescribers: prescriberMap.get(t.drugId!)?.size ?? 0,
          dispenseCompletionRate: Number(rate.toFixed(2)),
        };
      }),
      total: top.length,
      take,
    };
  }

  async getStockMovement(q: PharmacyDashboardQueryDto) {
    const { from, to } = this.getDateWindow(q);
    const sellableMovement = await getSellableDrugBatchWhere(this.prisma);
    const current = await this.prisma.drugBatch.aggregate({
      where: mergeDrugBatchWhere(sellableMovement, {
        ...(q.storeId ? { toLocationId: q.storeId } : {}),
        ...(q.drugId ? { drugId: q.drugId } : {}),
      }),
      _sum: { quantityRemaining: true },
    });

    const movementRows = await this.prisma.inventoryMovement.groupBy({
      by: ['movementType'],
      where: this.movementWhere(from, to, q),
      _sum: { quantity: true },
    });
    const byType = new Map(
      movementRows.map((r) => [r.movementType, r._sum.quantity ?? 0]),
    );
    const inflow =
      (byType.get(InventoryMovementType.PURCHASE) ?? 0) +
      (byType.get(InventoryMovementType.TRANSFER_IN) ?? 0) +
      (byType.get(InventoryMovementType.RETURN) ?? 0);
    const outflow =
      (byType.get(InventoryMovementType.DISPENSE) ?? 0) +
      (byType.get(InventoryMovementType.TRANSFER_OUT) ?? 0) +
      (byType.get(InventoryMovementType.EXPIRY_WRITEOFF) ?? 0);
    const adjustments = byType.get(InventoryMovementType.ADJUSTMENT) ?? 0;
    const closingStock = current._sum.quantityRemaining ?? 0;
    const openingStock = closingStock - inflow + outflow - adjustments;

    return {
      openingStock,
      purchases: byType.get(InventoryMovementType.PURCHASE) ?? 0,
      transferIn: byType.get(InventoryMovementType.TRANSFER_IN) ?? 0,
      transferOut: byType.get(InventoryMovementType.TRANSFER_OUT) ?? 0,
      dispensed: byType.get(InventoryMovementType.DISPENSE) ?? 0,
      returns: byType.get(InventoryMovementType.RETURN) ?? 0,
      writeOff: byType.get(InventoryMovementType.EXPIRY_WRITEOFF) ?? 0,
      adjustments,
      inflow,
      outflow,
      closingStock,
    };
  }

  async getPurchaseOrders(q: PharmacyDashboardQueryDto) {
    const { from, to } = this.getDateWindow(q);
    const skip = Math.max(0, q.skip ?? 0);
    const take = Math.min(Math.max(1, q.take ?? 20), 100);
    const where: Prisma.PurchaseOrderWhereInput = {
      createdAt: { gte: from, lte: to },
      ...(q.supplierId ? { supplierId: q.supplierId } : {}),
    };
    const [statusCounts, totalAmount, rows, total] = await Promise.all([
      this.prisma.purchaseOrder.groupBy({
        by: ['status'],
        where,
        _count: { _all: true },
      }),
      this.prisma.purchaseOrder.aggregate({ where, _sum: { totalAmount: true } }),
      this.prisma.purchaseOrder.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: { supplier: { select: { id: true, name: true } } },
      }),
      this.prisma.purchaseOrder.count({ where }),
    ]);

    const counts = {
      draft: 0,
      approved: 0,
      received: 0,
      cancelled: 0,
    };
    for (const c of statusCounts) {
      if (c.status === PurchaseOrderStatus.DRAFT) counts.draft = c._count._all;
      if (c.status === PurchaseOrderStatus.APPROVED)
        counts.approved = c._count._all;
      if (c.status === PurchaseOrderStatus.RECEIVED) counts.received = c._count._all;
      if (c.status === PurchaseOrderStatus.CANCELLED)
        counts.cancelled = c._count._all;
    }

    return {
      counts,
      outstandingPayable: toNumber(totalAmount._sum.totalAmount),
      data: rows,
      total,
      skip,
      take,
    };
  }

  async getInsuranceClaims(q: PharmacyDashboardQueryDto) {
    const { from, to } = this.getDateWindow(q);
    const where: Prisma.InsuranceClaimWhereInput = {
      createdAt: { gte: from, lte: to },
    };
    const claims = await this.prisma.insuranceClaim.findMany({ where });
    const buckets = this.getBuckets(from, to, 'day');
    const trend = buckets.map((b) => ({
      label: b.label,
      start: b.start.toISOString(),
      end: b.end.toISOString(),
      submitted: 0,
      approved: 0,
      rejected: 0,
      pending: 0,
    }));

    const summary = { submitted: 0, approved: 0, rejected: 0, pending: 0, claimsValue: 0 };
    for (const c of claims) {
      const status = (c.status || 'PENDING').toUpperCase();
      summary.submitted += 1;
      summary.claimsValue += toNumber(c.coveredAmount);
      if (status === 'APPROVED') summary.approved += 1;
      else if (status === 'REJECTED') summary.rejected += 1;
      else summary.pending += 1;

      const idx = trend.findIndex((p) => c.createdAt >= new Date(p.start) && c.createdAt <= new Date(p.end));
      if (idx >= 0) {
        trend[idx].submitted += 1;
        if (status === 'APPROVED') trend[idx].approved += 1;
        else if (status === 'REJECTED') trend[idx].rejected += 1;
        else trend[idx].pending += 1;
      }
    }

    return { ...summary, trend };
  }

  async getPharmacistProductivity(q: PharmacyDashboardQueryDto) {
    const { from, to } = this.getDateWindow(q);
    const rows = await this.prisma.dispensation.groupBy({
      by: ['pharmacistId', 'status'],
      where: {
        createdAt: { gte: from, lte: to },
        ...(q.storeId ? { locationId: q.storeId } : {}),
        ...(q.pharmacistId ? { pharmacistId: q.pharmacistId } : {}),
      },
      _count: { _all: true },
    });
    const pharmacistIds = [...new Set(rows.map((r) => r.pharmacistId))];
    const pharmacists = pharmacistIds.length
      ? await this.prisma.staff.findMany({
          where: { id: { in: pharmacistIds } },
          select: { id: true, firstName: true, lastName: true },
        })
      : [];
    const names = new Map(
      pharmacists.map((p) => [p.id, `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim()]),
    );

    const map = new Map<
      string,
      { prescriptionsVerified: number; ordersDispensed: number; pharmacistName: string }
    >();
    for (const row of rows) {
      if (!map.has(row.pharmacistId)) {
        map.set(row.pharmacistId, {
          prescriptionsVerified: 0,
          ordersDispensed: 0,
          pharmacistName: names.get(row.pharmacistId) ?? 'Unknown',
        });
      }
      const current = map.get(row.pharmacistId)!;
      current.prescriptionsVerified += row._count._all;
      if (row.status === DispensationStatus.COMPLETED) {
        current.ordersDispensed += row._count._all;
      }
    }

    return {
      data: [...map.entries()].map(([pharmacistId, value]) => ({
        pharmacistId,
        ...value,
        avgTurnaroundMinutes: 0,
        interventionsRaised: 0,
        shiftHours: 0,
        ordersPerHour: 0,
      })),
    };
  }

  async getInteractionAlerts(q: PharmacyDashboardQueryDto) {
    const { from, to } = this.getDateWindow(q);
    const [totalAlerts, highSeverityAlerts, unresolvedAlerts, recentAlerts] =
      await Promise.all([
        this.prisma.alertLog.count({
          where: { createdAt: { gte: from, lte: to } },
        }),
        this.prisma.alertLog.count({
          where: {
            createdAt: { gte: from, lte: to },
            severity: { in: [AlertSeverity.HIGH, AlertSeverity.CRITICAL] },
          },
        }),
        this.prisma.alertLog.count({
          where: { createdAt: { gte: from, lte: to }, resolved: false },
        }),
        this.prisma.alertLog.findMany({
          where: { createdAt: { gte: from, lte: to } },
          take: Math.min(Math.max(1, q.take ?? 20), 100),
          orderBy: { createdAt: 'desc' },
          include: {
            admission: {
              include: { patient: { select: { id: true, firstName: true, surname: true } } },
            },
            resolvedBy: { select: { id: true, firstName: true, lastName: true } },
          },
        }),
      ]);

    return {
      totalAlerts,
      highSeverityAlerts,
      overriddenAlerts: 0,
      acceptedAlerts: totalAlerts - unresolvedAlerts,
      recent: recentAlerts.map((a) => ({
        id: a.id,
        time: a.createdAt,
        patientId: a.admission.patient.id,
        patientName: `${a.admission.patient.firstName ?? ''} ${a.admission.patient.surname ?? ''}`.trim(),
        alertType: a.alertType,
        severity: a.severity,
        message: a.message,
        resolved: a.resolved,
        actionBy: a.resolvedBy
          ? `${a.resolvedBy.firstName ?? ''} ${a.resolvedBy.lastName ?? ''}`.trim()
          : null,
      })),
    };
  }

  async getControlledSubstances(q: PharmacyDashboardQueryDto) {
    const { from, to } = this.getDateWindow(q);
    const controlledDispensations = await this.prisma.dispensationItem.findMany({
      where: {
        dispensation: {
          createdAt: { gte: from, lte: to },
          ...(q.storeId ? { locationId: q.storeId } : {}),
        },
        prescriptionItem: { drug: { isControlled: true } },
      },
      include: {
        dispensation: {
          include: {
            pharmacist: { select: { id: true, firstName: true, lastName: true } },
            approvals: true,
          },
        },
        prescriptionItem: { include: { drug: true } },
        batch: true,
      },
      take: Math.min(Math.max(1, q.take ?? 20), 100),
      skip: Math.max(0, q.skip ?? 0),
      orderBy: { dispensation: { createdAt: 'desc' } },
    });

    const grouped = new Map<string, any>();
    for (const row of controlledDispensations) {
      const key = `${row.prescriptionItem.drugId ?? 'unknown'}:${row.batchId ?? 'nobatch'}`;
      if (!grouped.has(key)) {
        grouped.set(key, {
          drugId: row.prescriptionItem.drugId,
          drugName:
            row.prescriptionItem.drug?.brandName ||
            row.prescriptionItem.drug?.genericName ||
            'Unknown',
          batchId: row.batchId,
          openingBalance: row.batch?.quantityReceived ?? 0,
          dispensed: 0,
          adjusted: 0,
          closingBalance: row.batch?.quantityRemaining ?? 0,
          witnessUser: row.dispensation.approvals[0]?.approverId ?? null,
          timestamp: row.dispensation.createdAt,
        });
      }
      grouped.get(key).dispensed += row.quantityDispensed;
    }

    const controlledPrescriptionsDispensed = controlledDispensations.length;
    const unreconciledTransactions = controlledDispensations.filter(
      (r) => r.dispensation.approvals.length === 0,
    ).length;

    return {
      controlledPrescriptionsDispensed,
      balanceDiscrepancies: 0,
      unreconciledTransactions,
      dailyBalanceVariance: 0,
      ledger: [...grouped.values()],
    };
  }

  async getRevenueChart(q: PharmacyDashboardChartQueryDto) {
    const { from, to } = this.getDateWindow(q);
    const buckets = this.getBuckets(from, to, q.bucketBy);
    const points: Array<{
      label: string;
      start: string;
      end: string;
      grossRevenue: number;
      netRevenue: number;
      insuranceReimbursed: number;
      cashCollected: number;
    }> = [];
    for (const b of buckets) {
      const [payments, refunds] = await Promise.all([
        this.prisma.invoicePayment.findMany({
          where: { createdAt: { gte: b.start, lte: b.end } },
          select: { amount: true, source: true },
        }),
        this.prisma.invoiceRefund.aggregate({
          where: { refundedAt: { gte: b.start, lte: b.end } },
          _sum: { amount: true },
        }),
      ]);
      let gross = 0;
      let insurance = 0;
      let cash = 0;
      for (const p of payments) {
        const amount = toNumber(p.amount);
        gross += amount;
        if (p.source === InvoicePaymentSource.INSURANCE) insurance += amount;
        if (p.source === InvoicePaymentSource.CASH) cash += amount;
      }
      const refund = toNumber(refunds._sum.amount);
      points.push({
        label: b.label,
        start: b.start.toISOString(),
        end: b.end.toISOString(),
        grossRevenue: gross,
        netRevenue: gross - refund,
        insuranceReimbursed: insurance,
        cashCollected: cash,
      });
    }
    return { points };
  }

  async getDrugUsageChart(q: PharmacyDrugUsageChartQueryDto) {
    const { from, to } = this.getDateWindow(q);
    const buckets = this.getBuckets(from, to, q.bucketBy);
    let drugIds = parseDrugIds(q.drugIds);

    if (!drugIds.length) {
      const top = await this.prisma.prescriptionItem.groupBy({
        by: ['drugId'],
        where: {
          drugId: { not: null },
        },
        _sum: { quantityDispensed: true },
        orderBy: { _sum: { quantityDispensed: 'desc' } },
        take: Math.min(Math.max(1, q.limit ?? 5), 10),
      });
      drugIds = top.map((t) => t.drugId!).filter(Boolean);
    }

    const drugs = drugIds.length
      ? await this.prisma.drug.findMany({
          where: { id: { in: drugIds } },
          select: { id: true, brandName: true, genericName: true },
        })
      : [];
    const drugNameMap = new Map(
      drugs.map((d) => [d.id, d.brandName || d.genericName || 'Unknown']),
    );
    const series: Array<{
      drugId: string;
      drugName: string;
      points: Array<{ label: string; start: string; end: string; value: number }>;
    }> = [];

    for (const drugId of drugIds) {
      const points: Array<{ label: string; start: string; end: string; value: number }> = [];
      for (const b of buckets) {
        const agg = await this.prisma.dispensationItem.aggregate({
          where: {
            prescriptionItem: { drugId },
            dispensation: {
              createdAt: { gte: b.start, lte: b.end },
              status: DispensationStatus.COMPLETED,
            },
          },
          _sum: { quantityDispensed: true },
        });
        points.push({
          label: b.label,
          start: b.start.toISOString(),
          end: b.end.toISOString(),
          value: agg._sum.quantityDispensed ?? 0,
        });
      }
      series.push({
        drugId,
        drugName: drugNameMap.get(drugId) ?? 'Unknown',
        points,
      });
    }

    return { series };
  }

  async getInventoryTrendChart(q: PharmacyDashboardChartQueryDto) {
    const { from, to } = this.getDateWindow(q);
    const buckets = this.getBuckets(from, to, q.bucketBy);
    const excludedTrend = await getExcludedStockLocationIds(this.prisma);
    const points: Array<{
      label: string;
      start: string;
      end: string;
      inventoryValue: number;
      totalStockUnits: number;
      lowStockSkuCount: number;
      expiryAtRiskValue: number;
    }> = [];

    for (const b of buckets) {
      const bucketDayStart = new Date(b.end);
      bucketDayStart.setHours(0, 0, 0, 0);
      const trendBase = mergeDrugBatchWhere(
        {
          createdAt: { lte: b.end },
          quantityRemaining: { gt: 0 },
          expiryDate: { gte: bucketDayStart },
        },
        excludedTrend.length > 0
          ? { toLocationId: { notIn: excludedTrend } }
          : {},
        q.storeId ? { toLocationId: q.storeId } : {},
      );
      const [batches, lowStockGrouped] = await Promise.all([
        this.prisma.drugBatch.findMany({
          where: trendBase,
          select: { quantityRemaining: true, costPrice: true, expiryDate: true, drugId: true },
        }),
        this.prisma.drugBatch.groupBy({
          by: ['drugId'],
          where: trendBase,
          _sum: { quantityRemaining: true },
        }),
      ]);
      const drugIds = lowStockGrouped.map((g) => g.drugId);
      const reorder = drugIds.length
        ? await this.prisma.drug.findMany({
            where: { id: { in: drugIds }, deletedAt: null },
            select: { id: true, reorderLevel: true },
          })
        : [];
      const reorderMap = new Map(reorder.map((d) => [d.id, d.reorderLevel]));

      const inventoryValue = batches.reduce(
        (sum, row) => sum + row.quantityRemaining * toNumber(row.costPrice),
        0,
      );
      const totalUnits = batches.reduce((sum, row) => sum + row.quantityRemaining, 0);
      const lowStockSkuCount = lowStockGrouped.filter((g) => {
        const qty = g._sum.quantityRemaining ?? 0;
        const rl = reorderMap.get(g.drugId) ?? 0;
        return qty > 0 && qty <= rl;
      }).length;
      const expiryAtRiskValue = batches
        .filter((bch) => {
          const expWindow = new Date(b.end);
          expWindow.setDate(expWindow.getDate() + 90);
          return bch.expiryDate >= b.end && bch.expiryDate <= expWindow;
        })
        .reduce((sum, row) => sum + row.quantityRemaining * toNumber(row.costPrice), 0);

      points.push({
        label: b.label,
        start: b.start.toISOString(),
        end: b.end.toISOString(),
        inventoryValue,
        totalStockUnits: totalUnits,
        lowStockSkuCount,
        expiryAtRiskValue,
      });
    }

    return { points };
  }
}
