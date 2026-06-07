import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CmdComplianceStatus,
  FinanceReconciliationStatus,
  InvoiceAuditAction,
  Prisma,
} from '@prisma/client';
import { parseDateRange } from '../../common/utils/date-range';
import { PrismaService } from '../../prisma/prisma.service';
import {
  getCurrentWindow,
  type AnalyticsPeriod,
} from '../billing-analytics/billing-analytics-period';
import { INVOICE_CHANGE_ACTIONS } from './accounts.constants';
import {
  ageDays,
  assertAccountHead,
  isAccountHead,
  staffLabel,
  toNumber,
} from './accounts.utils';
import {
  AccountsAuditLogsQueryDto,
  AccountsInvoiceChangesQueryDto,
  AccountsPeriodQueryDto,
} from './dto/accounts-query.dto';
import { AcknowledgeComplianceDto } from './dto/accounts-body.dto';

const FINANCE_AUDIT_ENTITY_PREFIX: Record<string, string> = {
  invoice: 'invoice',
  payment: 'payment',
  receivable: 'receivable',
  remittance: 'remittance',
  wallet: 'wallet',
};

@Injectable()
export class AccountsAuditService {
  constructor(private readonly prisma: PrismaService) {}

  async auditLogs(q: AccountsAuditLogsQueryDto) {
    const skip = Number(q.skip ?? 0);
    const take = Math.min(Number(q.take ?? 50), 100);
    const { from, to } = parseDateRange(q.fromDate, q.toDate);

    const where: Prisma.InvoiceAuditLogWhereInput = {
      createdAt: { gte: from, lte: to },
      ...(q.action
        ? { action: q.action as InvoiceAuditAction }
        : {}),
    };

    if (q.user?.trim()) {
      const needle = q.user.trim();
      where.performedBy = {
        OR: [
          { email: { contains: needle, mode: 'insensitive' } },
          { staffId: { contains: needle, mode: 'insensitive' } },
          { firstName: { contains: needle, mode: 'insensitive' } },
          { lastName: { contains: needle, mode: 'insensitive' } },
          { id: needle },
        ],
      };
    }

    const [logs, total] = await Promise.all([
      this.prisma.invoiceAuditLog.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          performedBy: {
            select: { email: true, staffId: true, firstName: true, lastName: true },
          },
          invoice: { select: { id: true, invoiceID: true } },
        },
      }),
      this.prisma.invoiceAuditLog.count({ where }),
    ]);

    let mapped: Array<{
      id: string;
      at: string;
      user: string;
      action: string;
      entity: string;
      metadata: string;
    }> = logs.map((x) => ({
      id: x.id,
      at: x.createdAt.toISOString(),
      user: staffLabel(x.performedBy),
      action: x.action,
      entity: `invoice:${x.invoiceId}`,
      metadata: x.description,
    }));

    if (q.entity && FINANCE_AUDIT_ENTITY_PREFIX[q.entity]) {
      mapped = mapped.filter((l) =>
        l.entity.startsWith(FINANCE_AUDIT_ENTITY_PREFIX[q.entity!]),
      );
    }

    const genericLogs =
      q.entity && q.entity !== 'invoice'
        ? await this.prisma.auditLog.findMany({
            where: {
              createdAt: { gte: from, lte: to },
              entity: { equals: q.entity, mode: 'insensitive' },
              ...(q.action ? { action: q.action } : {}),
            },
            take: take - mapped.length,
            orderBy: { createdAt: 'desc' },
            include: { performedBy: true },
          })
        : [];

    for (const x of genericLogs) {
      mapped.push({
        id: x.id,
        at: x.createdAt.toISOString(),
        user: staffLabel(x.performedBy),
        action: x.action,
        entity: `${x.entity}:${x.entityId}`,
        metadata:
          typeof x.newValue === 'string'
            ? x.newValue
            : JSON.stringify(x.newValue ?? x.oldValue),
      });
    }

    return { logs: mapped, total, compliance: [] };
  }

  async complianceChecklist(staffRole?: string) {
    const items = await this.prisma.financeComplianceItem.findMany({
      orderBy: { code: 'asc' },
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [dailyRecon, latestBankRecon] = await Promise.all([
      this.prisma.dailyCashReconciliation.findUnique({
        where: { date: today },
      }),
      this.prisma.bankReconciliation.findFirst({
        orderBy: { statementDate: 'desc' },
      }),
    ]);

    const head = isAccountHead(staffRole);

    return {
      compliance: items.map((item) => {
        let computedStatus = item.status;
        let lastCheckedAt = item.lastCheckedAt?.toISOString() ?? null;

        if (item.code === 'FIN-001') {
          const ok =
            dailyRecon?.status === FinanceReconciliationStatus.closed ||
            dailyRecon?.status === FinanceReconciliationStatus.submitted;
          computedStatus = ok
            ? CmdComplianceStatus.Compliant
            : CmdComplianceStatus.NonCompliant;
          lastCheckedAt = dailyRecon?.updatedAt.toISOString() ?? null;
        } else if (item.code === 'FIN-002') {
          const ok =
            latestBankRecon &&
            ageDays(latestBankRecon.statementDate, new Date()) <= 30 &&
            latestBankRecon.status !== FinanceReconciliationStatus.open;
          computedStatus = ok
            ? CmdComplianceStatus.Compliant
            : CmdComplianceStatus.NonCompliant;
          lastCheckedAt = latestBankRecon?.updatedAt.toISOString() ?? null;
        }

        const nonCompliant =
          computedStatus === CmdComplianceStatus.NonCompliant;

        return {
          code: item.code,
          description: item.description,
          status:
            computedStatus === CmdComplianceStatus.Compliant
              ? 'Compliant'
              : computedStatus === CmdComplianceStatus.NonCompliant
                ? 'Non-compliant'
                : 'Pending',
          lastCheckedAt,
          canAcknowledge: head && nonCompliant,
        };
      }),
    };
  }

  async acknowledgeCompliance(
    code: string,
    dto: AcknowledgeComplianceDto,
    staffRole?: string,
  ) {
    assertAccountHead(staffRole);
    const item = await this.prisma.financeComplianceItem.findUnique({
      where: { code },
    });
    if (!item) throw new NotFoundException(`Compliance item ${code} not found`);

    return this.prisma.financeComplianceItem.update({
      where: { code },
      data: {
        status: dto.status,
        note: dto.note,
        acknowledgedAt: new Date(),
        lastCheckedAt: new Date(),
      },
    });
  }

  async invoiceChanges(q: AccountsInvoiceChangesQueryDto) {
    const skip = Number(q.skip ?? 0);
    const take = Math.min(Number(q.take ?? 50), 100);
    const { from, to } = parseDateRange(q.fromDate, q.toDate);
    const needle = q.query?.trim();

    const where: Prisma.InvoiceAuditLogWhereInput = {
      createdAt: { gte: from, lte: to },
      action: { in: [...INVOICE_CHANGE_ACTIONS] as InvoiceAuditAction[] },
      ...(needle
        ? {
            OR: [
              { description: { contains: needle, mode: 'insensitive' } },
              { invoice: { invoiceID: { contains: needle, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const rows = await this.prisma.invoiceAuditLog.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        performedBy: { select: { email: true, staffId: true } },
        invoice: { select: { id: true, invoiceID: true } },
      },
    });

    return {
      changes: rows.map((r) => ({
        id: r.id,
        invoiceId: r.invoiceId,
        invoiceNumber: r.invoice.invoiceID,
        changedAt: r.createdAt.toISOString(),
        changedBy: r.performedBy?.email ?? r.performedBy?.staffId ?? 'system',
        changeType: r.action,
        detail: r.description,
      })),
    };
  }

  async leakDetection() {
    const since = new Date();
    since.setDate(since.getDate() - 7);

    const [usageEvents, dialysisConsumables, unbilledLines] = await Promise.all([
      this.prisma.consumableUsageEvent.findMany({
        where: { createdAt: { gte: since }, direction: 'USE' },
        include: {
          allocations: { select: { invoiceItemId: true } },
        },
      }),
      this.prisma.dialysisSessionConsumable.findMany({
        where: {
          createdAt: { gte: since },
          invoiceItemId: null,
        },
        include: { consumable: { select: { name: true } } },
      }),
      this.prisma.invoiceItem.findMany({
        where: {
          dispensedAt: { not: null },
          amountPaid: { equals: 0 },
          invoice: {
            status: { in: ['PENDING', 'PARTIALLY_PAID'] },
          },
        },
        select: {
          id: true,
          quantity: true,
          unitPrice: true,
          customDescription: true,
        },
      }),
    ]);

    const leaks: Array<{
      id: string;
      title: string;
      description: string;
      estimatedExposure: number;
      severity: string;
    }> = [];

    const unbilledUsage = usageEvents.filter(
      (e) => !e.allocations.some((a) => a.invoiceItemId),
    );
    if (unbilledUsage.length) {
      leaks.push({
        id: 'leak-consumable-usage',
        title: 'Unbilled consumables',
        description: `Consumables issued without invoice line in last 7 days (${unbilledUsage.length} events)`,
        estimatedExposure: unbilledUsage.length * 5000,
        severity: 'high',
      });
    }

    if (dialysisConsumables.length) {
      const exposure = dialysisConsumables.reduce(
        (s, c) => s + toNumber(c.unitPrice) * c.quantity,
        0,
      );
      leaks.push({
        id: 'leak-dialysis-consumables',
        title: 'Dialysis consumables not invoiced',
        description: `${dialysisConsumables.length} dialysis consumable(s) without invoice line`,
        estimatedExposure: exposure,
        severity: exposure > 20000 ? 'high' : 'medium',
      });
    }

    if (unbilledLines.length) {
      const exposure = unbilledLines.reduce(
        (s, l) => s + toNumber(l.unitPrice) * l.quantity,
        0,
      );
      leaks.push({
        id: 'leak-dispensed-unpaid',
        title: 'Dispensed items unpaid',
        description: `${unbilledLines.length} dispensed line(s) with zero payment on open invoices`,
        estimatedExposure: exposure,
        severity: 'medium',
      });
    }

    return { leaks };
  }

  async leakCount(): Promise<number> {
    const { leaks } = await this.leakDetection();
    return leaks.length;
  }

  async staffActivity(q: AccountsPeriodQueryDto) {
    const anchor = q.asOf ? new Date(q.asOf) : new Date();
    if (q.asOf && Number.isNaN(anchor.getTime())) {
      throw new BadRequestException('Invalid asOf date');
    }
    const window = getCurrentWindow(q.period as AnalyticsPeriod, anchor);

    const accountingStaff = await this.prisma.staff.findMany({
      where: { accountType: 'ACCOUNTING', isActive: true },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        staffRole: true,
      },
    });

    const [payments, refunds, remittances] = await Promise.all([
      this.prisma.invoicePayment.groupBy({
        by: ['receivedById'],
        where: {
          paidAt: { gte: window.start, lte: window.end },
          receivedById: { not: null },
        },
        _sum: { amount: true },
        _count: { id: true },
      }),
      this.prisma.invoiceRefund.groupBy({
        by: ['processedById'],
        where: { refundedAt: { gte: window.start, lte: window.end } },
        _count: { id: true },
      }),
      this.prisma.coverageRemittance.groupBy({
        by: ['receivedById'],
        where: { paidAt: { gte: window.start, lte: window.end } },
        _count: { id: true },
      }),
    ]);

    const paymentMap = new Map(
      payments.map((p) => [
        p.receivedById!,
        { count: p._count.id, total: toNumber(p._sum.amount) },
      ]),
    );
    const refundMap = new Map(
      refunds.map((r) => [r.processedById, r._count.id]),
    );
    const remittanceMap = new Map(
      remittances.map((r) => [r.receivedById, r._count.id]),
    );

    const staffIds = new Set([
      ...accountingStaff.map((s) => s.id),
      ...paymentMap.keys(),
      ...refundMap.keys(),
      ...remittanceMap.keys(),
    ]);

    const allStaff = await this.prisma.staff.findMany({
      where: { id: { in: [...staffIds].filter(Boolean) as string[] } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        staffRole: true,
        accountType: true,
      },
    });

    return {
      rows: allStaff
        .filter(
          (s) =>
            s.accountType === 'ACCOUNTING' ||
            paymentMap.has(s.id) ||
            refundMap.has(s.id),
        )
        .map((s) => ({
          staffId: s.id,
          staffName: `${s.firstName ?? ''} ${s.lastName ?? ''}`.trim(),
          role: s.staffRole,
          paymentsRecorded: paymentMap.get(s.id)?.count ?? 0,
          totalCollected: paymentMap.get(s.id)?.total ?? 0,
          refundsInitiated: refundMap.get(s.id) ?? 0,
          remittancesRecorded: remittanceMap.get(s.id) ?? 0,
        }))
        .sort((a, b) => b.totalCollected - a.totalCollected),
    };
  }
}
