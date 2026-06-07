import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { DialysisSessionStatus } from '@prisma/client';
import { DialysisSessionService } from './dialysis-session.service';

describe('DialysisSessionService', () => {
  const invoiceService = {
    assertPaidInvoiceItemConsumable: jest.fn().mockResolvedValue(undefined),
    ensureOpenInvoiceForPatient: jest
      .fn()
      .mockResolvedValue({ id: 'inv-open' }),
    addItem: jest.fn().mockResolvedValue({ id: 'item-new' }),
  };

  const consumableUsage = {
    recordNonBillableUse: jest.fn().mockResolvedValue({ id: 'usage-1' }),
  };

  const prisma = {
    patient: { findUnique: jest.fn().mockResolvedValue({ id: 'pat-1' }) },
    staff: { findUnique: jest.fn().mockResolvedValue({ id: 'staff-1' }) },
    $transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        dialysisSession: {
          create: jest.fn().mockResolvedValue({
            id: 'sess-1',
            patientId: 'pat-1',
            status: DialysisSessionStatus.PENDING,
          }),
        },
      }),
    ),
    dialysisSession: {
      create: jest.fn().mockResolvedValue({
        id: 'sess-2',
        patientId: 'pat-1',
        status: DialysisSessionStatus.PENDING,
      }),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      findUnique: jest.fn(),
      update: jest.fn().mockResolvedValue({
        id: 'sess-1',
        status: DialysisSessionStatus.IN_PROGRESS,
      }),
    },
    dialysisSessionConsumable: {
      create: jest.fn().mockResolvedValue({
        id: 'sc-1',
        sessionId: 'sess-1',
        consumable: { id: 'c-1', name: 'Filter' },
      }),
    },
    invoice: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'inv-1',
        status: 'PENDING',
        patientId: 'pat-1',
      }),
    },
  };

  let service: DialysisSessionService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DialysisSessionService(
      prisma as any,
      invoiceService as any,
      consumableUsage as any,
    );
  });

  it('creates session with invoice link in a transaction', async () => {
    await service.create({
      patientId: 'pat-1',
      invoiceId: 'inv-1',
      invoiceItemId: 'item-1',
      serviceId: 'svc-1',
    });

    expect(invoiceService.assertPaidInvoiceItemConsumable).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ mode: 'dialysis', patientId: 'pat-1' }),
      { requirePayment: false },
    );
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it('rejects cancel from non-head staff', async () => {
    prisma.dialysisSession.findUnique.mockResolvedValue({
      id: 'sess-1',
      patientId: 'pat-1',
      status: DialysisSessionStatus.PENDING,
      startedAt: null,
      performedById: null,
      consumables: [],
    });

    await expect(
      service.update(
        'sess-1',
        { status: DialysisSessionStatus.CANCELLED },
        'staff-1',
        'DIALYSIS_NURSE',
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects consumables on pending sessions', async () => {
    prisma.dialysisSession.findUnique.mockResolvedValue({
      id: 'sess-1',
      patientId: 'pat-1',
      status: DialysisSessionStatus.PENDING,
      invoiceId: 'inv-1',
    });

    await expect(
      service.addConsumable(
        'sess-1',
        {
          consumableId: 'c-1',
          storeLocationId: 'loc-1',
          quantity: 1,
        },
        'staff-1',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('adds billable consumable via invoice addItem', async () => {
    prisma.dialysisSession.findUnique.mockResolvedValue({
      id: 'sess-1',
      patientId: 'pat-1',
      status: DialysisSessionStatus.IN_PROGRESS,
      invoiceId: 'inv-1',
    });

    await service.addConsumable(
      'sess-1',
      {
        consumableId: 'c-1',
        storeLocationId: 'loc-1',
        quantity: 2,
        unitPrice: 1500,
        billable: true,
      },
      'staff-1',
    );

    expect(invoiceService.addItem).toHaveBeenCalledWith(
      'inv-1',
      expect.objectContaining({
        consumableId: 'c-1',
        storeLocationId: 'loc-1',
        quantity: 2,
        unitPrice: 1500,
      }),
      'staff-1',
    );
    expect(prisma.dialysisSessionConsumable.create).toHaveBeenCalled();
  });
});
