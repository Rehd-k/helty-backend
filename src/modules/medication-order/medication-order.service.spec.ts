import { EncounterStatus, Prisma } from '@prisma/client';
import { MedicationOrderService } from './medication-order.service';
import { CreateMedicationOrderDto } from './dto/create-medication-order.dto';

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

describe('MedicationOrderService create', () => {
  const encounterId = 'enc-1';
  const patientId = 'pat-1';
  const doctorId = 'doc-1';
  const drugId = 'drug-1';

  const baseDto: CreateMedicationOrderDto = {
    patientId,
    doctorId,
    encounterId,
    drugId,
    frequency: 'Twice daily (BD / BID)',
    duration: '7 days',
    route: 'Oral',
    administrationStatus: 'ACTIVE',
  };

  const drug = {
    id: drugId,
    genericName: 'Paracetamol',
    batches: [{ id: 'batch-1', quantityRemaining: 100, expiryDate: new Date() }],
  };

  let medicationOrderCreate: jest.Mock;
  let medicationRequestCreate: jest.Mock;
  let medicationOrderFindUniqueOrThrow: jest.Mock;
  let ensureInvoiceForEncounter: jest.Mock;
  let addDrugItem: jest.Mock;
  let service: MedicationOrderService;
  let prisma: any;
  let invoiceService: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockIsOutpatientPatient.mockResolvedValue(false);

    medicationOrderCreate = jest.fn().mockImplementation(({ data }) => ({
      id: 'order-1',
      ...data,
    }));
    medicationRequestCreate = jest.fn();
    medicationOrderFindUniqueOrThrow = jest.fn().mockImplementation(({ where }) => ({
      id: where.id,
      status: 'Prescribed',
      medicationRequests: [],
    }));
    ensureInvoiceForEncounter = jest.fn().mockResolvedValue({ id: 'inv-1' });
    addDrugItem = jest.fn().mockResolvedValue({ id: 'item-1' });

    const tx = {
      medicationOrder: {
        create: medicationOrderCreate,
        findUniqueOrThrow: medicationOrderFindUniqueOrThrow,
      },
      medicationRequest: {
        create: medicationRequestCreate,
      },
    };

    prisma = {
      medicationOrder: { create: medicationOrderCreate },
      $transaction: jest.fn(async (cb: (client: typeof tx) => unknown) =>
        cb(tx),
      ),
      encounter: {
        findUnique: jest.fn().mockResolvedValue({
          id: encounterId,
          patientId,
          status: EncounterStatus.ONGOING,
          admissionId: null,
          admission: null,
        }),
      },
      drug: {
        findUnique: jest.fn().mockResolvedValue(drug),
      },
      patient: {
        findUnique: jest.fn().mockResolvedValue({ id: patientId }),
      },
      staff: {
        findUnique: jest.fn().mockResolvedValue({ id: doctorId }),
      },
    };

    invoiceService = {
      ensureInvoiceForEncounter,
      addDrugItem,
    };

    service = new MedicationOrderService(
      prisma as any,
      invoiceService as any,
      {
        ensureScheduleForOrder: jest.fn().mockResolvedValue({ id: 'sched-1' }),
        mapScheduleToApi: jest.fn().mockReturnValue(null),
        updateScheduleFromDurationChange: jest.fn(),
        stopSchedule: jest.fn(),
      } as any,
    );
  });

  it('creates a prescribed order without billing', async () => {
    await service.create({ ...baseDto, quantity: 14 }, doctorId);

    expect(ensureInvoiceForEncounter).not.toHaveBeenCalled();
    expect(addDrugItem).not.toHaveBeenCalled();
    expect(medicationOrderCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'Prescribed',
          quantity: new Prisma.Decimal(14),
          prescribedDrugId: drugId,
          prescribedDrugName: 'Paracetamol',
        }),
      }),
    );
  });

  it('defaults status to Prescribed when quantity is omitted', async () => {
    await service.create(baseDto, doctorId);

    expect(medicationOrderCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'Prescribed',
          quantity: undefined,
        }),
      }),
    );
  });

  it('auto-creates a medication request for outpatient prescriptions', async () => {
    mockIsOutpatientPatient.mockResolvedValue(true);
    medicationOrderFindUniqueOrThrow.mockResolvedValue({
      id: 'order-1',
      status: 'Prescribed',
      medicationRequests: [
        {
          id: 'req-1',
          requestedQuantity: 20,
          status: 'REQUESTED',
        },
      ],
    });

    const result = await service.create(
      {
        ...baseDto,
        requestedQuantity: 20,
      },
      doctorId,
    );

    expect(medicationRequestCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        medicationOrderId: 'order-1',
        requestedQuantity: 20,
        requestedByNurseId: doctorId,
      }),
    });
    expect(result.medicationRequests).toHaveLength(1);
  });

  it('creates dose schedule for inpatient orders with admissionId', async () => {
    const ensureScheduleForOrder = jest.fn().mockResolvedValue({ id: 'sched-1' });
    service = new MedicationOrderService(
      prisma as any,
      invoiceService as any,
      { ensureScheduleForOrder, mapScheduleToApi: jest.fn() } as any,
    );

    prisma.encounter.findUnique.mockResolvedValue({
      id: encounterId,
      patientId,
      status: EncounterStatus.ONGOING,
      admissionId: 'adm-1',
      admission: { id: 'adm-1' },
    });
    prisma.admission = {
      findUnique: jest.fn().mockResolvedValue({
        id: 'adm-1',
        encounterId,
        patientId,
        encounter: { id: encounterId },
      }),
    };

    await service.create(
      { ...baseDto, admissionId: 'adm-1', quantity: 1 },
      doctorId,
    );

    expect(ensureScheduleForOrder).toHaveBeenCalledWith(
      'order-1',
      expect.anything(),
      expect.objectContaining({ frequency: baseDto.frequency }),
    );
  });
});
