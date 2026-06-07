import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { HmoService } from './hmo.service';

describe('HmoService', () => {
  const req = { user: { sub: 'staff-1' } };

  const baseHmo = {
    id: 'hmo-1',
    name: 'Test HMO',
    code: null,
    notes: null,
    defaultCoveragePercent: null,
    createdBy: { id: 'staff-1', firstName: 'A', lastName: 'B' },
    updatedBy: { id: 'staff-1', firstName: 'A', lastName: 'B' },
    servicePrices: [],
    _count: { patients: 0 },
  };

  function createPrismaMock() {
    return {
      hmo: {
        findUnique: jest.fn().mockResolvedValue(baseHmo),
        update: jest.fn().mockResolvedValue(baseHmo),
      },
      staff: {
        findUnique: jest.fn().mockResolvedValue({ id: 'staff-1' }),
      },
      service: {
        findMany: jest.fn().mockResolvedValue([{ id: 'svc-1' }]),
      },
      hmoServicePrice: {
        upsert: jest.fn().mockResolvedValue({}),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      $transaction: jest.fn(async (fn: (tx: any) => Promise<unknown>) =>
        fn({
          hmoServicePrice: {
            upsert: jest.fn().mockResolvedValue({}),
          },
          hmo: {
            update: jest.fn().mockResolvedValue(baseHmo),
          },
        }),
      ),
    };
  }

  let prisma: ReturnType<typeof createPrismaMock>;
  let service: HmoService;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new HmoService(prisma as any);
  });

  describe('normalizePriceRow via upsertServicePrices', () => {
    it('accepts cost-only rows and upserts them', async () => {
      await service.upsertServicePrices(
        'hmo-1',
        { servicePrices: [{ serviceId: 'svc-1', cost: 4200 }] },
        req,
      );

      expect(prisma.$transaction).toHaveBeenCalled();
      const txFn = prisma.$transaction.mock.calls[0][0];
      const tx = {
        hmoServicePrice: { upsert: jest.fn().mockResolvedValue({}) },
        hmo: { update: jest.fn().mockResolvedValue(baseHmo) },
      };
      await txFn(tx);

      const upsertCall = tx.hmoServicePrice.upsert.mock.calls[0][0];
      expect(upsertCall.where).toEqual({
        hmoId_serviceId: { hmoId: 'hmo-1', serviceId: 'svc-1' },
      });
      expect(upsertCall.create.fullCost.toString()).toBe('4200');
      expect(upsertCall.create.hmoPays.toString()).toBe('4200');
      expect(upsertCall.create.patientPays.toString()).toBe('0');
    });

    it('rejects rows with neither cost nor full split', async () => {
      await expect(
        service.upsertServicePrices(
          'hmo-1',
          { servicePrices: [{ serviceId: 'svc-1' } as any] },
          req,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('removeServicePrice', () => {
    it('throws when price row does not exist', async () => {
      prisma.hmoServicePrice.deleteMany.mockResolvedValue({ count: 0 });
      await expect(
        service.removeServicePrice('hmo-1', 'svc-1', req),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('deletes price row and updates HMO audit fields', async () => {
      const result = await service.removeServicePrice('hmo-1', 'svc-1', req);
      expect(prisma.hmoServicePrice.deleteMany).toHaveBeenCalledWith({
        where: { hmoId: 'hmo-1', serviceId: 'svc-1' },
      });
      expect(prisma.hmo.update).toHaveBeenCalledWith({
        where: { id: 'hmo-1' },
        data: { updatedById: 'staff-1' },
      });
      expect(result.message).toContain('removed');
    });
  });
});
