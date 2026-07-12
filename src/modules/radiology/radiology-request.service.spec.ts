import { BadRequestException, NotFoundException } from '@nestjs/common';
import { RadiologyRequestStatus } from '@prisma/client';

jest.mock('../../common/utils/human-readable-id.util', () => ({
  generateHumanReadableId: jest.fn(() => 'TESTID1234'),
  generateSafeNanoid: jest.fn(() => 'safe-nanoid'),
}));

import { RadiologyRequestService } from './radiology-request.service';

describe('RadiologyRequestService', () => {
  const invoiceService = {
    assertInpatientCreditAllowed: jest.fn(),
    assertServiceCategoryForEncounterBilling: jest.fn().mockResolvedValue(undefined),
    createWithServiceItem: jest.fn().mockResolvedValue({
      invoice: { id: 'inv-1' },
      invoiceItemId: 'item-1',
    }),
    assertPaidInvoiceItemConsumable: jest.fn().mockResolvedValue(undefined),
    removeBillableLineForEncounterRequest: jest.fn().mockResolvedValue(undefined),
  };

  const itemDetail = {
    id: 'item-1',
    orderId: 'ord-1',
    status: RadiologyRequestStatus.PENDING,
    schedule: null,
    procedure: null,
    images: [],
    report: null,
    invoiceItem: null,
  };

  const prisma = {
    patient: { findUnique: jest.fn().mockResolvedValue({ id: 'pat-1' }) },
    encounter: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'enc-1',
        patientId: 'pat-1',
        admissionId: null,
        admission: null,
      }),
    },
    staff: { findUnique: jest.fn().mockResolvedValue({ id: 'doc-1' }) },
    department: { findUnique: jest.fn() },
    radiologyOrderItem: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    radiologyOrder: {
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  let service: RadiologyRequestService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction = jest.fn((fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        radiologyOrder: {
          create: jest.fn().mockResolvedValue({
            id: 'ord-1',
            items: [],
          }),
          delete: jest.fn().mockResolvedValue(undefined),
          update: jest.fn().mockResolvedValue(undefined),
        },
        radiologyOrderItem: {
          update: jest.fn().mockResolvedValue(undefined),
          delete: jest.fn().mockResolvedValue(undefined),
          count: jest.fn().mockResolvedValue(1),
          findMany: jest.fn().mockResolvedValue([
            { status: RadiologyRequestStatus.SCHEDULED },
          ]),
        },
      }),
    );
    service = new RadiologyRequestService(prisma as any, invoiceService as any);
  });

  it('encounter-billed imaging skips admission and consumable payment checks', async () => {
    await service.create(
      {
        patientId: 'pat-1',
        encounterId: 'enc-1',
        requestedById: 'doc-1',
        items: [
          {
            scanType: 'XRAY' as any,
            serviceId: 'svc-1',
          },
        ],
      },
      'doc-1',
    );

    expect(invoiceService.assertInpatientCreditAllowed).not.toHaveBeenCalled();
    expect(invoiceService.assertPaidInvoiceItemConsumable).not.toHaveBeenCalled();
    expect(invoiceService.createWithServiceItem).toHaveBeenCalled();
  });

  it('updateItemById updates status and returns the item', async () => {
    prisma.radiologyOrderItem.findUnique = jest
      .fn()
      .mockResolvedValueOnce({ orderId: 'ord-1' })
      .mockResolvedValueOnce(itemDetail);
    prisma.radiologyOrderItem.findFirst = jest.fn().mockResolvedValue({
      id: 'item-1',
      orderId: 'ord-1',
      status: RadiologyRequestStatus.PENDING,
      procedure: null,
      report: null,
      invoiceItemId: null,
      order: { id: 'ord-1', status: RadiologyRequestStatus.PENDING },
    });

    const result = await service.updateItemById('item-1', {
      status: RadiologyRequestStatus.SCHEDULED,
    });

    expect(result).toEqual(itemDetail);
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it('updateItemById throws when item is missing', async () => {
    prisma.radiologyOrderItem.findUnique = jest.fn().mockResolvedValue(null);

    await expect(
      service.updateItemById('missing', { status: RadiologyRequestStatus.SCHEDULED }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('removeItemById delegates to removeItem', async () => {
    prisma.radiologyOrderItem.findUnique = jest
      .fn()
      .mockResolvedValueOnce({ orderId: 'ord-1' });
    prisma.radiologyOrderItem.findFirst = jest.fn().mockResolvedValue({
      id: 'item-1',
      orderId: 'ord-1',
      status: RadiologyRequestStatus.PENDING,
      procedure: null,
      report: null,
      invoiceItemId: null,
    });
    prisma.radiologyOrder.findUnique = jest.fn().mockResolvedValue({ id: 'ord-1' });
    jest.spyOn(service, 'findOne').mockResolvedValue({ id: 'ord-1' } as any);

    const result = await service.removeItemById('item-1');

    expect(result).toEqual(
      expect.objectContaining({
        message: 'Radiology order item removed successfully.',
      }),
    );
  });

  it('blocks clinical updates after report exists', async () => {
    prisma.radiologyOrderItem.findFirst = jest.fn().mockResolvedValue({
      id: 'item-1',
      orderId: 'ord-1',
      status: RadiologyRequestStatus.REPORTED,
      procedure: null,
      report: { id: 'rep-1' },
      invoiceItemId: null,
      order: { id: 'ord-1', status: RadiologyRequestStatus.REPORTED },
    });

    await expect(
      service.updateItem('ord-1', 'item-1', { clinicalNotes: 'Updated' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
