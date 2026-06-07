import { Prisma } from '@prisma/client';
import { AccountsReportsService } from './accounts-reports.service';

describe('AccountsReportsService', () => {
  const billingAnalytics = {
    totalCashInRange: jest.fn().mockResolvedValue(0),
    unpaidSummary: jest.fn(),
  };

  function createPrismaMock() {
    return {
      invoicePayment: {
        findMany: jest.fn().mockResolvedValue([
          {
            paidAt: new Date('2026-06-07T10:00:00Z'),
            amount: new Prisma.Decimal(100000),
            source: 'CASH',
          },
          {
            paidAt: new Date('2026-06-07T14:00:00Z'),
            amount: new Prisma.Decimal(50000),
            source: 'CARD',
          },
          {
            paidAt: new Date('2026-06-08T09:00:00Z'),
            amount: new Prisma.Decimal(80000),
            source: 'CASH',
          },
        ]),
      },
      invoiceCoverage: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'c1',
            kind: 'HMO',
            hmoId: 'hmo-1',
            payerStaffId: null,
            amount: new Prisma.Decimal(50000),
            createdAt: new Date('2026-05-01'),
            hmo: { id: 'hmo-1', name: 'NHIS Plan A' },
            payer: null,
          },
          {
            id: 'c2',
            kind: 'HMO',
            hmoId: 'hmo-1',
            payerStaffId: null,
            amount: new Prisma.Decimal(20000),
            createdAt: new Date('2026-06-05'),
            hmo: { id: 'hmo-1', name: 'NHIS Plan A' },
            payer: null,
          },
        ]),
      },
    };
  }

  let prisma: ReturnType<typeof createPrismaMock>;
  let service: AccountsReportsService;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new AccountsReportsService(prisma as any, billingAnalytics as any);
  });

  describe('dailyCollections', () => {
    it('groups payments by date and source', async () => {
      const result = await service.dailyCollections({
        from: '2026-06-07',
        to: '2026-06-08',
      });

      expect(result.rows).toHaveLength(2);
      const day7 = result.rows.find((r) => r.date === '2026-06-07');
      expect(day7).toMatchObject({
        cash: 100000,
        card: 50000,
        total: 150000,
        transactionCount: 2,
      });
      const day8 = result.rows.find((r) => r.date === '2026-06-08');
      expect(day8?.cash).toBe(80000);
    });
  });

  describe('aging', () => {
    it('aggregates HMO receivables into aging buckets by party', async () => {
      const result = await service.aging({ type: 'hmo' });

      expect(result.totalOutstanding).toBe(70000);
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].partyName).toBe('NHIS Plan A');
      expect(result.rows[0].totalDue).toBe(70000);
      expect(result.buckets.length).toBeGreaterThan(0);
    });
  });
});
