import { Prisma } from '@prisma/client';
import { PharmacyReportsService } from './pharmacy-reports.service';

jest.mock('./pharmacy-sellable-stock.util', () => ({
  getSellableDrugBatchWhere: jest.fn().mockResolvedValue({
    quantityRemaining: { gt: 0 },
    expiryDate: { gte: new Date('2020-01-01') },
  }),
  mergeDrugBatchWhere: (...parts: unknown[]) => {
    const filtered = parts.filter((p) => p && Object.keys(p as object).length > 0);
    if (filtered.length === 0) return {};
    if (filtered.length === 1) return filtered[0];
    return { AND: filtered };
  },
}));

describe('PharmacyReportsService', () => {
  const prisma: any = {
    dispenseBatchAllocation: {
      findMany: jest.fn(),
    },
    invoiceItem: {
      findMany: jest.fn(),
    },
    drugBatch: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    pharmacyLocation: {
      findMany: jest.fn().mockResolvedValue([]),
    },
  };

  const service = new PharmacyReportsService(prisma);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.dispenseBatchAllocation.findMany.mockResolvedValue([
      {
        drugId: 'drug-1',
        invoiceItemId: 'item-1',
        locationId: 'loc-1',
        quantity: 4,
        unitCost: new Prisma.Decimal(50),
        unitSellingPrice: new Prisma.Decimal(100),
        payerType: 'Cash',
        dispensedAt: new Date('2026-06-01'),
        drug: {
          brandName: 'Amox',
          genericName: 'Amoxicillin',
          therapeuticClass: 'Antibiotic',
        },
        location: { name: 'Main Dispensary' },
      },
    ]);
    prisma.invoiceItem.findMany.mockResolvedValue([]);
    prisma.drugBatch.findMany.mockResolvedValue([
      {
        id: 'batch-1',
        drugId: 'drug-1',
        batchNumber: 'B1',
        expiryDate: new Date('2027-01-01'),
        quantityRemaining: 10,
        costPrice: new Prisma.Decimal(50),
        sellingPrice: new Prisma.Decimal(80),
        drug: { id: 'drug-1', brandName: 'Amox', genericName: 'Amoxicillin' },
        toLocation: { id: 'loc-1', name: 'Store', locationType: 'STORE' },
        supplier: { name: 'Supplier A' },
      },
    ]);
    prisma.drugBatch.count.mockResolvedValue(1);
  });

  it('groups sales breakdown by drug', async () => {
    const result = await service.getSalesBreakdown({ groupBy: 'drug' });

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].groupKey).toBe('drug-1');
    expect(result.rows[0].grossSales).toBe(400);
    expect(result.totals.grossProfit).toBe(200);
  });

  it('filters sales breakdown details by groupKey', async () => {
    prisma.dispenseBatchAllocation.findMany.mockResolvedValue([
      {
        drugId: 'drug-1',
        invoiceItemId: 'item-1',
        locationId: 'loc-1',
        quantity: 2,
        unitCost: new Prisma.Decimal(30),
        unitSellingPrice: new Prisma.Decimal(60),
        payerType: 'Cash',
        dispensedAt: new Date('2026-06-01'),
        drug: {
          brandName: 'Amox',
          genericName: 'Amoxicillin',
          therapeuticClass: 'Antibiotic',
        },
        batch: { batchNumber: 'BN-1' },
        location: { name: 'Main' },
        dispensedBy: { firstName: 'A', lastName: 'B' },
        invoiceItem: {
          id: 'item-1',
          invoice: {
            id: 'inv-1',
            invoiceID: 'INV-1',
            patient: { firstName: 'John', surname: 'Doe', patientId: 'P1' },
          },
        },
      },
      {
        drugId: 'drug-2',
        invoiceItemId: 'item-2',
        locationId: 'loc-1',
        quantity: 1,
        unitCost: new Prisma.Decimal(10),
        unitSellingPrice: new Prisma.Decimal(20),
        payerType: 'Cash',
        dispensedAt: new Date('2026-06-02'),
        drug: {
          brandName: 'Other',
          genericName: 'Other',
          therapeuticClass: 'Other',
        },
        batch: { batchNumber: 'BN-2' },
        location: { name: 'Main' },
        dispensedBy: null,
        invoiceItem: {
          id: 'item-2',
          invoice: {
            id: 'inv-2',
            invoiceID: 'INV-2',
            patient: { firstName: 'Jane', surname: 'Doe', patientId: 'P2' },
          },
        },
      },
    ]);

    const result = await service.getSalesBreakdownDetails({
      groupBy: 'drug',
      groupKey: 'drug-1',
    });

    expect(result.total).toBe(1);
    expect(result.rows[0]).toMatchObject({
      profitUnknown: false,
      drugName: 'Amox',
      batchNumber: 'BN-1',
    });
  });

  it('returns inventory valuation totals', async () => {
    const result = await service.getInventoryValuation({});

    expect(result.totals.batchCount).toBe(1);
    expect(result.totals.valueAtCost).toBe(500);
    expect(result.stores[0].locationName).toBe('Store');
  });
});
