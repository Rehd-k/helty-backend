import {
  BadRequestException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  AccountType,
  AdmissionStatus,
  MedicationAdminStatus,
  MedicationAdministrationLifecycleStatus,
  MedicationScheduleStatus,
  PharmacyLocationType,
  Prisma,
  StaffRole,
} from '@prisma/client';
import { MedicationAdministrationService } from './medication-administration.service';
import { DrugStockService } from '../pharmacy/drug-stock.service';
import { InvoiceService } from '../invoice/invoice.service';
import { MedicationScheduleService } from '../medication-schedule/medication-schedule.service';

jest.mock('../../common/utils/human-readable-id.util', () => ({
  generateHumanReadableId: jest.fn().mockReturnValue('ID001'),
}));

jest.mock('../pharmacy/pharmacy-payer-type.util', () => ({
  resolvePharmacyPayerType: jest.fn().mockResolvedValue('Cash'),
}));

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

const baseSchedule = {
  id: 'sched-1',
  medicationOrderId: orderId,
  scheduleStartedAt: null,
  courseEndsAt: null,
  nextDueAt: null,
  lastAdministeredAt: null,
  doseSequenceNumber: 0,
  scheduleStatus: MedicationScheduleStatus.NOT_STARTED,
  dosesPerDay: null,
  frequencyIntervalHours: null,
  durationValue: null,
  durationUnit: null,
  beyondDurationConsentAt: null,
  beyondDurationConsentById: null,
  beyondDurationConsentNote: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function createScheduleServiceMock(
  overrides: Partial<MedicationScheduleService> = {},
) {
  const service = {
    ensureScheduleForOrder: jest.fn().mockResolvedValue(baseSchedule),
    recomputeScheduleStatus: jest
      .fn()
      .mockReturnValue(MedicationScheduleStatus.ACTIVE),
    buildScheduleUpdateFromAdministration: jest.fn().mockReturnValue({
      scheduleData: { scheduleStatus: MedicationScheduleStatus.ACTIVE },
      doseNumber: 1,
      isFirstDose: true,
    }),
    syncAlertsForSchedule: jest.fn().mockResolvedValue(undefined),
    mapScheduleToApi: jest.fn().mockReturnValue({
      scheduleStatus: MedicationScheduleStatus.ACTIVE,
      doseSequenceNumber: 1,
    }),
    ...overrides,
  };
  return service as unknown as MedicationScheduleService;
}

function createService(
  prisma: Record<string, unknown>,
  drugStockService: Partial<DrugStockService> = {},
  invoiceService: Partial<InvoiceService> = {},
  scheduleService: Partial<MedicationScheduleService> = {},
) {
  return new MedicationAdministrationService(
    prisma as never,
    {
      getAvailableQuantity: jest.fn().mockResolvedValue(10),
      applyFifoOut: jest.fn().mockResolvedValue(undefined),
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
    createScheduleServiceMock(scheduleService),
  );
}

function scheduleAwareTransaction(prisma: any, created: ReturnType<typeof marCreateResult>) {
  prisma.$transaction = jest.fn().mockImplementation(async (cb: (tx: any) => unknown) => {
    const tx = {
      ...prisma,
      medicationAdministration: {
        create: jest.fn().mockResolvedValue({ id: 'mar-1' }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          ...created,
          medicationOrder: {
            ...baseOrder,
            frequency: 'TDS',
            duration: '7 days',
            administrationStatus: MedicationAdministrationLifecycleStatus.ACTIVE,
            doseSchedule: baseSchedule,
          },
        }),
      },
      medicationOrderSchedule: {
        update: jest.fn().mockResolvedValue(baseSchedule),
        findUniqueOrThrow: jest.fn().mockResolvedValue(baseSchedule),
      },
    };
    return cb(tx);
  });
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

function orderWithSchedule(overrides: Record<string, unknown> = {}) {
  return {
    ...baseOrder,
    frequency: 'TDS',
    duration: '7 days',
    administrationStatus: MedicationAdministrationLifecycleStatus.ACTIVE,
    doseSchedule: baseSchedule,
    ...overrides,
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
        findFirst: jest.fn().mockResolvedValue({
          ...baseOrder,
          frequency: 'TDS',
          duration: '7 days',
          administrationStatus: MedicationAdministrationLifecycleStatus.ACTIVE,
          doseSchedule: baseSchedule,
        }),
      },
      medicationAdministration: {
        create: jest.fn().mockResolvedValue(created),
      },
    };
    scheduleAwareTransaction(prisma, created);
    const drugStock = {
      getAvailableQuantity: jest.fn(),
      applyFifoOut: jest.fn(),
    };
    const billSettledDrugDispenseLine = jest.fn();
    const service = createService(prisma, drugStock, {
      billSettledDrugDispenseLine,
    });

    const result = await service.create(admissionId, baseDto, nurseId);

    expect(billSettledDrugDispenseLine).not.toHaveBeenCalled();
    expect(drugStock.getAvailableQuantity).not.toHaveBeenCalled();
    expect(drugStock.applyFifoOut).not.toHaveBeenCalled();
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
        findFirst: jest.fn().mockResolvedValue(orderWithSchedule()),
      },
      pharmacyLocation: {
        findUnique: jest.fn().mockResolvedValue({
          id: locationId,
          name: 'Ward Dispensary',
          locationType: PharmacyLocationType.DISPENSARY,
        }),
      },
    };
    scheduleAwareTransaction(prisma, created);
    const drugStock = {
      getAvailableQuantity: jest.fn().mockResolvedValue(10),
      applyFifoOut: jest.fn().mockResolvedValue(undefined),
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
      expect.anything(),
    );
    expect(drugStock.applyFifoOut).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        drugId,
        locationId,
        quantity: 3,
        ctx: expect.objectContaining({
          invoiceItemId: 'item-1',
          dispensedById: nurseId,
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
        findFirst: jest.fn().mockResolvedValue(orderWithSchedule()),
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
        findFirst: jest.fn().mockResolvedValue(orderWithSchedule()),
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
        findFirst: jest.fn().mockResolvedValue(orderWithSchedule()),
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
        findFirst: jest.fn().mockResolvedValue(orderWithSchedule()),
      },
    };
    scheduleAwareTransaction(prisma, created);
    const drugStock = {
      getAvailableQuantity: jest.fn(),
      applyFifoOut: jest.fn(),
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
    expect(drugStock.applyFifoOut).not.toHaveBeenCalled();
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

  it('accepts legacy orders linked via encounter only (no admissionId on order)', async () => {
    const legacyOrder = orderWithSchedule({
      admissionId: null,
      encounterId: 'enc-1',
    });
    const created = marCreateResult();
    const prisma: any = {
      ...admissionPrismaMocks(),
      medicationOrder: {
        findFirst: jest.fn().mockResolvedValue(legacyOrder),
      },
    };
    scheduleAwareTransaction(prisma, created);
    const service = createService(prisma);

    await service.create(admissionId, baseDto, nurseId);

    expect(prisma.medicationOrder.findFirst).toHaveBeenCalledWith({
      where: {
        id: orderId,
        OR: [{ admissionId }, { encounter: { admissionId } }],
      },
      include: { doseSchedule: true },
    });
  });

  it('throws 400 when order has no drugId but dispensary selected', async () => {
    const prisma: any = {
      ...admissionPrismaMocks(),
      medicationOrder: {
        findFirst: jest.fn().mockResolvedValue(orderWithSchedule({ drugId: null })),
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

  it('throws 409 COURSE_DURATION_EXPIRED when GIVEN on expired course without consent', async () => {
    const expiredSchedule = {
      ...baseSchedule,
      scheduleStartedAt: new Date('2026-06-01T08:00:00.000Z'),
      courseEndsAt: new Date('2026-06-10T08:00:00.000Z'),
      scheduleStatus: MedicationScheduleStatus.EXPIRED,
    };
    const prisma: any = {
      ...admissionPrismaMocks(),
      medicationOrder: {
        findFirst: jest.fn().mockResolvedValue(
          orderWithSchedule({ doseSchedule: expiredSchedule }),
        ),
      },
    };
    const scheduleService = createScheduleServiceMock({
      recomputeScheduleStatus: jest
        .fn()
        .mockReturnValue(MedicationScheduleStatus.EXPIRED),
    });
    const service = new MedicationAdministrationService(
      prisma as never,
      { getAvailableQuantity: jest.fn() } as never,
      {} as never,
      scheduleService,
    );

    await expect(
      service.create(admissionId, baseDto, nurseId),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'COURSE_DURATION_EXPIRED' }),
    });
  });
});
