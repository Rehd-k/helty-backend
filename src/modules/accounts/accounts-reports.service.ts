import { BadRequestException, Injectable } from '@nestjs/common';
import {
  InvoiceCoverageKind,
  InvoiceCoverageStatus,
  InvoicePaymentSource,
  Prisma,
} from '@prisma/client';
import { parseDateRange } from '../../common/utils/date-range';
import {
  formatPatientDisplayName,
  patientNameFieldsSelect,
} from '../../common/utils/patient-display-name.util';
import { PrismaService } from '../../prisma/prisma.service';
import {
  getCurrentWindow,
  getPreviousWindow,
  InvalidPeriodWindowError,
  resolvePeriodWindow,
} from '../billing-analytics/billing-analytics-period';
import { BillingAnalyticsService } from '../billing-analytics/billing-analytics.service';
import {
  ageDays,
  agingBucket,
  formatDateOnly,
  staffLabel,
  toNumber,
} from './accounts.utils';
import {
  AccountsAgingQueryDto,
  AccountsDateRangeQueryDto,
  AccountsPeriodQueryDto,
  AccountsReportPeriodQueryDto,
  AccountsRevenueByServiceDetailsQueryDto,
} from './dto/accounts-query.dto';

type DailyRow = {
  date: string;
  cash: number;
  card: number;
  transfer: number;
  cheque: number;
  wallet: number;
  insurance: number;
  total: number;
  transactionCount: number;
};

