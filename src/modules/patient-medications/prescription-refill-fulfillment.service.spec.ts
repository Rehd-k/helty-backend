import { ConflictException, NotFoundException } from '@nestjs/common';
import { PrescriptionRefillRequestStatus } from '@prisma/client';
import { PrescriptionRefillFulfillmentService } from './prescription-refill-fulfillment.service';

describe('PrescriptionRefillFulfillmentService', () => {
  const refillId = 'refill-1';
  const prescriptionId = 'rx-1';
  const itemId = 'item-rx-1';

  let prescriptionRefillRequestFindUnique: jest.Mock;
  let prescriptionRefillRequestUpdate: jest.Mock;
  let prescriptionItemUpdate: jest.Mock;
  let prescriptionUpdate: jest.Mock;
  let generateDosesForPrescription: jest.Mock;
  let service: PrescriptionRefillFulfillmentService;
  let tx: Record<string, jest.Mock>;

  function mockRefill(overrides: Record<string, unknown> = {}) {
    return {
      id: refillId,
      prescriptionId,
      status: PrescriptionRefillRequestStatus.APPROVED,
      prescription: {
        id: prescriptionId,
        refillsAllowed: 2,
        endDate: new Date('2026-07-09'),
        items: [
          {
            id: itemId,
            frequency: 'Twice daily (BD / BID)',
            quantityDispensed: 14,
            quantityPrescribed: 14,
          },
        ],
      },
      invoiceItem: { quantity: 14 },
      ...overrides,
    };
  }

  beforeEach(() => {
    prescriptionRefillRequestFindUnique = jest.fn().mockResolvedValue(mockRefill());
    prescriptionRefillRequestUpdate = jest.fn();
    prescriptionItemUpdate = jest.fn();
    prescriptionUpdate = jest.fn();
    generateDosesForPrescription = jest.fn().mockResolvedValue(7);

    tx = {
      prescriptionRefillRequest: {
        findUnique: prescriptionRefillRequestFindUnique,
        update: prescriptionRefillRequestUpdate,
      },
      prescriptionItem: { update: prescriptionItemUpdate },
      prescription: { update: prescriptionUpdate },
    };

    service = new PrescriptionRefillFulfillmentService(
      { prescriptionRefillRequest: { findUnique: prescriptionRefillRequestFindUnique } } as never,
      { generateDosesForPrescription } as never,
    );
  });

  it('updates supply, decrements refills, and generates doses', async () => {
    await service.fulfillRefill(refillId, tx as never, { quantity: 14 });

    expect(prescriptionItemUpdate).toHaveBeenCalledWith({
      where: { id: itemId },
      data: { quantityDispensed: 28 },
    });
    expect(prescriptionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: prescriptionId },
        data: expect.objectContaining({ refillsAllowed: 1 }),
      }),
    );
    expect(prescriptionRefillRequestUpdate).toHaveBeenCalledWith({
      where: { id: refillId },
      data: { status: PrescriptionRefillRequestStatus.FULFILLED },
    });
    expect(generateDosesForPrescription).toHaveBeenCalledWith(
      prescriptionId,
      tx,
    );
  });

  it('rejects already fulfilled refills', async () => {
    prescriptionRefillRequestFindUnique.mockResolvedValue(
      mockRefill({ status: PrescriptionRefillRequestStatus.FULFILLED }),
    );

    await expect(service.fulfillRefill(refillId, tx as never)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('throws when refill not found', async () => {
    prescriptionRefillRequestFindUnique.mockResolvedValue(null);

    await expect(service.fulfillRefill('missing', tx as never)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
