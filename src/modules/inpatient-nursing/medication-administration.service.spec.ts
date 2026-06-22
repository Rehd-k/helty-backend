import {
  BadRequestException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  AccountType,
  AdmissionStatus,
  MedicationAdminStatus,
  PharmacyLocationType,
  Prisma,
  StaffRole,
} from '@prisma/client';
import { MedicationAdministrationService } from './medication-administration.service';
import { DrugStockService } from '../pharmacy/drug-stock.service';
import { InvoiceService } from '../invoice/invoice.service';

const admissionId = 'adm-1';
const orderId = 'order-1';
const nurseId = 'nurse-1';
const locationId = 'loc-1';
const drugId = 'drug-1';

const baseOrder = {
  id: orderId,
  admissionId,
  drugId,
  encounterId: 'enc-1',
  patientId: 'pat-1',
  quantity: new Prisma.Decimal(1),
  dose: '500mg',
};

const baseDto = {
  medicationOrderId: orderId,
  scheduledTime: '2026-06-20T14:30:00.000Z',
  actualTime: '2026-06-20T14:30:00.000Z',
  status: MedicationAdminStatus.GIVEN,
  quantity: 1,
};

function createService(
  prisma: Record<string, unknown>,
  drugStockService: Partial<DrugStockService> = {},
  invoiceService: Partial<InvoiceService> = {},
) {
  return new MedicationAdministrationService(
    prisma as never,
    {
      getAvailableQuantity: jest.fn().mockResolvedValue(10),
      deductDrugStockFifo: jest.fn().mockResolvedValue(undefined),
      ...drugStockService,
    } as DrugStockService,
    {
      billSettledDrugDispenseLine: jest.fn().mockResolvedValue({
        id: 'item-1',
        invoiceId: 'inv-1',
        quantity: 3,
        unitPrice: new Prisma.Decimal(100),
        settled: true,
        dispensedAt: new Date(),
        dispensaryLocationId: locationId,
        drug: { id: drugId, genericName: 'Paracetamol' },
        invoice: {
          id: 'inv-1',
          invoiceID: 'INV-001',
          status: 'PENDING',
          totalAmount: new Prisma.Decimal(300),
          amountPaid: new Prisma.Decimal(0),
        },
        dispensaryLocation: {
          id: locationId,
          name: 'Ward Dispensary',
          locationType: PharmacyLocationType.DISPENSARY,
        },
      }),
      ...invoiceService,
    } as InvoiceService,
  );
}

function admissionPrismaMocks() {
  return {
    admission: {
      findUnique: jest.fn().mockResolvedValue({
        id: admissionId,
        status: AdmissionStatus.ACTIVE,
      }),
    },
    staff: {
      findUnique: jest.fn().mockResolvedValue({
        id: nurseId,
        accountType: AccountType.NURSE,
        staffRole: StaffRole.INPATIENT_NURSE,
        isActive: true,
      }),
    },
  };
}

function marCreateResult(overrides: Record<string, unknown> = {}) {
  return {
    id: 'mar-1',
    admissionId,
    medicationOrderId: orderId,
    administeredByNurseId: nurseId,
    scheduledTime: new Date(baseDto.scheduledTime),
    actualTime: new Date(baseDto.actualTime),
    status: MedicationAdminStatus.GIVEN,
    quantity: new Prisma.Decimal(1),
    isOverMedication: false,
    reasonIfNotGiven: null,
    remarks: null,
    pharmacyLocationId: null,
    stockDeductedQuantity: null,
    createdAt: new Date(),
    medicationOrder: {
      id: orderId,
      drugId,
      drugName: 'Paracetamol',
      dose: '500mg',
      quantity: new Prisma.Decimal(1),
      route: 'ORAL',
      frequency: 'TDS',
    },
    nurse: {
      id: nurseId,
      firstName: 'Jane',
      lastName: 'Nurse',
      staffRole: StaffRole.INPATIENT_NURSE,
    },
    pharmacyLocation: null,
    invoiceItem: null,
    ...overrides,
  };
}

