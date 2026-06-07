import { Prisma } from '@prisma/client';
import { AccountsDashboardService } from './accounts-dashboard.service';

describe('AccountsDashboardService', () => {
  const billingAnalytics = {
    totalCashInRange: jest.fn().mockResolvedValue(1180000),
    unpaidSummary: jest.fn().mockResolvedValue({
      openStock: { outstandingTotal: 380000 },
    }),
    overdueSummary: jest.fn().mockResolvedValue({
      overdueStock: { outstandingTotal: 95000 },
    }),
  };

  const auditService = {
    leakCount: jest.fn().mockResolvedValue(2),
  };

  function createPrismaMock() {
    return {
      invoice: { aggregate: jest.fn().mockResolvedValue({ _sum: { totalAmount: new Prisma.Decimal(1250000) } }) },
      invoiceCoverage: {
        aggregate: jest
          .fn()
          .mockResolvedValueOnce({ _sum: { amount: new Prisma.Decimal(240000) } })
          .mockResolvedValueOnce({ _sum: { amount: new Prisma.Decimal(45000) } })
          .mockResolvedValueOnce({ _sum: { amount: new Prisma.Decimal(180000) } }),
      },
      patientWallet: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { balance: new Prisma.Decimal(120000) } }),
      },
      financeApproval: { count: jest.fn().mockResolvedValue(3) },
      invoicePayment: {
        count: jest.fn().mockResolvedValue(87),
        groupBy: jest.fn().mockResolvedValue([
          { source: 'CASH', _sum: { amount: new Prisma.Decimal(400000) } },
          { source: 'CARD', _sum: { amount: new Prisma.Decimal(350000) } },
        ]),
      },
      invoiceAuditLog: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
  }

  let prisma: ReturnType<typeof createPrismaMock>;
  let service: AccountsDashboardService;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new AccountsDashboardService(
      prisma as any,
      billingAnalytics as any,
      auditService as any,
    );
  });

  it('includes head-only fields for ACCOUNT_HEAD', async () => {
    const result = await service.getDashboard(
      { period: 'month' },
      'ACCOUNT_HEAD',
    );

    expect(result.pendingApprovalsCount).toBe(3);
    expect(result.leakAlertsCount).toBe(2);
    expect(result.grossRevenue).toBe(1250000);
    expect(result.netCollections).toBe(1180000);
  });

  it('omits head-only fields for ACCOUNTING_STAFF', async () => {
    const result = await service.getDashboard(
      { period: 'month' },
      'ACCOUNTING_STAFF',
    );

    expect(result.pendingApprovalsCount).toBeUndefined();
    expect(result.leakAlertsCount).toBeUndefined();
    expect(result.grossRevenue).toBe(1250000);
  });
});
