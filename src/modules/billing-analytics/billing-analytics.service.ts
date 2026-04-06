import { Injectable } from '@nestjs/common';
import { InvoiceStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { compareMetrics } from './billing-analytics-math';
import {
  type AnalyticsPeriod,
  getCurrentWindow,
  getPreviousWindow,
  getRevenueSeriesBuckets,
  newOverdueCreatedAtRange,
  type DateWindow,
} from './billing-analytics-period';

const DAY_MS = 24 * 60 * 60 * 1000;

function asDecimal(
  v: Prisma.Decimal | number | null | undefined,
): Prisma.Decimal {
  if (v === null || v === undefined) return new Prisma.Decimal(0);
  if (v instanceof Prisma.Decimal) return v;
  return new Prisma.Decimal(v);
}

function toNumber(d: Prisma.Decimal | null | undefined): number {
  if (d == null) return 0;
  return d.toNumber();
}

@Injectable()
export class BillingAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  private anchor(asOf?: string): Date {
    if (!asOf) return new Date();
    const d = new Date(asOf);
    return Number.isNaN(d.getTime()) ? new Date() : d;
  }

  /**
   * Net cash in: invoice payments minus invoice refunds in range.
   */
  async totalCashInRange(start: Date, end: Date): Promise<number> {
    const [ip, ir] = await Promise.all([
      this.prisma.invoicePayment.aggregate({
        where: { createdAt: { gte: start, lte: end } },
        _sum: { amount: true },
      }),
      this.prisma.invoiceRefund.aggregate({
        where: { refundedAt: { gte: start, lte: end } },
        _sum: { amount: true },
      }),
    ]);
    return toNumber(ip._sum.amount) - toNumber(ir._sum.amount);
  }

  async revenueSummary(period: AnalyticsPeriod, asOf?: string) {
    const anchor = this.anchor(asOf);
    const cur = getCurrentWindow(period, anchor);
    const prev = getPreviousWindow(period, anchor);
    const [current, previous] = await Promise.all([
      this.totalCashInRange(cur.start, cur.end),
      this.totalCashInRange(prev.start, prev.end),
    ]);
    const cmp = compareMetrics(current, previous);
    return {
      period,
      window: { start: cur.start.toISOString(), end: cur.end.toISOString() },
      previousWindow: {
        start: prev.start.toISOString(),
        end: prev.end.toISOString(),
      },
      current,
      previous,
      percentChange: cmp.percentChange,
      direction: cmp.direction,
    };
  }

  async revenueSeries(period: AnalyticsPeriod, asOf?: string) {
    const anchor = this.anchor(asOf);
    const buckets = getRevenueSeriesBuckets(period, anchor);
    const points: Array<{
      label: string;
      revenue: number;
      start: string;
      end: string;
    }> = [];
    for (const b of buckets) {
      const revenue = await this.totalCashInRange(b.start, b.end);
      points.push({
        label: b.label,
        revenue,
        start: b.start.toISOString(),
        end: b.end.toISOString(),
      });
    }
    const w = getCurrentWindow(period, anchor);
    return {
      period,
      window: { start: w.start.toISOString(), end: w.end.toISOString() },
      points,
      maxRevenue: points.reduce((m, p) => Math.max(m, p.revenue), 0),
    };
  }

  private computeRecurringDays(
    segments: Array<{ startAt: Date; endAt: Date | null }>,
    now: Date,
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

  private invoiceLineTotal(
    item: {
      unitPrice: Prisma.Decimal;
      quantity: number;
      isRecurringDaily: boolean;
      usageSegments: Array<{ startAt: Date; endAt: Date | null }>;
    },
    now: Date,
  ): Prisma.Decimal {
    const unitPrice = asDecimal(item.unitPrice);
    if (item.isRecurringDaily) {
      const totalDays = this.computeRecurringDays(item.usageSegments, now);
      return unitPrice.mul(totalDays);
    }
    return unitPrice.mul(item.quantity);
  }

  private lineOutstanding(
    item: {
      unitPrice: Prisma.Decimal;
      quantity: number;
      isRecurringDaily: boolean;
      usageSegments: Array<{ startAt: Date; endAt: Date | null }>;
      amountPaid: Prisma.Decimal;
    },
    now: Date,
  ): Prisma.Decimal {
    const total = this.invoiceLineTotal(item, now);
    const paid = asDecimal(item.amountPaid);
    const o = total.sub(paid);
    return o.gt(0) ? o : new Prisma.Decimal(0);
  }

  /**
   * Unpaid **flow**: open invoices whose `createdAt` falls in the window.
   * Line outstanding uses the same math as billing (recurring daily, etc.).
   */
  private async aggregateUnpaidFlow(window: DateWindow, now: Date) {
    const invoices = await this.prisma.invoice.findMany({
      where: {
        status: { in: [InvoiceStatus.PENDING, InvoiceStatus.PARTIALLY_PAID] },
        createdAt: { gte: window.start, lte: window.end },
      },
      include: {
        invoiceItems: {
          include: { usageSegments: { orderBy: { startAt: 'asc' } } },
        },
      },
    });

    let lineItemCount = 0;
    let quantitySum = 0;
    let outstandingSum = new Prisma.Decimal(0);

    for (const inv of invoices) {
      for (const item of inv.invoiceItems) {
        lineItemCount += 1;
        quantitySum += item.quantity;
        outstandingSum = outstandingSum.add(this.lineOutstanding(item, now));
      }
    }

    return {
      lineItemCount,
      quantitySum,
      outstandingTotal: toNumber(outstandingSum),
    };
  }

  async unpaidSummary(period: AnalyticsPeriod, asOf?: string) {
    const anchor = this.anchor(asOf);
    const now = anchor;
    const cur = getCurrentWindow(period, anchor);
    const prev = getPreviousWindow(period, anchor);

    const [currentAgg, previousAgg, openStock] = await Promise.all([
      this.aggregateUnpaidFlow(cur, now),
      this.aggregateUnpaidFlow(prev, now),
      this.aggregateOpenStock(now),
    ]);

    const lineCountCmp = compareMetrics(
      currentAgg.lineItemCount,
      previousAgg.lineItemCount,
    );
    const qtyCmp = compareMetrics(
      currentAgg.quantitySum,
      previousAgg.quantitySum,
    );
    const amtCmp = compareMetrics(
      currentAgg.outstandingTotal,
      previousAgg.outstandingTotal,
    );

    return {
      period,
      semantics:
        'Unpaid flow: line items on invoices that are still PENDING or PARTIALLY_PAID and whose invoice createdAt falls in each window. Outstanding uses current line math (recurring, etc.).',
      windows: {
        current: {
          start: cur.start.toISOString(),
          end: cur.end.toISOString(),
        },
        previous: {
          start: prev.start.toISOString(),
          end: prev.end.toISOString(),
        },
      },
      openStock,
      lineItems: {
        current: currentAgg.lineItemCount,
        previous: previousAgg.lineItemCount,
        percentChange: lineCountCmp.percentChange,
        direction: lineCountCmp.direction,
      },
      quantities: {
        current: currentAgg.quantitySum,
        previous: previousAgg.quantitySum,
        percentChange: qtyCmp.percentChange,
        direction: qtyCmp.direction,
      },
      outstandingAmount: {
        current: currentAgg.outstandingTotal,
        previous: previousAgg.outstandingTotal,
        percentChange: amtCmp.percentChange,
        direction: amtCmp.direction,
      },
    };
  }

  /** All open invoices (stock): counts and outstanding. */
  private async aggregateOpenStock(now: Date) {
    const invoices = await this.prisma.invoice.findMany({
      where: {
        status: { in: [InvoiceStatus.PENDING, InvoiceStatus.PARTIALLY_PAID] },
      },
      include: {
        invoiceItems: {
          include: { usageSegments: { orderBy: { startAt: 'asc' } } },
        },
      },
    });
    let lineItemCount = 0;
    let quantitySum = 0;
    let outstandingSum = new Prisma.Decimal(0);
    for (const inv of invoices) {
      for (const item of inv.invoiceItems) {
        lineItemCount += 1;
        quantitySum += item.quantity;
        outstandingSum = outstandingSum.add(this.lineOutstanding(item, now));
      }
    }
    return {
      invoiceCount: invoices.length,
      lineItemCount,
      quantitySum,
      outstandingTotal: toNumber(outstandingSum),
    };
  }

  private async overdueStock(now: Date) {
    const cutoff = new Date(now.getTime() - 30 * DAY_MS);
    const invoices = await this.prisma.invoice.findMany({
      where: {
        status: { in: [InvoiceStatus.PENDING, InvoiceStatus.PARTIALLY_PAID] },
        createdAt: { lt: cutoff },
      },
      include: {
        invoiceItems: {
          include: { usageSegments: { orderBy: { startAt: 'asc' } } },
        },
      },
    });
    let outstandingSum = new Prisma.Decimal(0);
    for (const inv of invoices) {
      for (const item of inv.invoiceItems) {
        outstandingSum = outstandingSum.add(this.lineOutstanding(item, now));
      }
    }
    return {
      invoiceCount: invoices.length,
      outstandingTotal: toNumber(outstandingSum),
    };
  }

  /** Open invoices that became overdue (createdAt + 30d) inside the window. */
  private async newOverdueInWindow(window: DateWindow, now: Date) {
    const { createdAtMin, createdAtMax } = newOverdueCreatedAtRange(window);
    const invoices = await this.prisma.invoice.findMany({
      where: {
        status: { in: [InvoiceStatus.PENDING, InvoiceStatus.PARTIALLY_PAID] },
        createdAt: { gte: createdAtMin, lte: createdAtMax },
      },
      include: {
        invoiceItems: {
          include: { usageSegments: { orderBy: { startAt: 'asc' } } },
        },
      },
    });
    let outstandingSum = new Prisma.Decimal(0);
    for (const inv of invoices) {
      for (const item of inv.invoiceItems) {
        outstandingSum = outstandingSum.add(this.lineOutstanding(item, now));
      }
    }
    return {
      invoiceCount: invoices.length,
      outstandingTotal: toNumber(outstandingSum),
    };
  }

  async overdueSummary(period: AnalyticsPeriod, asOf?: string) {
    const anchor = this.anchor(asOf);
    const now = anchor;
    const cur = getCurrentWindow(period, anchor);
    const prev = getPreviousWindow(period, anchor);

    const [stock, curNew, prevNew] = await Promise.all([
      this.overdueStock(now),
      this.newOverdueInWindow(cur, now),
      this.newOverdueInWindow(prev, now),
    ]);

    const countCmp = compareMetrics(curNew.invoiceCount, prevNew.invoiceCount);
    const amtCmp = compareMetrics(
      curNew.outstandingTotal,
      prevNew.outstandingTotal,
    );

    return {
      period,
      semantics: {
        overdue:
          'Open invoices with createdAt more than 30 days before the anchor (no due-date field).',
        comparison:
          'Trend compares invoices that **became eligible to be overdue** during each window: createdAt in [windowStart-30d, windowEnd-30d], still open.',
      },
      windows: {
        current: {
          start: cur.start.toISOString(),
          end: cur.end.toISOString(),
        },
        previous: {
          start: prev.start.toISOString(),
          end: prev.end.toISOString(),
        },
      },
      overdueStock: stock,
      newOverdueInPeriod: {
        current: {
          invoiceCount: curNew.invoiceCount,
          outstandingTotal: curNew.outstandingTotal,
        },
        previous: {
          invoiceCount: prevNew.invoiceCount,
          outstandingTotal: prevNew.outstandingTotal,
        },
        invoiceCountPercentChange: countCmp.percentChange,
        invoiceCountDirection: countCmp.direction,
        outstandingPercentChange: amtCmp.percentChange,
        outstandingDirection: amtCmp.direction,
      },
    };
  }

  async revenueByDepartment(period: AnalyticsPeriod, asOf?: string) {
    const anchor = this.anchor(asOf);
    const w = getCurrentWindow(period, anchor);
    const start = w.start;
    const end = w.end;

    const [allocRows, invoicePayments] = await Promise.all([
      this.prisma.invoiceItemPayment.findMany({
        where: { createdAt: { gte: start, lte: end } },
        include: {
          invoiceItem: {
            include: {
              service: {
                include: { department: true },
              },
            },
          },
        },
      }),
      this.prisma.invoicePayment.findMany({
        where: { createdAt: { gte: start, lte: end } },
        include: {
          invoice: {
            include: {
              invoiceItems: {
                include: {
                  usageSegments: { orderBy: { startAt: 'asc' } },
                  service: { include: { department: true } },
                },
              },
            },
          },
        },
      }),
    ]);

    const byDept = new Map<string, { name: string; amount: Prisma.Decimal }>();

    function addDept(id: string | null, name: string, amt: Prisma.Decimal) {
      const key = id ?? '__unknown__';
      const label = id ? name : 'Unknown';
      const cur = byDept.get(key);
      if (cur) {
        byDept.set(key, { name: label, amount: cur.amount.add(amt) });
      } else {
        byDept.set(key, { name: label, amount: amt });
      }
    }

    for (const row of allocRows) {
      const amt = asDecimal(row.amount);
      const dept = row.invoiceItem.service?.department;
      const deptId = row.invoiceItem.service?.departmentId ?? null;
      addDept(deptId, dept?.name ?? 'Unknown', amt);
    }

    const now = anchor;
    for (const pay of invoicePayments) {
      const inv = pay.invoice;
      const payAmt = asDecimal(pay.amount);
      let lineSum = new Prisma.Decimal(0);
      const lineTotals: Array<{
        deptId: string | null;
        deptName: string;
        total: Prisma.Decimal;
      }> = [];
      for (const item of inv.invoiceItems) {
        const lt = this.invoiceLineTotal(item, now);
        lineSum = lineSum.add(lt);
        const dept = item.service?.department;
        lineTotals.push({
          deptId: item.service?.departmentId ?? null,
          deptName: dept?.name ?? 'Unknown',
          total: lt,
        });
      }
      if (lineSum.eq(0)) continue;
      for (const ln of lineTotals) {
        const share = ln.total.div(lineSum).mul(payAmt);
        addDept(ln.deptId, ln.deptName, share);
      }
    }

    let total = new Prisma.Decimal(0);
    for (const v of byDept.values()) {
      total = total.add(v.amount);
    }

    const slices: Array<{
      departmentId: string | null;
      name: string;
      amount: number;
      percent: number;
    }> = [];

    for (const [id, v] of byDept) {
      const amount = toNumber(v.amount);
      const pct = total.gt(0) ? toNumber(v.amount.div(total).mul(100)) : 0;
      slices.push({
        departmentId: id === '__unknown__' ? null : id,
        name: v.name,
        amount,
        percent: Math.round(pct * 100) / 100,
      });
    }

    slices.sort((a, b) => b.amount - a.amount);

    return {
      period,
      window: { start: start.toISOString(), end: end.toISOString() },
      total: toNumber(total),
      slices,
    };
  }

  async recentInvoices(
    period: AnalyticsPeriod,
    asOf: string | undefined,
    take: number,
  ) {
    const anchor = this.anchor(asOf);
    const rows = await this.prisma.invoice.findMany({
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        patient: {
          select: { firstName: true, surname: true },
        },
      },
    });

    return {
      period,
      asOf: anchor.toISOString(),
      take,
      items: rows.map((r) => ({
        invoiceId: r.id,
        status: r.status,
        patientName: [r.patient.firstName, r.patient.surname]
          .filter(Boolean)
          .join(' ')
          .trim(),
        date: r.createdAt.toISOString(),
        amount: toNumber(r.totalAmount),
      })),
    };
  }
}