describe('MedicationAdministrationService', () => {
  it('creates MAR without dispensary when pharmacyLocationId omitted', async () => {
    const created = marCreateResult();
    const prisma: any = {
      ...admissionPrismaMocks(),
      medicationOrder: {
        findFirst: jest.fn().mockResolvedValue(baseOrder),
      },
      $transaction: jest
        .fn()
        .mockImplementation(async (cb: (tx: any) => unknown) => cb(prisma)),
      medicationAdministration: {
        create: jest.fn().mockResolvedValue(created),
      },
    };
    const drugStock = {
      getAvailableQuantity: jest.fn(),
      deductDrugStockFifo: jest.fn(),
    };
    const billSettledDrugDispenseLine = jest.fn();
    const service = createService(prisma, drugStock, {
      billSettledDrugDispenseLine,
    });

    const result = await service.create(admissionId, baseDto, nurseId);

    expect(billSettledDrugDispenseLine).not.toHaveBeenCalled();
    expect(drugStock.getAvailableQuantity).not.toHaveBeenCalled();
    expect(drugStock.deductDrugStockFifo).not.toHaveBeenCalled();
    expect(prisma.medicationAdministration.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          pharmacyLocationId: null,
          stockDeductedQuantity: null,
        }),
      }),
    );
    expect(result.pharmacyLocation).toBeNull();
    expect(result.stockDeductedQuantity).toBeNull();
  });

  it('deducts stock when GIVEN with valid dispensary', async () => {
    const created = marCreateResult({
      pharmacyLocationId: locationId,
      stockDeductedQuantity: 3,
      quantity: new Prisma.Decimal(2.5),
      invoiceItemId: 'item-1',
      pharmacyLocation: {
        id: locationId,
        name: 'Ward Dispensary',
        locationType: PharmacyLocationType.DISPENSARY,
      },
      invoiceItem: {
        id: 'item-1',
        invoiceId: 'inv-1',
        quantity: 3,
        unitPrice: new Prisma.Decimal(100),
        settled: true,
        dispensedAt: new Date(),
        dispensaryLocationId: locationId,
        drug: { id: drugId, genericName: 'Paracetamol' },
        invoice: {
          id: 'inv-1',
          invoiceID: 'INV-001',
          status: 'PENDING',
          totalAmount: new Prisma.Decimal(300),
          amountPaid: new Prisma.Decimal(0),
        },
        dispensaryLocation: {
          id: locationId,
          name: 'Ward Dispensary',
          locationType: PharmacyLocationType.DISPENSARY,
        },
      },
    });
    const prisma: any = {
      ...admissionPrismaMocks(),
      medicationOrder: {
        findFirst: jest.fn().mockResolvedValue(baseOrder),
      },
      pharmacyLocation: {
        findUnique: jest.fn().mockResolvedValue({
          id: locationId,
          name: 'Ward Dispensary',
          locationType: PharmacyLocationType.DISPENSARY,
        }),
      },
      $transaction: jest
        .fn()
        .mockImplementation(async (cb: (tx: any) => unknown) => cb(prisma)),
      medicationAdministration: {
        create: jest.fn().mockResolvedValue(created),
      },
    };
    const drugStock = {
      getAvailableQuantity: jest.fn().mockResolvedValue(10),
      deductDrugStockFifo: jest.fn().mockResolvedValue(undefined),
    };
    const billSettledDrugDispenseLine = jest.fn().mockResolvedValue({
      id: 'item-1',
      invoiceId: 'inv-1',
      quantity: 3,
      unitPrice: new Prisma.Decimal(100),
      settled: true,
      dispensedAt: new Date(),
      dispensaryLocationId: locationId,
      drug: { id: drugId, genericName: 'Paracetamol' },
      invoice: {
        id: 'inv-1',
        invoiceID: 'INV-001',
        status: 'PENDING',
        totalAmount: new Prisma.Decimal(300),
        amountPaid: new Prisma.Decimal(0),
      },
      dispensaryLocation: {
        id: locationId,
        name: 'Ward Dispensary',
        locationType: PharmacyLocationType.DISPENSARY,
      },
    });
    const service = createService(prisma, drugStock, {
      billSettledDrugDispenseLine,
    });

    const result = await service.create(
      admissionId,
      { ...baseDto, quantity: 2.5, pharmacyLocationId: locationId },
      nurseId,
    );

    expect(drugStock.getAvailableQuantity).toHaveBeenCalledWith(
      prisma,
      drugId,
      locationId,
    );
    expect(billSettledDrugDispenseLine).toHaveBeenCalledWith(
      {
        encounterId: 'enc-1',
        patientId: 'pat-1',
        drugId,
        quantity: 3,
        staffId: nurseId,
        dispensaryLocationId: locationId,
      },
      prisma,
    );
    expect(drugStock.deductDrugStockFifo).toHaveBeenCalledWith(
      prisma,
      drugId,
      3,
      locationId,
    );
    expect(prisma.medicationAdministration.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          pharmacyLocationId: locationId,
          stockDeductedQuantity: 3,
          invoiceItemId: 'item-1',
        }),
      }),
    );
    expect(result.pharmacyLocation).toEqual({
      id: locationId,
      name: 'Ward Dispensary',
      locationType: PharmacyLocationType.DISPENSARY,
      isActive: true,
    });
    expect(result.stockDeductedQuantity).toBe(3);
    expect(result.invoiceItem?.id).toBe('item-1');
  });

  it('throws 422 when insufficient stock at dispensary', async () => {
    const prisma: any = {
      ...admissionPrismaMocks(),
      medicationOrder: {
        findFirst: jest.fn().mockResolvedValue(baseOrder),
      },
      pharmacyLocation: {
        findUnique: jest.fn().mockResolvedValue({
          id: locationId,
          name: 'Ward Dispensary',
          locationType: PharmacyLocationType.DISPENSARY,
        }),
      },
    };
    const service = createService(prisma, {
      getAvailableQuantity: jest.fn().mockResolvedValue(2),
    });

    await expect(
      service.create(
        admissionId,
        { ...baseDto, quantity: 2.5, pharmacyLocationId: locationId },
        nurseId,
      ),
    ).rejects.toThrow(UnprocessableEntityException);

    await expect(
      service.create(
        admissionId,
        { ...baseDto, quantity: 2.5, pharmacyLocationId: locationId },
        nurseId,
      ),
    ).rejects.toThrow(
      'Insufficient stock at Ward Dispensary. Available: 2, required: 3',
    );
  });

  it('throws 400 for invalid pharmacy location', async () => {
    const prisma: any = {
      ...admissionPrismaMocks(),
      medicationOrder: {
        findFirst: jest.fn().mockResolvedValue(baseOrder),
      },
      pharmacyLocation: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
    };
    const service = createService(prisma);

    await expect(
      service.create(
        admissionId,
        { ...baseDto, pharmacyLocationId: locationId },
        nurseId,
      ),
    ).rejects.toThrow(new BadRequestException('Invalid pharmacy location'));
  });

  it('throws 400 when location is not DISPENSARY type', async () => {
    const prisma: any = {
      ...admissionPrismaMocks(),
      medicationOrder: {
        findFirst: jest.fn().mockResolvedValue(baseOrder),
      },
      pharmacyLocation: {
        findUnique: jest.fn().mockResolvedValue({
          id: locationId,
          name: 'Main Store',
          locationType: PharmacyLocationType.STORE,
        }),
      },
    };
    const service = createService(prisma);

    await expect(
      service.create(
        admissionId,
        { ...baseDto, pharmacyLocationId: locationId },
        nurseId,
      ),
    ).rejects.toThrow(new BadRequestException('Invalid pharmacy location'));
  });

  it('ignores pharmacyLocationId when status is not GIVEN', async () => {
    const created = marCreateResult({
      status: MedicationAdminStatus.MISSED,
      quantity: null,
      actualTime: null,
      invoiceItem: null,
    });
    const prisma: any = {
      ...admissionPrismaMocks(),
      medicationOrder: {
        findFirst: jest.fn().mockResolvedValue(baseOrder),
      },
      $transaction: jest
        .fn()
        .mockImplementation(async (cb: (tx: any) => unknown) => cb(prisma)),
      medicationAdministration: {
        create: jest.fn().mockResolvedValue(created),
      },
    };
    const drugStock = {
      getAvailableQuantity: jest.fn(),
      deductDrugStockFifo: jest.fn(),
    };
    const service = createService(prisma, drugStock);

    await service.create(
      admissionId,
      {
        medicationOrderId: orderId,
        scheduledTime: baseDto.scheduledTime,
        status: MedicationAdminStatus.MISSED,
        reasonIfNotGiven: 'Patient asleep',
        pharmacyLocationId: locationId,
      },
      nurseId,
    );

    expect(drugStock.getAvailableQuantity).not.toHaveBeenCalled();
    expect(drugStock.deductDrugStockFifo).not.toHaveBeenCalled();
    expect(prisma.medicationAdministration.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          pharmacyLocationId: null,
          stockDeductedQuantity: null,
        }),
      }),
    );
  });

  it('throws 404 when medication order not on admission', async () => {
    const prisma: any = {
      ...admissionPrismaMocks(),
      medicationOrder: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };
    const service = createService(prisma);

    await expect(
      service.create(admissionId, baseDto, nurseId),
    ).rejects.toThrow(new NotFoundException('Medication order not found'));
  });

  it('throws 400 when order has no drugId but dispensary selected', async () => {
    const prisma: any = {
      ...admissionPrismaMocks(),
      medicationOrder: {
        findFirst: jest.fn().mockResolvedValue({ ...baseOrder, drugId: null }),
      },
      pharmacyLocation: {
        findUnique: jest.fn().mockResolvedValue({
          id: locationId,
          name: 'Ward Dispensary',
          locationType: PharmacyLocationType.DISPENSARY,
        }),
      },
    };
    const service = createService(prisma);

    await expect(
      service.create(
        admissionId,
        { ...baseDto, pharmacyLocationId: locationId },
        nurseId,
      ),
    ).rejects.toThrow(
      new BadRequestException(
        'Cannot deduct stock: medication order has no linked catalog drug.',
      ),
    );
  });
});
