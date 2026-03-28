import { BadRequestException } from '@nestjs/common';
import { AdmissionService } from './admission.service';

describe('AdmissionService', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('blocks discharge when linked invoices are not fully paid', async () => {
    const tx: any = {
      admission: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'adm-1',
          patientId: 'pat-1',
          encounter: { id: 'enc-1' },
        }),
      },
      invoice: {
        findMany: jest.fn().mockResolvedValue([{ id: 'inv-1' }]),
        findUnique: jest.fn().mockResolvedValue({
          id: 'inv-1',
          amountPaid: { gte: () => false, gt: () => false },
          invoiceItems: [],
        }),
        update: jest.fn().mockResolvedValue({}),
        count: jest.fn().mockResolvedValue(1),
      },
      invoiceItemUsageSegment: {
        updateMany: jest.fn().mockResolvedValue({}),
      },
    };

    const prisma: any = {
      $transaction: jest.fn().mockImplementation((cb) => cb(tx)),
    };

    const service = new AdmissionService(prisma);
    await expect(
      service.update('adm-1', { dischargeDate: '2026-03-27T11:00:00.000Z' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('discharges successfully after paid checks and closes open segments', async () => {
    const tx: any = {
      admission: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'adm-1',
          patientId: 'pat-1',
          encounter: { id: 'enc-1' },
        }),
        update: jest.fn().mockResolvedValue({ id: 'adm-1' }),
      },
      invoice: {
        findMany: jest.fn().mockResolvedValue([{ id: 'inv-1' }]),
        findUnique: jest.fn().mockResolvedValue({
          id: 'inv-1',
          amountPaid: { gte: () => true, gt: () => true },
          invoiceItems: [],
        }),
        update: jest.fn().mockResolvedValue({}),
        count: jest.fn().mockResolvedValue(0),
      },
      invoiceItemUsageSegment: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };

    const prisma: any = {
      $transaction: jest.fn().mockImplementation((cb) => cb(tx)),
    };

    const service = new AdmissionService(prisma);
    const result = await service.update('adm-1', {
      dischargeDate: '2026-03-27T11:00:00.000Z',
    });

    expect(result.id).toBe('adm-1');
    expect(tx.invoiceItemUsageSegment.updateMany).toHaveBeenCalled();
  });
});
