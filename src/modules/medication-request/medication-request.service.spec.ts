import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InvoiceStatus, MedicationRequestStatus, Prisma } from '@prisma/client';
import { MedicationRequestService } from './medication-request.service';

jest.mock('../../common/utils/human-readable-id.util', () => ({
  generateHumanReadableId: jest.fn().mockReturnValue('ID001'),
}));

jest.mock('../../common/utils/patient-outpatient.util', () => ({
  isOutpatientPatient: jest.fn().mockResolvedValue(false),
}));

import { isOutpatientPatient } from '../../common/utils/patient-outpatient.util';

const mockIsOutpatientPatient = isOutpatientPatient as jest.MockedFunction<
  typeof isOutpatientPatient
>;

describe('MedicationRequestService', () => {
  const orderId = 'order-1';
  const encounterId = 'enc-1';
  const patientId = 'pat-1';
  const nurseId = 'nurse-1';
  const pharmacistId = 'pharm-1';
  const doctorId = 'doc-1';
  const drugId = 'drug-1';
  const altDrugId = 'drug-2';
  const requestId = 'req-1';

  let medicationRequestCreate: jest.Mock;
  let medicationRequestFindMany: jest.Mock;
  let medicationRequestFindUnique: jest.Mock;
  let medicationRequestUpdate: jest.Mock;
  let medicationRequestCount: jest.Mock;
  let medicationOrderFindUnique: jest.Mock;
  let medicationOrderUpdate: jest.Mock;
  let drugFindFirst: jest.Mock;
  let ensureInvoiceForEncounter: jest.Mock;
  let addDrugItem: jest.Mock;
  let syncDrugInvoiceLine: jest.Mock;
  let removeBillableLineForEncounterRequest: jest.Mock;
  let service: MedicationRequestService;
  let tx: any;
  let prisma: any;

  function mockRequestedRequest(overrides: Record<string, unknown> = {}) {
    return {
      id: requestId,
      medicationOrderId: orderId,
      requestedByNurseId: nurseId,
      requestedQuantity: 5,
      status: MedicationRequestStatus.REQUESTED,
      invoiceItemId: null,
      medicationOrder: { id: orderId, doctorId, status: 'Prescribed' },
      invoiceItem: null,
      ...overrides,
    };
  }

  function mockBilledMutableRequest(overrides: Record<string, unknown> = {}) {
    return {
      id: requestId,
      medicationOrderId: orderId,
      requestedByNurseId: nurseId,
      requestedQuantity: 5,
      status: MedicationRequestStatus.BILLED,
      invoiceItemId: 'item-1',
      medicationOrder: { id: orderId, doctorId, status: 'Pending Dispense' },
      invoiceItem: {
        id: 'item-1',
        settled: false,
        amountPaid: new Prisma.Decimal(0),
        invoice: { id: 'inv-1', status: InvoiceStatus.PENDING },
        _count: { allocations: 0 },
      },
      ...overrides,
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    mockIsOutpatientPatient.mockResolvedValue(false);

    medicationRequestCreate = jest.fn().mockImplementation(({ data }) => ({
      id: requestId,
      ...data,
      status: MedicationRequestStatus.REQUESTED,
    }));
    medicationRequestFindMany = jest.fn();
    medicationRequestFindUnique = jest.fn();
    medicationRequestUpdate = jest.fn().mockImplementation(({ where, data }) => ({
      id: where.id,
      medicationOrderId: orderId,
      encounterId,
      patientId,
      requestedQuantity: data.requestedQuantity ?? 5,
      status: data.status ?? MedicationRequestStatus.REQUESTED,
      invoiceItemId: data.invoiceItemId,
      medicationOrder: {
        id: orderId,
        drugId,
        drugName: 'Paracetamol',
        prescribedDrugName: 'Paracetamol',
        doctor: { id: doctorId, firstName: 'John', lastName: 'Smith' },
        drug: { id: drugId, genericName: 'Paracetamol' },
      },
    }));
    medicationRequestCount = jest.fn().mockResolvedValue(0);

    medicationOrderFindUnique = jest.fn().mockResolvedValue({
      id: orderId,
      drugId,
      doctorId,
      prescribedDrugName: 'Paracetamol',
    });
    medicationOrderUpdate = jest.fn();
    drugFindFirst = jest.fn();

    ensureInvoiceForEncounter = jest.fn().mockResolvedValue({ id: 'inv-1' });
    addDrugItem = jest
      .fn()
      .mockResolvedValueOnce({ id: 'item-1' })
      .mockResolvedValueOnce({ id: 'item-2' });
    syncDrugInvoiceLine = jest.fn().mockResolvedValue({});
    removeBillableLineForEncounterRequest = jest.fn().mockResolvedValue(undefined);

    tx = {
      medicationRequest: {
        findUnique: medicationRequestFindUnique,
        update: medicationRequestUpdate,
        count: medicationRequestCount,
      },
      medicationOrder: {
        findUnique: medicationOrderFindUnique,
        update: medicationOrderUpdate,
      },
      drug: {
        findUnique: jest.fn().mockResolvedValue({
          id: drugId,
          genericName: 'Paracetamol',
        }),
        findFirst: drugFindFirst,
      },
      drugBatch: {
        findFirst: jest.fn().mockResolvedValue({
          costPrice: new Prisma.Decimal(100),
        }),
      },
      invoice: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: 'inv-1',
          invoiceItems: [],
          patient: { id: patientId },
        }),
      },
    };

    prisma = {
      medicationOrder: {
        findUnique: medicationOrderFindUnique,
      },
      drug: {
        findFirst: drugFindFirst,
      },
      staff: {
        findUnique: jest.fn().mockImplementation(({ where }) =>
          Promise.resolve({ id: where.id }),
        ),
      },
      encounter: {
        findUnique: jest.fn().mockResolvedValue({ id: encounterId, patientId }),
      },
      medicationRequest: {
        create: medicationRequestCreate,
        findMany: medicationRequestFindMany,
        findUnique: medicationRequestFindUnique,
        update: medicationRequestUpdate,
      },
      $transaction: jest.fn(async (cb: (client: typeof tx) => unknown) =>
        cb(tx),
      ),
    };

    const invoiceService = {
      ensureInvoiceForEncounter,
      addDrugItem,
      syncDrugInvoiceLine,
      removeBillableLineForEncounterRequest,
    };

    service = new MedicationRequestService(
      prisma as any,
      invoiceService as any,
    );

    medicationOrderFindUnique.mockImplementation(async (args: { where: { id: string } }) => {
      if (args.where.id === orderId) {
        return {
          id: orderId,
          drugId,
          doctorId,
          encounterId,
          patientId,
          status: 'Prescribed',
          prescribedDrugName: 'Paracetamol',
          encounter: { id: encounterId, patientId },
        };
      }
      return null;
    });
  });

  it('creates a medication request from a prescribed order', async () => {
    await service.create({
      medicationOrderId: orderId,
      requestedQuantity: 10,
      requestedByNurseId: nurseId,
    });

    expect(medicationRequestCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          medicationOrderId: orderId,
          requestedQuantity: 10,
          requestedByNurseId: nurseId,
        }),
      }),
    );
  });

  it('rejects nurse requests for outpatient patients', async () => {
    mockIsOutpatientPatient.mockResolvedValue(true);

    await expect(
      service.create({
        medicationOrderId: orderId,
        requestedQuantity: 10,
        requestedByNurseId: nurseId,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(medicationRequestCreate).not.toHaveBeenCalled();
  });

  it('bills all REQUESTED requests for an encounter', async () => {
    prisma.staff.findUnique.mockResolvedValue({ id: pharmacistId });
    medicationRequestFindMany.mockResolvedValue([
      {
        id: 'req-1',
        medicationOrderId: orderId,
        requestedQuantity: 5,
        medicationOrder: {
          id: orderId,
          drugId,
          patientId,
          status: 'Prescribed',
          doctorId,
        },
      },
      {
        id: 'req-2',
        medicationOrderId: orderId,
        requestedQuantity: 3,
        medicationOrder: {
          id: orderId,
          drugId,
          patientId,
          status: 'Prescribed',
          doctorId,
        },
      },
    ]);

    const result = await service.bill({
      encounterId,
      billedByStaffId: pharmacistId,
    });

    expect(ensureInvoiceForEncounter).toHaveBeenCalled();
    expect(addDrugItem).toHaveBeenCalledTimes(2);
    expect(result.billedRequests).toHaveLength(2);
  });

  describe('update', () => {
    beforeEach(() => {
      medicationRequestFindUnique.mockResolvedValue(mockRequestedRequest());
    });

    it('updates requestedQuantity and notes for pharmacy', async () => {
      await service.update(requestId, {
        modifiedByStaffId: pharmacistId,
        requestedQuantity: 12,
        notes: 'Adjusted',
      });

      expect(medicationOrderUpdate).not.toHaveBeenCalled();
      expect(medicationRequestUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: requestId },
          data: { requestedQuantity: 12, notes: 'Adjusted' },
        }),
      );
    });

    it('substitutes drug and records pharmacist attribution', async () => {
      drugFindFirst.mockResolvedValue({
        id: altDrugId,
        genericName: 'Ibuprofen',
      });

      await service.update(requestId, {
        modifiedByStaffId: pharmacistId,
        drugId: altDrugId,
        requestedQuantity: 8,
      });

      expect(medicationOrderUpdate).toHaveBeenCalledWith({
        where: { id: orderId },
        data: expect.objectContaining({
          drug: { connect: { id: altDrugId } },
          drugName: 'Ibuprofen',
          substitutedByPharmacist: { connect: { id: pharmacistId } },
          substitutedAt: expect.any(Date),
        }),
      });
    });

    it('does not set pharmacist attribution when prescriber substitutes', async () => {
      drugFindFirst.mockResolvedValue({
        id: altDrugId,
        genericName: 'Ibuprofen',
      });

      await service.update(requestId, {
        modifiedByStaffId: doctorId,
        drugId: altDrugId,
      });

      expect(medicationOrderUpdate).toHaveBeenCalledWith({
        where: { id: orderId },
        data: {
          drug: { connect: { id: altDrugId } },
          drugName: 'Ibuprofen',
        },
      });
    });

    it('rejects nurse updates', async () => {
      await expect(
        service.update(requestId, {
          modifiedByStaffId: nurseId,
          requestedQuantity: 5,
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('allows prescriber to update billed unpaid request and syncs invoice', async () => {
      medicationRequestFindUnique.mockResolvedValue(mockBilledMutableRequest());

      await service.update(requestId, {
        modifiedByStaffId: doctorId,
        requestedQuantity: 8,
      });

      expect(syncDrugInvoiceLine).toHaveBeenCalledWith(
        'item-1',
        { billingQuantity: 8 },
        tx,
      );
    });

    it('rejects pharmacy update on billed request', async () => {
      medicationRequestFindUnique.mockResolvedValue(mockBilledMutableRequest());

      await expect(
        service.update(requestId, {
          modifiedByStaffId: pharmacistId,
          requestedQuantity: 8,
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects update when billed line is settled', async () => {
      medicationRequestFindUnique.mockResolvedValue(
        mockBilledMutableRequest({
          invoiceItem: {
            id: 'item-1',
            settled: true,
            amountPaid: new Prisma.Decimal(0),
            invoice: { id: 'inv-1', status: InvoiceStatus.PENDING },
            _count: { allocations: 0 },
          },
        }),
      );

      await expect(
        service.update(requestId, {
          modifiedByStaffId: doctorId,
          requestedQuantity: 8,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects an unknown catalog drug', async () => {
      drugFindFirst.mockResolvedValue(null);

      await expect(
        service.update(requestId, {
          modifiedByStaffId: pharmacistId,
          drugId: altDrugId,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws when the linked medication order is missing', async () => {
      medicationRequestFindUnique.mockResolvedValue(
        mockRequestedRequest({ medicationOrderId: 'missing-order' }),
      );
      tx.medicationOrder.findUnique.mockResolvedValue(null);

      await expect(
        service.update(requestId, {
          modifiedByStaffId: pharmacistId,
          drugId: altDrugId,
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('remove', () => {
    it('allows nurse to cancel REQUESTED request', async () => {
      medicationRequestFindUnique.mockResolvedValue(mockRequestedRequest());

      await service.remove(requestId, nurseId);

      expect(medicationRequestUpdate).toHaveBeenCalledWith({
        where: { id: requestId },
        data: {
          status: MedicationRequestStatus.CANCELLED,
          invoiceItemId: null,
        },
      });
    });

    it('allows prescriber to cancel billed unpaid request and removes invoice line', async () => {
      medicationRequestFindUnique.mockResolvedValue(mockBilledMutableRequest());

      await service.remove(requestId, doctorId);

      expect(removeBillableLineForEncounterRequest).toHaveBeenCalledWith(
        'item-1',
        tx,
      );
      expect(medicationRequestUpdate).toHaveBeenCalledWith({
        where: { id: requestId },
        data: {
          status: MedicationRequestStatus.CANCELLED,
          invoiceItemId: null,
        },
      });
    });

    it('rejects cancel without cancelledByStaffId', async () => {
      await expect(service.remove(requestId, '')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });
});
