import { Injectable } from '@nestjs/common';
import { Prisma, PurchasesOrderStatus, RequisitionStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PurchasesDashboardQueryDto } from './dto/dashboard.dto';
import { parseDateRange } from '../../common/utils/date-range';

@Injectable()
export class PurchasesDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(query: PurchasesDashboardQueryDto) {
    const { from, to } = parseDateRange(query.fromDate, query.toDate);
    const dateFilter = { gte: from, lte: to };
    const now = new Date();
    const soon = new Date(now);
    soon.setDate(soon.getDate() + 90);

    const [
      pendingRequisitions,
      approvedRequisitions,
      openPurchaseOrders,
      completedPurchaseOrders,
      batchAgg,
      items,
      nearExpiryCount,
      expiredCount,
    ] = await Promise.all([
      this.prisma.requisition.count({
        where: { status: RequisitionStatus.PENDING, createdAt: dateFilter },
      }),
      this.prisma.requisition.count({
        where: { status: RequisitionStatus.APPROVED, createdAt: dateFilter },
      }),
      this.prisma.purchasesPurchaseOrder.count({
        where: {
          status: { in: [PurchasesOrderStatus.DRAFT, PurchasesOrderStatus.PENDING, PurchasesOrderStatus.APPROVED] },
          createdAt: dateFilter,
        },
      }),
      this.prisma.purchasesPurchaseOrder.count({
        where: { status: PurchasesOrderStatus.COMPLETED, createdAt: dateFilter },
      }),
      this.prisma.purchaseItemBatch.aggregate({
        where: { createdAt: dateFilter },
        _sum: { quantityReceived: true },
      }),
      this.prisma.purchaseItem.findMany({
        where: { deletedAt: null },
        select: {
          id: true,
          reorderLevel: true,
          batches: { select: { quantityRemaining: true } },
        },
      }),
      this.prisma.purchaseItemBatch.count({
        where: {
          expiryDate: { gte: now, lte: soon },
        },
      }),
      this.prisma.purchaseItemBatch.count({
        where: { expiryDate: { lt: now } },
      }),
    ]);

    let lowStockCount = 0;
    let outOfStockCount = 0;
    let inventoryValue = new Prisma.Decimal(0);
    for (const item of items) {
      const qty = item.batches.reduce(
        (s, b) => s + (b.quantityRemaining ?? 0),
        0,
      );
      if (qty === 0) outOfStockCount++;
      else if (qty <= item.reorderLevel) lowStockCount++;
    }

    const valueRows = await this.prisma.purchaseItemBatch.findMany({
      where: { createdAt: dateFilter, costPrice: { not: null } },
      select: { quantityRemaining: true, costPrice: true },
    });
    for (const row of valueRows) {
      if (row.costPrice && row.quantityRemaining != null) {
        inventoryValue = inventoryValue.add(
          row.costPrice.mul(row.quantityRemaining),
        );
      }
    }

    const totalPurchaseValue = await this.prisma.purchasesPurchaseOrder.aggregate({
      where: { createdAt: dateFilter, status: PurchasesOrderStatus.COMPLETED },
      _sum: { totalAmount: true },
    });

