import { BadRequestException } from '@nestjs/common';
import { LabAstResultService } from './lab-ast-result.service';

jest.mock('nanoid', () => ({
  customAlphabet: () => () => 'TESTID0001',
}));

describe('LabAstResultService', () => {
  const prisma = {
    staff: { findUnique: jest.fn() },
    labOrderItem: { findUnique: jest.fn() },
    labAntibiotic: { findMany: jest.fn() },
    labAstResultOption: { findMany: jest.fn() },
    labAstResult: { upsert: jest.fn(), findMany: jest.fn() },
    $transaction: jest.fn(async (cb: (tx: typeof prisma) => unknown) =>
      cb(prisma),
    ),
  };

  const invoiceService = {
    assertInvoiceItemPaidOrInpatientCredit: jest.fn(),
    settleInvoiceItemIfPresent: jest.fn(),
  };

  let service: LabAstResultService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(async (cb) => cb(prisma));
    prisma.staff.findUnique.mockResolvedValue({ id: 'staff-1' });
    prisma.labOrderItem.findUnique.mockResolvedValue({
      astRequested: true,
      order: { invoiceItemId: 'inv-item-1', patientId: 'patient-1' },
    });
    prisma.labAstResult.upsert.mockImplementation(({ create }) =>
      Promise.resolve({ id: `ast-${create.antibioticId}`, ...create }),
    );
    service = new LabAstResultService(prisma as any, invoiceService as any);
  });

  it('accepts a batch where several antibiotics share the same result option', async () => {
    const sensitiveId = 'opt-sensitive';
    prisma.labAntibiotic.findMany.mockResolvedValue([
      { id: 'abx-1', isActive: true },
      { id: 'abx-2', isActive: true },
    ]);
    prisma.labAstResultOption.findMany.mockResolvedValue([
      { id: sensitiveId, isActive: true },
    ]);

    await expect(
      service.createBatch({
        orderItemId: 'item-1',
        enteredBy: 'staff-1',
        results: [
          { antibioticId: 'abx-1', resultOptionId: sensitiveId },
          { antibioticId: 'abx-2', resultOptionId: sensitiveId },
        ],
      }),
    ).resolves.toHaveLength(2);

    expect(prisma.labAstResultOption.findMany).toHaveBeenCalledWith({
      where: { id: { in: [sensitiveId] }, isActive: true },
    });
  });

  it('rejects an unknown or inactive result option', async () => {
    prisma.labAntibiotic.findMany.mockResolvedValue([
      { id: 'abx-1', isActive: true },
    ]);
    prisma.labAstResultOption.findMany.mockResolvedValue([]);

    await expect(
      service.createBatch({
        orderItemId: 'item-1',
        enteredBy: 'staff-1',
        results: [{ antibioticId: 'abx-1', resultOptionId: 'opt-missing' }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
