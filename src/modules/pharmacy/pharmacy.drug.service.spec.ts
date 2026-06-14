import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PharmacyDrugService } from './pharmacy.drug.service';

jest.mock('./pharmacy-sellable-stock.util', () => ({
  getSellableDrugBatchWhere: jest
    .fn()
    .mockResolvedValue({ quantityRemaining: { gt: 0 } }),
  mergeDrugBatchWhere: (...parts: Record<string, unknown>[]) => {
    const filtered = parts.filter((p) => p && Object.keys(p).length > 0);
    if (filtered.length === 0) return {};
    if (filtered.length === 1) return filtered[0];
    return { AND: filtered };
  },
}));

describe('PharmacyDrugService.remove', () => {
  const drugId = 'drug-1';
  const staffId = 'staff-1';

  const prisma = {
    drug: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    drugBatch: {
      aggregate: jest.fn(),
    },
  };

  let service: PharmacyDrugService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PharmacyDrugService(prisma as any);
    prisma.drug.findFirst.mockResolvedValue({ id: drugId });
  });

  it('throws NotFoundException when the drug is missing or already hidden', async () => {
    prisma.drug.findFirst.mockResolvedValue(null);

    await expect(service.remove(drugId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.drugBatch.aggregate).not.toHaveBeenCalled();
  });

  it('throws BadRequestException when sellable stock remains', async () => {
    prisma.drugBatch.aggregate.mockResolvedValue({
      _sum: { quantityRemaining: 12 },
    });

    await expect(service.remove(drugId)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.drug.update).not.toHaveBeenCalled();
  });

  it('soft-deletes the drug when sellable stock is zero', async () => {
    prisma.drugBatch.aggregate.mockResolvedValue({
      _sum: { quantityRemaining: 0 },
    });
    prisma.drug.update.mockResolvedValue({
      id: drugId,
      deletedAt: new Date('2026-06-14T12:00:00.000Z'),
    });

    const result = await service.remove(drugId, staffId);

    expect(prisma.drugBatch.aggregate).toHaveBeenCalledWith({
      where: {
        AND: [{ quantityRemaining: { gt: 0 } }, { drugId }],
      },
      _sum: { quantityRemaining: true },
    });
    expect(prisma.drug.update).toHaveBeenCalledWith({
      where: { id: drugId },
      data: expect.objectContaining({
        deletedAt: expect.any(Date),
        updatedById: staffId,
      }),
    });
    expect(result.deletedAt).toBeInstanceOf(Date);
  });
});
