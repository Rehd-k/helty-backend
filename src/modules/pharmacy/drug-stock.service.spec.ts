import { BadRequestException } from '@nestjs/common';
import { DrugStockService } from './drug-stock.service';

describe('DrugStockService', () => {
  const drugId = 'drug-1';
  const locationId = 'loc-1';

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
    const service = new DrugStockService({} as never);

    const qty = await service.getAvailableQuantity(tx, drugId, locationId);

    expect(qty).toBe(8);
    expect(tx.drugBatch.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.any(Array),
        }),
      }),
    );
  });

  it('deductDrugStockFifo throws when insufficient stock', async () => {
    const tx: any = {
      pharmacyLocation: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      drugBatch: {
        findMany: jest.fn().mockResolvedValue([{ id: 'b1', quantityRemaining: 2 }]),
        update: jest.fn(),
      },
    };
    const service = new DrugStockService({} as never);

    await expect(
      service.deductDrugStockFifo(tx, drugId, 5, locationId),
    ).rejects.toThrow(BadRequestException);
  });

  it('deductDrugStockFifo decrements batches in FIFO order', async () => {
    const tx: any = {
      pharmacyLocation: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      drugBatch: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'b1', quantityRemaining: 2 },
          { id: 'b2', quantityRemaining: 5 },
        ]),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const service = new DrugStockService({} as never);

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
});
