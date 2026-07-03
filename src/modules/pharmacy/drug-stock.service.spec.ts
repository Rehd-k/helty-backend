import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DrugStockService } from './drug-stock.service';

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

describe('DrugStockService', () => {
  const drugId = 'drug-1';
  const locationId = 'loc-1';
  const service = new DrugStockService();

  it('getAvailableQuantity sums sellable batch quantities at location', async () => {
    const tx: any = {
      pharmacyLocation: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      drugBatch: {
        findMany: jest.fn().mockResolvedValue([
          { quantityRemaining: 3 },
          { quantityRemaining: 5 },
        ]),
      },
    };

    const qty = await service.getAvailableQuantity(tx, drugId, locationId);

    expect(qty).toBe(8);
  });

  it('deductDrugStockFifo throws when insufficient stock', async () => {
    const tx: any = {
      drugBatch: {
        findMany: jest.fn().mockResolvedValue([{ id: 'b1', quantityRemaining: 2 }]),
        update: jest.fn(),
      },
    };

    await expect(
      service.deductDrugStockFifo(tx, drugId, 5, locationId),
    ).rejects.toThrow(BadRequestException);
  });

  it('deductDrugStockFifo decrements batches in FIFO order', async () => {
    const tx: any = {
      drugBatch: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'b1', quantityRemaining: 2 },
          { id: 'b2', quantityRemaining: 5 },
        ]),
        update: jest.fn().mockResolvedValue({}),
      },
    };

    await service.deductDrugStockFifo(tx, drugId, 4, locationId);

    expect(tx.drugBatch.update).toHaveBeenCalledTimes(2);
    expect(tx.drugBatch.update).toHaveBeenNthCalledWith(1, {
      where: { id: 'b1' },
      data: { quantityRemaining: 0 },
    });
    expect(tx.drugBatch.update).toHaveBeenNthCalledWith(2, {
      where: { id: 'b2' },
      data: { quantityRemaining: 3 },
    });
  });

  it('applyFifoOut creates allocations and inventory movements', async () => {
    const batch = {
      id: 'b1',
      quantityRemaining: 5,
      costPrice: new Prisma.Decimal(50),
    };
    const tx: any = {
      drugBatch: {
        findMany: jest.fn().mockResolvedValue([batch]),
        findUnique: jest.fn().mockResolvedValue(batch),
        update: jest.fn().mockResolvedValue({}),
      },
      dispenseBatchAllocation: {
        create: jest.fn().mockResolvedValue({}),
      },
      inventoryMovement: {
        create: jest.fn().mockResolvedValue({}),
      },
    };

    await service.applyFifoOut(tx, {
      drugId,
      locationId,
      quantity: 3,
      ctx: {
        invoiceItemId: 'item-1',
        unitSellingPrice: new Prisma.Decimal(100),
        payerType: 'Cash',
        dispensedById: 'staff-1',
        dispensedAt: new Date('2026-06-01'),
      },
    });

    expect(tx.dispenseBatchAllocation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          invoiceItemId: 'item-1',
          quantity: 3,
          unitCost: batch.costPrice,
          payerType: 'Cash',
        }),
      }),
    );
    expect(tx.inventoryMovement.create).toHaveBeenCalled();
  });
});
