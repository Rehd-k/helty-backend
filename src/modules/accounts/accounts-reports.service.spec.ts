import { BadRequestException } from '@nestjs/common';
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
      invoiceItemPayment: {
        findMany: jest.fn(),
        count: jest.fn(),
        aggregate: jest.fn(),
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

  describe('revenueByService', () => {
    it('filters allocations by custom date range', async () => {
      prisma.invoiceItemPayment.findMany.mockResolvedValue([]);

      await service.revenueByService({
        period: 'custom',
        from: '2025-12-31T23:00:00.000Z',
        to: '2026-07-12T22:59:59.999Z',
      });

      const findManyCall = prisma.invoiceItemPayment.findMany.mock.calls[0][0];
      expect(findManyCall.where.invoicePayment.paidAt).toEqual({
        gte: new Date('2025-12-31T23:00:00.000Z'),
        lte: new Date('2026-07-12T22:59:59.999Z'),
      });
    });
  });

  describe('revenueByServiceDetails', () => {
    const sampleAllocation = {
      id: 'alloc-1',
      amount: new Prisma.Decimal(15000),
      invoicePayment: {
        id: 'pay-1',
        paidAt: new Date('2026-06-15T10:30:00Z'),
        source: 'CASH',
        method: 'CASH',
        reference: null,
        receivedBy: {
          firstName: 'Jane',
          lastName: 'Accountant',
          email: null,
          staffId: 'STF-01',
        },
      },
      invoiceItem: {
        quantity: 1,
        unitPrice: new Prisma.Decimal(15000),
        customDescription: null,
        invoice: {
          id: 'inv-1',
          invoiceID: 'INV-2026-0042',
          encounterId: 'enc-1',
          patient: {
            id: 'pat-1',
            patientId: 'P-00123',
            title: 'Mr',
            firstName: 'John',
            otherName: null,
            surname: 'Doe',
            gender: 'Male',
            dob: new Date('1990-01-01'),
            phoneNumber: '+2348012345678',
          },
        },
        service: {
          id: 'svc-1',
          name: 'Full Blood Count',
          category: { name: 'Laboratory' },
        },
      },
    };

    beforeEach(() => {
      prisma.invoiceItemPayment.findMany.mockResolvedValue([sampleAllocation]);
      prisma.invoiceItemPayment.count.mockResolvedValue(1);
      prisma.invoiceItemPayment.aggregate.mockResolvedValue({
        _sum: { amount: new Prisma.Decimal(15000) },
      });
    });

    it('returns paginated payment rows for a service category', async () => {
      const result = await service.revenueByServiceDetails({
        period: 'month',
        serviceCategory: 'Laboratory',
        skip: 0,
        take: 50,
      });

      expect(result.serviceCategory).toBe('Laboratory');
      expect(result.total).toBe(1);
      expect(result.totalAmount).toBe(15000);
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]).toMatchObject({
        allocationId: 'alloc-1',
        amount: 15000,
        patient: {
          id: 'pat-1',
          patientId: 'P-00123',
          displayName: 'Mr John Doe',
          phoneNumber: '+2348012345678',
        },
        invoice: { id: 'inv-1', invoiceID: 'INV-2026-0042' },
        service: {
          id: 'svc-1',
          name: 'Full Blood Count',
          categoryName: 'Laboratory',
        },
        payment: {
          id: 'pay-1',
          source: 'CASH',
          receivedBy: 'Jane Accountant',
        },
        encounterId: 'enc-1',
      });
      expect(result.rows[0].paidAt).toBe('2026-06-15T10:30:00.000Z');

      const findManyCall = prisma.invoiceItemPayment.findMany.mock.calls[0][0];
      expect(findManyCall.skip).toBe(0);
      expect(findManyCall.take).toBe(50);
      expect(findManyCall.orderBy).toEqual({
        invoicePayment: { paidAt: 'desc' },
      });
      expect(findManyCall.where.invoiceItem.service).toEqual({
        OR: [
          { category: { name: 'Laboratory' } },
          { category: null, name: 'Laboratory' },
        ],
      });
    });

    it('applies search filter when q is provided', async () => {
      await service.revenueByServiceDetails({
        period: 'month',
        serviceCategory: 'Laboratory',
        q: 'john',
      });

      const findManyCall = prisma.invoiceItemPayment.findMany.mock.calls[0][0];
      expect(findManyCall.where.AND).toHaveLength(2);
      expect(findManyCall.where.AND[1].OR).toEqual(
        expect.arrayContaining([
          {
            invoiceItem: {
              invoice: { patient: { firstName: { contains: 'john', mode: 'insensitive' } } },
            },
          },
        ]),
      );
    });

    it('throws when serviceCategory is missing', async () => {
      await expect(
        service.revenueByServiceDetails({
          period: 'month',
          serviceCategory: '   ',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('returns from/to metadata for custom period', async () => {
      const result = await service.revenueByServiceDetails({
        period: 'custom',
        from: '2025-12-31T23:00:00.000Z',
        to: '2026-07-12T22:59:59.999Z',
        serviceCategory: 'Laboratory',
      });

      expect(result.period).toBe('custom');
      expect(result.from).toBe('2025-12-31T23:00:00.000Z');
      expect(result.to).toBe('2026-07-12T22:59:59.999Z');
      expect(result).not.toHaveProperty('asOf');
    });
  });
});
