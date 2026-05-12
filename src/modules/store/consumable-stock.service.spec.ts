import { BadRequestException } from '@nestjs/common';
import { ConsumableStockService } from './consumable-stock.service';

describe('ConsumableStockService', () => {
  it('assertStoreLocation throws when location is missing', async () => {
    const tx = {
      storeLocation: { findUnique: jest.fn().mockResolvedValue(null) },
    } as any;
    const prisma = { storeLocation: { findUnique: jest.fn() } } as any;
    const svc = new ConsumableStockService(prisma);
    await expect(svc.assertStoreLocation(tx, 'missing-id')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('assertEnoughStock throws when total remaining is below requested', async () => {
    const tx = {
      consumableBatch: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { quantityRemaining: 2 } }),
      },
    } as any;
    const prisma = {} as any;
    const svc = new ConsumableStockService(prisma);
    await expect(
      svc.assertEnoughStock(tx, 'c1', 'loc1', 5),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
