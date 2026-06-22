import { BadRequestException } from '@nestjs/common';
import { SurgeryRequestStatus } from '@prisma/client';
import { TheatreCaseService } from './theatre-case.service';

describe('TheatreCaseService', () => {
  const invoiceService = {
    createWithServiceItem: jest.fn().mockResolvedValue({
      invoice: { id: 'inv-1' },
      invoiceItemId: 'item-1',
    }),
    addItem: jest.fn().mockResolvedValue({ id: 'cons-item-1' }),
  };

  const consumableUsage = {
    recordNonBillableUse: jest.fn().mockResolvedValue({ id: 'usage-1' }),
  };

  const prisma = {
    surgeryRequest: {
      findUnique: jest.fn(),
      update: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
    theatreCase: {
      create: jest.fn().mockResolvedValue({ id: 'case-1' }),
      update: jest.fn().mockResolvedValue({ id: 'case-1' }),
      findUnique: jest.fn(),
    },
    theatreCaseConsumable: {
      create: jest.fn(),
      findFirst: jest.fn(),
      delete: jest.fn(),
      update: jest.fn(),
    },
    consumableBatch: {
      findFirst: jest.fn().mockResolvedValue({ sellingPrice: 100 }),
    },
    admission: { findUnique: jest.fn() },
    ward: { findUnique: jest.fn() },
    bed: { findUnique: jest.fn() },
    patient: { update: jest.fn() },
    $transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        surgeryRequest: {
          update: jest.fn(),
          findUniqueOrThrow: jest.fn().mockResolvedValue({
            id: 'req-1',
            status: SurgeryRequestStatus.BILLED,
          }),
        },
        theatreCaseConsumable: { update: jest.fn() },
        bed: { update: jest.fn() },
        admission: { update: jest.fn() },
        patient: { update: jest.fn() },
        theatreCase: { findUnique: jest.fn(), update: jest.fn() },
      }),
    ),
  };

  let service: TheatreCaseService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TheatreCaseService(
      prisma as any,
      invoiceService as any,
      consumableUsage as any,
    );
  });

  it('starts only scheduled surgeries', async () => {
    prisma.surgeryRequest.findUnique.mockResolvedValue({
      id: 'req-1',
      status: SurgeryRequestStatus.REQUESTED,
      schedule: null,
    });

    await expect(service.start('req-1', 'staff-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('bills completed surgery and consumables', async () => {
    prisma.surgeryRequest.findUnique.mockResolvedValue({
      id: 'req-1',
      patientId: 'pat-1',
      encounterId: 'enc-1',
      serviceId: 'svc-1',
      status: SurgeryRequestStatus.COMPLETED,
      invoiceItemId: null,
      case: {
        consumables: [
          {
            id: 'line-1',
            consumableId: 'c-1',
            storeLocationId: 'store-1',
            quantity: 2,
            unitPrice: 50,
          },
        ],
      },
    });

    await service.bill('req-1', {}, 'staff-bill');

    expect(invoiceService.createWithServiceItem).toHaveBeenCalledWith(
      expect.objectContaining({
        encounterId: 'enc-1',
        serviceId: 'svc-1',
      }),
    );
    expect(invoiceService.addItem).toHaveBeenCalled();
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it('rejects billing before completion', async () => {
    prisma.surgeryRequest.findUnique.mockResolvedValue({
      id: 'req-1',
      status: SurgeryRequestStatus.IN_PROGRESS,
      invoiceItemId: null,
      case: { consumables: [] },
    });

    await expect(service.bill('req-1', {}, 'staff-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects duplicate billing', async () => {
    prisma.surgeryRequest.findUnique.mockResolvedValue({
      id: 'req-1',
      status: SurgeryRequestStatus.BILLED,
      invoiceItemId: 'item-1',
      case: { consumables: [] },
    });

    await expect(service.bill('req-1', {}, 'staff-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
