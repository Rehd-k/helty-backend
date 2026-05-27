import { Test, TestingModule } from '@nestjs/testing';
import { InventoryMovementType } from '@prisma/client';
import { CmacPharmacyService } from './cmac-pharmacy.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { ANTIBIOTIC_ATC_PREFIX } from '../cmac-analytics.helpers';

describe('CmacPharmacyService antibiotic filter', () => {
  it('uses J01 ATC prefix for dispense movements', async () => {
    const prisma = {
      drug: { findMany: jest.fn().mockResolvedValue([]) },
      drugBatch: { aggregate: jest.fn(), count: jest.fn() },
      inventoryMovement: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { quantity: 0 } }),
        findMany: jest.fn().mockResolvedValue([{ quantity: -5 }]),
      },
      prescriptionItem: { groupBy: jest.fn().mockResolvedValue([]) },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CmacPharmacyService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    const service = module.get(CmacPharmacyService);
    const ctx = {
      period: 'month',
      asOf: new Date(),
      current: { start: new Date('2026-05-01'), end: new Date('2026-05-31') },
      previous: { start: new Date('2026-04-01'), end: new Date('2026-04-30') },
    };
    await service.getReport(ctx, 5);
    expect(prisma.inventoryMovement.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          movementType: InventoryMovementType.DISPENSE,
          drug: { atcCode: { startsWith: ANTIBIOTIC_ATC_PREFIX } },
        }),
      }),
    );
  });
});