@Injectable()
export class AccountsReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly billingAnalytics: BillingAnalyticsService,
  ) {}

  private parseRange(q: AccountsDateRangeQueryDto) {
    return parseDateRange(q.from, q.to);
  }

  private resolveReportWindow(q: AccountsReportPeriodQueryDto) {
    const anchor = q.asOf ? new Date(q.asOf) : new Date();
    if (q.asOf && Number.isNaN(anchor.getTime())) {
      throw new BadRequestException('Invalid asOf date');
    }
    try {
      return {
        anchor,
        window: resolvePeriodWindow(q.period, anchor, {
          from: q.from,
          to: q.to,
        }),
      };
    } catch (e) {
      if (e instanceof InvalidPeriodWindowError) {
        throw new BadRequestException(e.message);
      }
      throw e;
    }
  }

  private serviceCategoryLabel(
    service: { name: string; category?: { name: string } | null } | null | undefined,
  ): string {
    return service?.category?.name ?? service?.name ?? 'Other';
  }

  private buildServiceCategoryWhere(
    serviceCategory: string,
  ): Prisma.ServiceWhereInput {
    if (serviceCategory === 'Other') {
      return {
        category: null,
        name: '',
      };
    }
    return {
      OR: [
        { category: { name: serviceCategory } },
        { category: null, name: serviceCategory },
      ],
    };
  }

  private buildRevenueDetailsSearchOr(
    q: string,
  ): Prisma.InvoiceItemPaymentWhereInput[] {
    const needle = { contains: q, mode: 'insensitive' as const };
    return [
      { invoiceItem: { invoice: { patient: { firstName: needle } } } },
      { invoiceItem: { invoice: { patient: { surname: needle } } } },
      { invoiceItem: { invoice: { patient: { otherName: needle } } } },
      { invoiceItem: { invoice: { patient: { patientId: needle } } } },
      { invoiceItem: { invoice: { patient: { phoneNumber: needle } } } },
      { invoiceItem: { invoice: { invoiceID: needle } } },
    ];
  }

  async dailyCollections(q: AccountsDateRangeQueryDto) {
    const { from, to } = this.parseRange(q);
    const payments = await this.prisma.invoicePayment.findMany({
      where: { paidAt: { gte: from, lte: to } },
      select: { paidAt: true, amount: true, source: true },
    });

    const byDate = new Map<string, DailyRow>();
    for (const p of payments) {
      const date = formatDateOnly(p.paidAt);
      let row = byDate.get(date);
      if (!row) {
        row = {
          date,
          cash: 0,
          card: 0,
          transfer: 0,
          cheque: 0,
          wallet: 0,
          insurance: 0,
          total: 0,
          transactionCount: 0,
        };
        byDate.set(date, row);
      }
      const amt = toNumber(p.amount);
      row.transactionCount += 1;
      row.total += amt;
      switch (p.source) {
        case InvoicePaymentSource.CASH:
          row.cash += amt;
          break;
        case InvoicePaymentSource.CARD:
          row.card += amt;
          break;
        case InvoicePaymentSource.TRANSFER:
          row.transfer += amt;
          break;
        case InvoicePaymentSource.WALLET:
          row.wallet += amt;
          break;
        case InvoicePaymentSource.INSURANCE:
          row.insurance += amt;
          break;
        default:
          row.cash += amt;
          break;
      }
    }

    return {
      rows: [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)),
    };
  }

  async aging(q: AccountsAgingQueryDto) {
    const asOf = new Date();
    const where: Prisma.InvoiceCoverageWhereInput = {
      status: InvoiceCoverageStatus.APPLIED,
      ...(q.type === 'hmo'
        ? { kind: InvoiceCoverageKind.HMO }
        : q.type === 'discount'
          ? { kind: InvoiceCoverageKind.DISCOUNT }
          : {}),
    };

    const coverages = await this.prisma.invoiceCoverage.findMany({
      where,
      include: {
        hmo: { select: { id: true, name: true } },
        payer: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    type PartyRow = {
      id: string;
      partyName: string;
      type: string;
      totalDue: number;
      current: number;
      days30: number;
      days60: number;
      days90: number;
      over90: number;
    };

    const parties = new Map<string, PartyRow>();
    const bucketTotals = new Map<string, { count: number; amount: number }>();

    for (const c of coverages) {
      const type = c.kind === InvoiceCoverageKind.HMO ? 'hmo' : 'discount';
      const partyId =
        type === 'hmo'
          ? (c.hmoId ?? c.id)
          : (c.payerStaffId ?? c.id);
      const partyName =
        type === 'hmo'
          ? (c.hmo?.name ?? 'Unknown HMO')
          : c.payer
            ? `${c.payer.firstName ?? ''} ${c.payer.lastName ?? ''}`.trim()
            : 'Discount authority';

      const key = `${type}:${partyId}`;
      let row = parties.get(key);
      if (!row) {
        row = {
          id: partyId,
          partyName,
          type,
          totalDue: 0,
          current: 0,
          days30: 0,
          days60: 0,
          days90: 0,
          over90: 0,
        };
        parties.set(key, row);
      }

      const amt = toNumber(c.amount);
      const days = ageDays(c.createdAt, asOf);
      const bucket = agingBucket(days);
      row.totalDue += amt;

      if (days <= 0) row.current += amt;
      else if (days <= 30) row.days30 += amt;
      else if (days <= 60) row.days60 += amt;
      else if (days <= 90) row.days90 += amt;
      else row.over90 += amt;

      const bt = bucketTotals.get(bucket) ?? { count: 0, amount: 0 };
      bt.count += 1;
      bt.amount += amt;
      bucketTotals.set(bucket, bt);
    }

    const totalOutstanding = [...parties.values()].reduce(
      (s, r) => s + r.totalDue,
      0,
    );

    const bucketOrder = [
      'Current',
      '1-30 days',
      '31-60 days',
      '61-90 days',
      '90+ days',
    ];

    return {
      totalOutstanding,
      buckets: bucketOrder
        .filter((b) => bucketTotals.has(b))
        .map((bucket) => ({
          bucket,
          count: bucketTotals.get(bucket)!.count,
          amount: bucketTotals.get(bucket)!.amount,
        })),
      rows: [...parties.values()].sort((a, b) => b.totalDue - a.totalDue),
    };
  }

  async collectionEfficiency(q: AccountsPeriodQueryDto) {
    const anchor = q.asOf ? new Date(q.asOf) : new Date();
    if (q.asOf && Number.isNaN(anchor.getTime())) {
      throw new BadRequestException('Invalid asOf date');
    }
    const window = getCurrentWindow(q.period, anchor);

    const [billed, collected, refunds, payments] = await Promise.all([
      this.prisma.invoice.aggregate({
        where: { createdAt: { gte: window.start, lte: window.end } },
        _sum: { totalAmount: true },
      }),
      this.billingAnalytics.totalCashInRange(window.start, window.end),
      this.prisma.invoiceRefund.aggregate({
        where: { refundedAt: { gte: window.start, lte: window.end } },
        _sum: { amount: true },
      }),
      this.prisma.invoicePayment.findMany({
        where: { paidAt: { gte: window.start, lte: window.end } },
        select: {
          paidAt: true,
          invoice: { select: { createdAt: true } },
        },
      }),
    ]);

    const billedAmount = toNumber(billed._sum.totalAmount);
    const collectedAmount = collected;
    const writeOffAmount = toNumber(refunds._sum.amount);

    let avgDaysToCollect = 0;
    if (payments.length) {
      const totalDays = payments.reduce((s, p) => {
        const days =
          (p.paidAt.getTime() - p.invoice.createdAt.getTime()) /
          (24 * 60 * 60 * 1000);
        return s + Math.max(0, days);
      }, 0);
      avgDaysToCollect = Math.round((totalDays / payments.length) * 10) / 10;
    }

    return {
      period: q.period,
      billedAmount,
      collectedAmount,
      collectionRatePercent:
        billedAmount > 0
          ? Math.round((collectedAmount / billedAmount) * 1000) / 10
          : 0,
      avgDaysToCollect,
      writeOffAmount,
    };
  }

  async revenueByService(q: AccountsReportPeriodQueryDto) {
    const { window } = this.resolveReportWindow(q);

    const allocations = await this.prisma.invoiceItemPayment.findMany({
      where: {
        invoicePayment: {
          paidAt: { gte: window.start, lte: window.end },
        },
        invoiceItem: { serviceId: { not: null } },
      },
      include: {
        invoiceItem: {
          include: {
            service: {
              include: { category: true },
            },
          },
        },
      },
    });

    const byCategory = new Map<
      string,
      { amount: number; transactionCount: number }
    >();
    for (const a of allocations) {
      const label = this.serviceCategoryLabel(a.invoiceItem.service);
      const cur = byCategory.get(label) ?? { amount: 0, transactionCount: 0 };
      cur.amount += toNumber(a.amount);
      cur.transactionCount += 1;
      byCategory.set(label, cur);
    }

    const total = [...byCategory.values()].reduce((s, v) => s + v.amount, 0);
    return {
      rows: [...byCategory.entries()]
        .map(([serviceCategory, v]) => ({
          serviceCategory,
          amount: v.amount,
          transactionCount: v.transactionCount,
          percentOfTotal:
            total > 0 ? Math.round((v.amount / total) * 1000) / 10 : 0,
        }))
        .sort((a, b) => b.amount - a.amount),
    };
  }

  async revenueByServiceDetails(q: AccountsRevenueByServiceDetailsQueryDto) {
    const serviceCategory = q.serviceCategory?.trim();
    if (!serviceCategory) {
      throw new BadRequestException('serviceCategory is required');
    }

    const { anchor, window } = this.resolveReportWindow(q);
    const skip = q.skip ?? 0;
    const take = Math.min(q.take ?? 50, 100);
    const needle = q.q?.trim();

    const baseWhere: Prisma.InvoiceItemPaymentWhereInput = {
      invoicePayment: {
        paidAt: { gte: window.start, lte: window.end },
      },
      invoiceItem: {
        serviceId: { not: null },
        service: this.buildServiceCategoryWhere(serviceCategory),
      },
    };

    const where: Prisma.InvoiceItemPaymentWhereInput = needle
      ? { AND: [baseWhere, { OR: this.buildRevenueDetailsSearchOr(needle) }] }
      : baseWhere;

    const [allocations, total, sum] = await Promise.all([
      this.prisma.invoiceItemPayment.findMany({
        where,
        skip,
        take,
        orderBy: { invoicePayment: { paidAt: 'desc' } },
        include: {
          invoicePayment: {
            select: {
              id: true,
              paidAt: true,
              source: true,
              method: true,
              reference: true,
              receivedBy: {
                select: {
                  firstName: true,
                  lastName: true,
                  email: true,
                  staffId: true,
                },
              },
            },
          },
          invoiceItem: {
            select: {
              quantity: true,
              unitPrice: true,
              customDescription: true,
              invoice: {
                select: {
                  id: true,
                  invoiceID: true,
                  encounterId: true,
                  patient: {
                    select: { ...patientNameFieldsSelect, phoneNumber: true },
                  },
                },
              },
              service: {
                select: {
                  id: true,
                  name: true,
                  category: { select: { name: true } },
                },
              },
            },
          },
        },
      }),
      this.prisma.invoiceItemPayment.count({ where }),
      this.prisma.invoiceItemPayment.aggregate({
        where,
        _sum: { amount: true },
      }),
    ]);

    return {
      period: q.period,
      ...(q.period === 'custom'
        ? { from: window.start.toISOString(), to: window.end.toISOString() }
        : { asOf: anchor.toISOString() }),
      serviceCategory,
      totalAmount: toNumber(sum._sum.amount),
      total,
      skip,
      take,
      rows: allocations.map((a) => {
        const payment = a.invoicePayment!;
        const item = a.invoiceItem;
        const patient = item.invoice.patient;
        return {
          allocationId: a.id,
          paidAt: payment.paidAt.toISOString(),
          amount: toNumber(a.amount),
          patient: {
            id: patient.id,
            patientId: patient.patientId,
            displayName: formatPatientDisplayName(patient),
            avatarUrl: patient.avatarUrl ?? null,
            phoneNumber: patient.phoneNumber,
          },
          invoice: {
            id: item.invoice.id,
            invoiceID: item.invoice.invoiceID,
          },
          service: {
            id: item.service?.id ?? null,
            name: item.service?.name ?? null,
            categoryName: item.service?.category?.name ?? null,
          },
          lineItem: {
            quantity: item.quantity,
            unitPrice: toNumber(item.unitPrice),
            customDescription: item.customDescription,
          },
          payment: {
            id: payment.id,
            source: payment.source,
            method: payment.method,
            reference: payment.reference,
            receivedBy: staffLabel(payment.receivedBy),
          },
          encounterId: item.invoice.encounterId,
        };
      }),
    };
  }

  async profitLoss(q: AccountsPeriodQueryDto) {
    const anchor = q.asOf ? new Date(q.asOf) : new Date();
    const window = getCurrentWindow(q.period, anchor);
    const revenueBySvc = await this.revenueByService(q);

    const revenueLines = revenueBySvc.rows.map((r, i, arr) => ({
      label: r.serviceCategory,
      amount: r.amount,
      ...(i === arr.length - 1 ? { isTotal: true } : {}),
    }));

    const expenseAccounts = await this.prisma.chartOfAccount.findMany({
      where: { type: 'expense', isActive: true },
    });

    const journalDebits = await this.prisma.journalEntry.groupBy({
      by: ['debitAccountId'],
      where: { entryDate: { gte: window.start, lte: window.end } },
      _sum: { amount: true },
    });

    const poTotal = await this.prisma.purchasesPurchaseOrder.aggregate({
      where: {
        createdAt: { gte: window.start, lte: window.end },
        status: { not: 'CANCELLED' },
      },
      _sum: { totalAmount: true },
    });

    const expenseLines: Array<{ label: string; amount: number; isTotal?: boolean }> =
      [];
    let expenseSum = 0;

    for (const acct of expenseAccounts) {
      const je = journalDebits.find((j) => j.debitAccountId === acct.id);
      const amt = toNumber(je?._sum.amount);
      if (amt > 0) {
        expenseLines.push({ label: acct.name, amount: amt });
        expenseSum += amt;
      }
    }

    const suppliesFallback = toNumber(poTotal._sum.totalAmount);
    if (suppliesFallback > 0 && !expenseLines.some((e) => e.label.includes('Supplies'))) {
      expenseLines.push({ label: 'Supplies (purchases)', amount: suppliesFallback });
      expenseSum += suppliesFallback;
    }

    if (expenseLines.length) {
      expenseLines[expenseLines.length - 1].isTotal = true;
    }

    const totalRevenue = revenueBySvc.rows.reduce((s, r) => s + r.amount, 0);
    const netProfit = totalRevenue - expenseSum;

    return {
      period: q.period,
      revenueLines,
      expenseLines,
      netProfit,
      grossMarginPercent:
        totalRevenue > 0
          ? Math.round((netProfit / totalRevenue) * 1000) / 10
          : 0,
    };
  }

  async cashFlow(q: AccountsPeriodQueryDto) {
    const anchor = q.asOf ? new Date(q.asOf) : new Date();
    const window = getCurrentWindow(q.period, anchor);
    const collections = await this.billingAnalytics.totalCashInRange(
      window.start,
      window.end,
    );

    const journalEntries = await this.prisma.journalEntry.findMany({
      where: { entryDate: { gte: window.start, lte: window.end } },
      include: {
        debitAccount: true,
        creditAccount: true,
      },
    });

    const operating = [{ label: 'Collections', amount: collections }];
    const investing: Array<{ label: string; amount: number }> = [];
    const financing: Array<{ label: string; amount: number }> = [];

    for (const je of journalEntries) {
      const amt = toNumber(je.amount);
      if (je.debitAccount.type === 'asset' && je.creditAccount.type === 'asset') {
        investing.push({ label: je.description, amount: -amt });
      } else if (
        je.creditAccount.type === 'liability' ||
        je.debitAccount.type === 'liability'
      ) {
        financing.push({
          label: je.description,
          amount: je.debitAccount.type === 'liability' ? amt : -amt,
        });
      }
    }

    const cashAccount = await this.prisma.chartOfAccount.findFirst({
      where: { code: '1000' },
    });
    const openingBalance = cashAccount ? toNumber(cashAccount.balance) : 0;
    const netChange =
      operating.reduce((s, x) => s + x.amount, 0) +
      investing.reduce((s, x) => s + x.amount, 0) +
      financing.reduce((s, x) => s + x.amount, 0);

    return {
      period: q.period,
      operating,
      investing,
      financing,
      netChange,
      openingBalance,
      closingBalance: openingBalance + netChange,
    };
  }

  async expenseVsBudget(q: AccountsPeriodQueryDto) {
    const anchor = q.asOf ? new Date(q.asOf) : new Date();
    const window = getCurrentWindow(q.period, anchor);

    const budgets = await this.prisma.expenseBudget.findMany({
      where: {
        periodStart: { lte: window.end },
        periodEnd: { gte: window.start },
      },
    });

    const poByCategory = await this.prisma.purchasesPurchaseOrder.findMany({
      where: {
        createdAt: { gte: window.start, lte: window.end },
        status: { not: 'CANCELLED' },
      },
      select: { totalAmount: true },
    });

    const rows = budgets.map((b) => {
      const budget = toNumber(b.budgetAmount);
      const actual =
        b.category.toLowerCase().includes('suppl')
          ? poByCategory.reduce((s, p) => s + toNumber(p.totalAmount), 0)
          : 0;
      const variance = actual - budget;
      return {
        category: b.category,
        budget,
        actual,
        variance,
        variancePercent:
          budget > 0 ? Math.round((variance / budget) * 1000) / 10 : 0,
      };
    });

    return { rows };
  }

  async periodComparison(q: AccountsPeriodQueryDto) {
    const anchor = q.asOf ? new Date(q.asOf) : new Date();
    const cur = getCurrentWindow(q.period, anchor);
    const prev = getPreviousWindow(q.period, anchor);

    const [curRev, prevRev, curColl, prevColl, unpaidSummary] =
      await Promise.all([
        this.prisma.invoice.aggregate({
          where: { createdAt: { gte: cur.start, lte: cur.end } },
          _sum: { totalAmount: true },
        }),
        this.prisma.invoice.aggregate({
          where: { createdAt: { gte: prev.start, lte: prev.end } },
          _sum: { totalAmount: true },
        }),
        this.billingAnalytics.totalCashInRange(cur.start, cur.end),
        this.billingAnalytics.totalCashInRange(prev.start, prev.end),
        this.billingAnalytics.unpaidSummary(q.period, q.asOf),
      ]);

    const pct = (current: number, previous: number) =>
      previous > 0
        ? Math.round(((current - previous) / previous) * 1000) / 10
        : current > 0
          ? 100
          : 0;

    const revenueCurrent = toNumber(curRev._sum.totalAmount);
    const revenuePrevious = toNumber(prevRev._sum.totalAmount);
    const arCurrent = unpaidSummary.openStock.outstandingTotal;
    const arPrevious = unpaidSummary.outstandingAmount.previous;

    return {
      points: [
        {
          label: 'Revenue',
          current: revenueCurrent,
          previous: revenuePrevious,
          percentChange: pct(revenueCurrent, revenuePrevious),
        },
        {
          label: 'Collections',
          current: curColl,
          previous: prevColl,
          percentChange: pct(curColl, prevColl),
        },
        {
          label: 'Outstanding AR',
          current: arCurrent,
          previous: arPrevious,
          percentChange: pct(arCurrent, arPrevious),
        },
      ],
    };
  }
}
