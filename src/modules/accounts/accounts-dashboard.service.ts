import { BadRequestException, Injectable } from '@nestjs/common';
import {
  FinanceApprovalStatus,
  InvoiceCoverageKind,
  InvoiceCoverageStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  getCurrentWindow,
  type AnalyticsPeriod,
} from '../billing-analytics/billing-analytics-period';
import { BillingAnalyticsService } from '../billing-analytics/billing-analytics.service';
import { isAccountHead, staffLabel, toNumber } from './accounts.utils';
import { AccountsPeriodQueryDto } from './dto/accounts-query.dto';
import { AccountsAuditService } from './accounts-audit.service';

const FINANCE_ACTIVITY_ACTIONS = new Set([
  'PAYMENT_RECEIVED',
  'PAYMENT_VOIDED',
  'REFUND_ISSUED',
  'WALLET_DEPOSIT',
  'COVERAGE_APPLIED',
  'COVERAGE_REVERSED',
  'COVERAGE_REMITTANCE_RECORDED',
]);

@Injectable()
export class AccountsDashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly billingAnalytics: BillingAnalyticsService,
    private readonly auditService: AccountsAuditService,
  ) {}

  async getDashboard(q: AccountsPeriodQueryDto, staffRole?: string) {
    const period = q.period as AnalyticsPeriod;
    const anchor = q.asOf ? new Date(q.asOf) : new Date();
    if (q.asOf && Number.isNaN(anchor.getTime())) {
      throw new BadRequestException('Invalid asOf date');
    }
    const window = getCurrentWindow(period, anchor);
    const head = isAccountHead(staffRole);

    const [
      grossRevenue,
      netCollections,
      unpaid,
      overdue,
      hmoRec,
      discountRec,
      walletFloat,
      pendingApprovals,
      recentPaymentsCount,
      remittancesDue,
      paymentMix,
      auditFeed,
      leakCount,
    ] = await Promise.all([
      this.prisma.invoice.aggregate({
        where: { createdAt: { gte: window.start, lte: window.end } },
        _sum: { totalAmount: true },
      }),
      this.billingAnalytics.totalCashInRange(window.start, window.end),
      this.billingAnalytics.unpaidSummary(period, q.asOf),
      this.billingAnalytics.overdueSummary(period, q.asOf),
      this.prisma.invoiceCoverage.aggregate({
        where: {
          kind: InvoiceCoverageKind.HMO,
          status: InvoiceCoverageStatus.APPLIED,
        },
        _sum: { amount: true },
      }),
      this.prisma.invoiceCoverage.aggregate({
        where: {
          kind: InvoiceCoverageKind.DISCOUNT,
          status: InvoiceCoverageStatus.APPLIED,
        },
        _sum: { amount: true },
      }),
      this.prisma.patientWallet.aggregate({ _sum: { balance: true } }),
      head
        ? this.prisma.financeApproval.count({
            where: { status: FinanceApprovalStatus.pending },
          })
        : Promise.resolve(0),
      this.prisma.invoicePayment.count({
        where: { paidAt: { gte: window.start, lte: window.end } },
      }),
      this.sumRemittancesDue(),
      this.paymentMix(window.start, window.end),
      this.activityFeed(head),
      head ? this.auditService.leakCount() : Promise.resolve(0),
    ]);

    const mixTotal = paymentMix.reduce((s, m) => s + m.amount, 0);
    const paymentMixSnapshot = paymentMix.map((m) => ({
      ...m,
      percent:
        mixTotal > 0 ? Math.round((m.amount / mixTotal) * 1000) / 10 : 0,
    }));

    const result: Record<string, unknown> = {
      grossRevenue: toNumber(grossRevenue._sum.totalAmount),
      netCollections,
      outstandingAr: unpaid.openStock.outstandingTotal,
      overdueAmount: overdue.overdueStock.outstandingTotal,
      hmoReceivables: toNumber(hmoRec._sum.amount),
      discountReceivables: toNumber(discountRec._sum.amount),
      walletFloat: toNumber(walletFloat._sum.balance),
      recentPaymentsCount,
      remittancesDue,
      paymentMixSnapshot,
      activityFeed: auditFeed,
    };

    if (head) {
      result.pendingApprovalsCount = pendingApprovals;
      result.leakAlertsCount = leakCount;
    }

    return result;
  }

  private async sumRemittancesDue(): Promise<number> {
    const applied = await this.prisma.invoiceCoverage.aggregate({
      where: { status: InvoiceCoverageStatus.APPLIED },
      _sum: { amount: true },
    });
    return toNumber(applied._sum.amount);
  }

  private async paymentMix(start: Date, end: Date) {
    const grouped = await this.prisma.invoicePayment.groupBy({
      by: ['source'],
      where: { paidAt: { gte: start, lte: end } },
      _sum: { amount: true },
    });
    return grouped.map((g) => ({
      method: g.source.toLowerCase(),
      amount: toNumber(g._sum.amount),
    }));
  }

  private async activityFeed(head: boolean) {
    const logs = await this.prisma.invoiceAuditLog.findMany({
      where: head
        ? undefined
        : { action: { in: [...FINANCE_ACTIVITY_ACTIONS] as Prisma.EnumInvoiceAuditActionFilter['in'] } },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        performedBy: {
          select: {
            email: true,
            staffId: true,
            firstName: true,
            lastName: true,
          },
        },
        invoice: { select: { invoiceID: true } },
      },
    });

    return logs.map((log) => ({
      id: log.id,
      at: log.createdAt.toISOString(),
      category: log.action.toLowerCase().includes('payment')
        ? 'payment'
        : 'finance',
      message: log.description,
      actorLabel: staffLabel(log.performedBy),
      amount:
        typeof log.metadata === 'object' &&
        log.metadata &&
        'amount' in log.metadata
          ? toNumber(Number((log.metadata as { amount?: unknown }).amount))
          : null,
    }));
  }
}
