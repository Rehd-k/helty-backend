import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import {
  PrescriptionRefillRequestStatus,
  Prisma,
} from '@prisma/client';

jest.mock('../../common/utils/human-readable-id.util', () => ({
  generateHumanReadableId: jest.fn().mockReturnValue('ID001'),
}));

jest.mock('./drug-pricing-batch.util', () => ({
  loadDrugWithLatestCost: jest.fn().mockResolvedValue({
    id: 'drug-1',
    genericName: 'Valsartan',
    latestCost: null,
  }),
}));

import { PharmacyRefillRequestService } from './pharmacy.refill-request.service';

describe('PharmacyRefillRequestService', () => {
  const refillId = 'refill-1';
  const prescriptionId = 'rx-1';
  const patientUuid = 'pat-uuid';
  const encounterId = 'enc-1';
  const pharmacistId = 'pharm-1';
  const drugId = 'drug-1';
  const invoiceId = 'inv-1';
  const invoiceItemId = 'item-1';

  let prescriptionRefillRequestFindMany: jest.Mock;
  let prescriptionRefillRequestFindUnique: jest.Mock;
  let prescriptionRefillRequestUpdate: jest.Mock;
  let prescriptionRefillRequestCount: jest.Mock;
  let prescriptionFindFirst: jest.Mock;
  let patientFindUnique: jest.Mock;
  let encounterFindUnique: jest.Mock;
  let staffFindUnique: jest.Mock;
  let ensureInvoiceForEncounter: jest.Mock;
  let addDrugItem: jest.Mock;
  let fulfillRefill: jest.Mock;
  let invoiceFindUniqueOrThrow: jest.Mock;
  let service: PharmacyRefillRequestService;
  let tx: Record<string, jest.Mock>;
  let prisma: Record<string, unknown>;

  function mockRefillRow(overrides: Record<string, unknown> = {}) {
    const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    return {
      id: refillId,
      prescriptionId,
      patientId: patientUuid,
      status: PrescriptionRefillRequestStatus.PENDING,
      notes: 'Running low',
      pharmacyNotes: null,
      invoiceItemId: null,
      createdAt: new Date('2026-07-02T10:00:00.000Z'),
      patient: {
        id: patientUuid,
        patientId: 'WB2YEP9K',
        surname: 'Doe',
        otherName: 'Jane',
        firstName: null,
        title: null,
        gender: 'F',
        dob: new Date('1990-01-01'),
      },
      prescription: {
        id: prescriptionId,
        drug: 'DIOVAN 160MG',
        dosage: '160mg',
        startDate: new Date('2026-07-01'),
        endDate: future,
        refillsAllowed: 2,
        doctor: { firstName: 'Amadi', lastName: 'Okafor' },
        items: [
          {
            id: 'item-rx-1',
            dosage: '160mg',
            frequency: 'Twice daily (BD / BID)',
            quantityDispensed: 14,
            quantityPrescribed: 14,
            instructions: 'After meals',
            drugId,
            drug: {
              id: drugId,
              brandName: 'DIOVAN 160MG',
              genericName: 'Valsartan',
              strength: '160mg',
            },
          },
        ],
      },
      invoiceItem: null,
      ...overrides,
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();

    prescriptionRefillRequestFindMany = jest.fn();
    prescriptionRefillRequestFindUnique = jest.fn();
    prescriptionRefillRequestUpdate = jest
      .fn()
      .mockImplementation(({ where, data, include }) => {
        const base = mockRefillRow({ id: where.id, ...data });
        return include ? base : base;
      });
    prescriptionRefillRequestCount = jest.fn().mockResolvedValue(1);
    prescriptionFindFirst = jest.fn().mockResolvedValue({
      id: prescriptionId,
      refillsAllowed: 2,
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
    patientFindUnique = jest.fn().mockResolvedValue({ id: patientUuid });
    encounterFindUnique = jest.fn().mockResolvedValue({
      id: encounterId,
      patientId: patientUuid,
    });
    staffFindUnique = jest.fn().mockResolvedValue({ id: pharmacistId });
    ensureInvoiceForEncounter = jest.fn().mockResolvedValue({ id: invoiceId });
    addDrugItem = jest.fn().mockResolvedValue({
      id: invoiceItemId,
      drugId,
      quantity: 14,
      unitPrice: new Prisma.Decimal('2500.00'),
      settled: false,
    });
    fulfillRefill = jest.fn().mockResolvedValue(undefined);
    invoiceFindUniqueOrThrow = jest.fn().mockResolvedValue({
      id: invoiceId,
      invoiceID: 'INV-2026-0042',
      status: 'PENDING',
      totalAmount: new Prisma.Decimal('35000.00'),
    });

    tx = {
      prescriptionRefillRequest: {
        update: prescriptionRefillRequestUpdate,
      },
      invoice: {
        findUniqueOrThrow: invoiceFindUniqueOrThrow,
      },
    };

    prisma = {
      prescriptionRefillRequest: {
        findMany: prescriptionRefillRequestFindMany,
        findUnique: prescriptionRefillRequestFindUnique,
        update: prescriptionRefillRequestUpdate,
        count: prescriptionRefillRequestCount,
      },
      prescription: { findFirst: prescriptionFindFirst },
      patient: { findUnique: patientFindUnique },
      encounter: { findUnique: encounterFindUnique },
      staff: { findUnique: staffFindUnique },
      $transaction: jest.fn((fn: (client: typeof tx) => Promise<unknown>) =>
        fn(tx),
      ),
    };

    service = new PharmacyRefillRequestService(
      prisma as never,
      {
        ensureInvoiceForEncounter,
        addDrugItem,
      } as never,
      { fulfillRefill } as never,
    );
  });

  describe('findAll', () => {
    it('returns paginated mapped rows', async () => {
      prescriptionRefillRequestFindMany.mockResolvedValue([mockRefillRow()]);

      const result = await service.findAll({ skip: 0, take: 20 });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].patient.patientId).toBe('WB2YEP9K');
      expect(result.total).toBe(1);
    });

    it('resolves hospital patient ID filter', async () => {
      prescriptionRefillRequestFindMany.mockResolvedValue([]);

      await service.findAll({ patientId: 'wb2yep9k' });

      expect(patientFindUnique).toHaveBeenCalledWith({
        where: { patientId: 'WB2YEP9K' },
        select: { id: true },
      });
      expect(prescriptionRefillRequestFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ patientId: patientUuid }),
        }),
      );
    });

    it('returns empty list when hospital patient ID is unknown', async () => {
      patientFindUnique.mockResolvedValue(null);

      const result = await service.findAll({ patientId: 'UNKNOWN' });

      expect(result).toEqual({ data: [], total: 0, skip: 0, take: 20 });
      expect(prescriptionRefillRequestFindMany).not.toHaveBeenCalled();
    });
  });

  describe('updateStatus', () => {
    beforeEach(() => {
      prescriptionRefillRequestFindUnique.mockResolvedValue(mockRefillRow());
    });

    it('approves a pending refill', async () => {
      await service.updateStatus(refillId, {
        status: PrescriptionRefillRequestStatus.APPROVED,
        reviewedByStaffId: pharmacistId,
      });

      expect(prescriptionRefillRequestUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: refillId },
          data: expect.objectContaining({
            status: PrescriptionRefillRequestStatus.APPROVED,
            reviewedByStaffId: pharmacistId,
          }),
        }),
      );
    });

    it('requires pharmacy notes when rejecting', async () => {
      await expect(
        service.updateStatus(refillId, {
          status: PrescriptionRefillRequestStatus.REJECTED,
          reviewedByStaffId: pharmacistId,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects invalid transition from pending', async () => {
      await expect(
        service.updateStatus(refillId, {
          status: PrescriptionRefillRequestStatus.FULFILLED,
          reviewedByStaffId: pharmacistId,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('fulfills an approved refill via fulfillment service', async () => {
      prescriptionRefillRequestFindUnique
        .mockResolvedValueOnce(
          mockRefillRow({ status: PrescriptionRefillRequestStatus.APPROVED }),
        )
        .mockResolvedValueOnce(
          mockRefillRow({ status: PrescriptionRefillRequestStatus.FULFILLED }),
        );

      await service.updateStatus(refillId, {
        status: PrescriptionRefillRequestStatus.FULFILLED,
        reviewedByStaffId: pharmacistId,
      });

      expect(fulfillRefill).toHaveBeenCalledWith(refillId, tx);
    });
  });

  describe('bill', () => {
    beforeEach(() => {
      prescriptionRefillRequestFindUnique.mockResolvedValue(
        mockRefillRow({ status: PrescriptionRefillRequestStatus.APPROVED }),
      );
    });

    it('creates invoice line and links refill', async () => {
      const result = await service.bill(refillId, {
        billedByStaffId: pharmacistId,
        encounterId,
        quantity: 14,
      });

      expect(ensureInvoiceForEncounter).toHaveBeenCalled();
      expect(addDrugItem).toHaveBeenCalledWith(
        expect.objectContaining({
          invoiceId,
          drugId,
          quantity: 14,
        }),
        tx,
      );
      expect(result.refillRequest.invoiceItemId).toBe(invoiceItemId);
      expect(result.invoice.invoiceID).toBe('INV-2026-0042');
      expect(result.invoiceItem.settled).toBe(false);
    });

    it('rejects billing when not approved', async () => {
      prescriptionRefillRequestFindUnique.mockResolvedValue(mockRefillRow());

      await expect(
        service.bill(refillId, {
          billedByStaffId: pharmacistId,
          encounterId,
          quantity: 14,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects duplicate billing', async () => {
      prescriptionRefillRequestFindUnique.mockResolvedValue(
        mockRefillRow({
          status: PrescriptionRefillRequestStatus.APPROVED,
          invoiceItemId,
        }),
      );

      await expect(
        service.bill(refillId, {
          billedByStaffId: pharmacistId,
          encounterId,
          quantity: 14,
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects expired prescription', async () => {
      prescriptionRefillRequestFindUnique.mockResolvedValue(
        mockRefillRow({
          status: PrescriptionRefillRequestStatus.APPROVED,
          prescription: {
            ...mockRefillRow().prescription,
            endDate: new Date('2020-01-01'),
          },
        }),
      );
      prescriptionFindFirst.mockResolvedValue(null);

      await expect(
        service.bill(refillId, {
          billedByStaffId: pharmacistId,
          encounterId,
          quantity: 14,
        }),
      ).rejects.toThrow('Prescription expired');
    });

    it('rejects when no refills remain', async () => {
      prescriptionFindFirst.mockResolvedValue({
        id: prescriptionId,
        refillsAllowed: 0,
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      await expect(
        service.bill(refillId, {
          billedByStaffId: pharmacistId,
          encounterId,
          quantity: 14,
        }),
      ).rejects.toThrow('No refills remaining');
    });

    it('rejects encounter patient mismatch', async () => {
      encounterFindUnique.mockResolvedValue({
        id: encounterId,
        patientId: 'other-patient',
      });

      await expect(
        service.bill(refillId, {
          billedByStaffId: pharmacistId,
          encounterId,
          quantity: 14,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('findOne', () => {
    it('throws when refill not found', async () => {
      prescriptionRefillRequestFindUnique.mockResolvedValue(null);

      await expect(service.findOne('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
