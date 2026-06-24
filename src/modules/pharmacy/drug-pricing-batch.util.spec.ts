import { Prisma } from '@prisma/client';
import {
  computeDrugUnitPrice,
  loadDrugWithLatestCost,
} from './drug-pricing-batch.util';

describe('drug-pricing-batch.util', () => {
  const drugId = 'drug-1';

  function createTx(options: {
    drug?: { id: string; genericName: string } | null;
    latestBatch?: { costPrice: Prisma.Decimal } | null;
  }) {
    const drugBatchFindFirst = jest.fn().mockResolvedValue(options.latestBatch ?? null);
    return {
      drug: {
        findUnique: jest.fn().mockResolvedValue(options.drug ?? null),
      },
      drugBatch: {
        findFirst: drugBatchFindFirst,
      },
      drugBatchFindFirst,
    };
  }

  it('loads latest batch cost ordered by createdAt then id desc', async () => {
    const tx = createTx({
      drug: { id: drugId, genericName: 'Paracetamol' },
      latestBatch: { costPrice: new Prisma.Decimal(500) },
    });
    const result = await loadDrugWithLatestCost(tx as any, drugId);
    expect(result.latestCost?.toString()).toBe('500');
    expect(tx.drugBatchFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
    );
  });

  it('returns null latestCost when drug has no batches', async () => {
    const tx = createTx({
      drug: { id: drugId, genericName: 'Paracetamol' },
      latestBatch: null,
    });
    const result = await loadDrugWithLatestCost(tx as any, drugId);
    expect(result.latestCost).toBeNull();
  });

  it('computeDrugUnitPrice returns 0 when no cost history', () => {
    const unitPrice = computeDrugUnitPrice(
      { id: drugId, genericName: 'Paracetamol', latestCost: null },
      new Prisma.Decimal(2),
    );
    expect(unitPrice.toString()).toBe('0');
  });

  it('computeDrugUnitPrice returns 0 when latest cost is zero', () => {
    const unitPrice = computeDrugUnitPrice(
      {
        id: drugId,
        genericName: 'Paracetamol',
        latestCost: new Prisma.Decimal(0),
      },
      new Prisma.Decimal(2),
    );
    expect(unitPrice.toString()).toBe('0');
  });

  it('computeDrugUnitPrice multiplies latest cost by ward multiplier', () => {
    const unitPrice = computeDrugUnitPrice(
      {
        id: drugId,
        genericName: 'Paracetamol',
        latestCost: new Prisma.Decimal(1200),
      },
      new Prisma.Decimal(2),
    );
    expect(unitPrice.toString()).toBe('2400');
  });
});
