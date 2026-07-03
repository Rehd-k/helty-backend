import { Prisma } from '@prisma/client';
import { PharmacyHeadDashboardService } from './pharmacy-head-dashboard.service';
import { marginPercent } from './pharmacy-profit.util';

describe('PharmacyHeadDashboardService', () => {
  const prisma: any = {
    dispenseBatchAllocation: {
      findMany: jest.fn(),
    },
    invoiceItem: {
      aggregate: jest.fn(),
      count: jest.fn(),
    },
    drugBatch: {
      groupBy: jest.fn(),
      findMany: jest.fn(),
    },
    drug: {
      findMany: jest.fn(),
    },
    pharmacyLocation: {
      findMany: jest.fn().mockResolvedValue([]),
    },
  };

  const service = new PharmacyHeadDashboardService(prisma);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.dispenseBatchAllocation.findMany.mockResolvedValue([
      {
        quantity: 10,
        unitCost: new Prisma.Decimal(60),
        unitSellingPrice: new Prisma.Decimal(100),
        invoiceItemId: 'item-1',
      },
      {
        quantity: 5,
        unitCost: new Prisma.Decimal(40),
        unitSellingPrice: new Prisma.Decimal(80),
        invoiceItemId: 'item-2',
      },
    ]);
    prisma.invoiceItem.aggregate.mockResolvedValue({
      _sum: { amountPaid: new Prisma.Decimal(1400) },
    });
    prisma.invoiceItem.count.mockResolvedValue(3);
    prisma.drugBatch.groupBy.mockResolvedValue([
      { drugId: 'd1', _sum: { quantityRemaining: 0 } },
      { drugId: 'd2', _sum: { quantityRemaining: 5 } },
    ]);
    prisma.drug.findMany.mockResolvedValue([
      { id: 'd1', reorderLevel: 10 },
      { id: 'd2', reorderLevel: 10 },
    ]);
    prisma.drugBatch.findMany.mockResolvedValue([
      {
        quantityRemaining: 5,
        costPrice: new Prisma.Decimal(100),
        sellingPrice: new Prisma.Decimal(150),
        expiryDate: new Date('2027-01-01'),
      },
    ]);
  });

  it('computes head summary profit from allocations', async () => {
    const result = await service.getHeadSummary({});

    expect(result.totalSales).toBe(1400);
    expect(result.totalCogs).toBe(800);
    expect(result.grossProfit).toBe(600);
    expect(result.grossMarginPercent).toBe(marginPercent(1400, 600));
    expect(result.transactionCount).toBe(2);
    expect(result.profitUnknownCount).toBe(3);
    expect(result.netCollections).toBe(1400);
  });

  it('returns zero margin when sales are zero', () => {
    expect(marginPercent(0, 0)).toBe(0);
  });

  it('builds sales-profit chart buckets', async () => {
    const dispensedAt = new Date('2026-06-15T12:00:00.000Z');
    prisma.dispenseBatchAllocation.findMany.mockResolvedValue([
      {
        quantity: 2,
        unitCost: new Prisma.Decimal(50),
        unitSellingPrice: new Prisma.Decimal(100),
        dispensedAt,
      },
    ]);

    const points = await service.getSalesProfitChart({
      fromDate: '2026-06-15',
      toDate: '2026-06-15',
    });

    expect(points.length).toBeGreaterThan(0);
    expect(points.some((p) => p.grossSales === 200)).toBe(true);
  });
});