    return {
      pendingRequisitions,
      approvedRequisitions,
      openPurchaseOrders,
      completedPurchaseOrders,
      totalPurchaseValue: totalPurchaseValue._sum.totalAmount ?? 0,
      inventoryValue,
      lowStockCount,
      outOfStockCount,
      nearExpiryCount,
      expiredCount,
      batchesReceived: batchAgg._sum.quantityReceived ?? 0,
    };
  }

  async getOrdersStatus(query: PurchasesDashboardQueryDto) {
    const { from, to } = parseDateRange(query.fromDate, query.toDate);
    const groups = await this.prisma.purchasesPurchaseOrder.groupBy({
      by: ['status'],
      where: { createdAt: { gte: from, lte: to } },
      _count: { _all: true },
    });
    const total = groups.reduce((s, g) => s + g._count._all, 0);
    return groups.map((g) => ({
      status: g.status,
      count: g._count._all,
      percentage: total ? Math.round((g._count._all / total) * 100) : 0,
    }));
  }

  async getTopItems(query: PurchasesDashboardQueryDto) {
    const { from, to } = parseDateRange(query.fromDate, query.toDate);
    const lines = await this.prisma.purchasesPurchaseOrderLine.findMany({
      where: {
        purchaseOrder: { createdAt: { gte: from, lte: to } },
      },
      include: {
        item: { select: { itemName: true } },
        purchaseOrder: true,
      },
    });
    const map = new Map<
      string,
      {
        itemName: string;
        quantityPurchased: number;
        totalCost: Prisma.Decimal;
        stockRemaining: number;
      }
    >();
    for (const line of lines) {
      const key = line.itemId;
      const cur = map.get(key) ?? {
        itemName: line.item.itemName,
        quantityPurchased: 0,
        totalCost: new Prisma.Decimal(0),
        stockRemaining: 0,
      };
      cur.quantityPurchased += line.quantity;
      cur.totalCost = cur.totalCost.add(line.lineTotal);
      map.set(key, cur);
    }
    const itemIds = [...map.keys()];
    const stock = await this.prisma.purchaseItemBatch.groupBy({
      by: ['itemId'],
      where: { itemId: { in: itemIds } },
      _sum: { quantityRemaining: true },
    });
    for (const s of stock) {
      const cur = map.get(s.itemId);
      if (cur) cur.stockRemaining = s._sum.quantityRemaining ?? 0;
    }
    return [...map.values()]
      .map((v) => ({
        itemName: v.itemName,
        quantityPurchased: v.quantityPurchased,
        totalCost: v.totalCost,
        avgCostPrice:
          v.quantityPurchased > 0
            ? v.totalCost.div(v.quantityPurchased)
            : new Prisma.Decimal(0),
        stockRemaining: v.stockRemaining,
      }))
      .sort((a, b) => b.quantityPurchased - a.quantityPurchased)
      .slice(0, 10);
  }

  async getPurchaseValueChart(query: PurchasesDashboardQueryDto) {
    const { from, to } = parseDateRange(query.fromDate, query.toDate);
    const orders = await this.prisma.purchasesPurchaseOrder.findMany({
      where: {
        createdAt: { gte: from, lte: to },
        status: PurchasesOrderStatus.COMPLETED,
      },
      select: { createdAt: true, totalAmount: true },
    });
    const byMonth = new Map<string, { purchaseValue: Prisma.Decimal; orderCount: number }>();
    for (const o of orders) {
      const label = `${o.createdAt.getFullYear()}-${String(o.createdAt.getMonth() + 1).padStart(2, '0')}`;
      const cur = byMonth.get(label) ?? {
        purchaseValue: new Prisma.Decimal(0),
        orderCount: 0,
      };
      cur.purchaseValue = cur.purchaseValue.add(o.totalAmount);
      cur.orderCount++;
      byMonth.set(label, cur);
    }
    return [...byMonth.entries()].map(([label, v]) => ({
      label,
      purchaseValue: v.purchaseValue,
      orderCount: v.orderCount,
    }));
  }

  async getSupplierPerformance(query: PurchasesDashboardQueryDto) {
    const { from, to } = parseDateRange(query.fromDate, query.toDate);
    const orders = await this.prisma.purchasesPurchaseOrder.findMany({
      where: { createdAt: { gte: from, lte: to } },
      include: { supplier: true, receipts: true },
    });
    const map = new Map<
      string,
      {
        supplierName: string;
        orderCount: number;
        onTimeDeliveries: number;
        leadTimeSum: number;
      }
    >();
    for (const o of orders) {
      const cur = map.get(o.supplierId) ?? {
        supplierName: o.supplier.name,
        orderCount: 0,
        onTimeDeliveries: 0,
        leadTimeSum: 0,
      };
      cur.orderCount++;
      if (o.receipts.length > 0) {
        cur.onTimeDeliveries++;
        const lead =
          (o.receipts[0].receivedAt.getTime() - o.createdAt.getTime()) /
          (1000 * 60 * 60 * 24);
        cur.leadTimeSum += lead;
      }
      map.set(o.supplierId, cur);
    }
    return [...map.values()].map((v) => ({
      supplierName: v.supplierName,
      orderCount: v.orderCount,
      onTimeDeliveries: v.onTimeDeliveries,
      avgLeadTimeDays:
        v.onTimeDeliveries > 0
          ? Math.round((v.leadTimeSum / v.onTimeDeliveries) * 10) / 10
          : 0,
    }));
  }
}
