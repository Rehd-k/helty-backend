import { EncounterStatus, Prisma } from '@prisma/client';
import { MedicationOrderService } from './medication-order.service';
import { CreateMedicationOrderDto } from './dto/create-medication-order.dto';

describe('MedicationOrderService create quantities', () => {
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
  let addDrugItem: jest.Mock;
  let service: MedicationOrderService;

  beforeEach(() => {
    jest.clearAllMocks();

    medicationOrderCreate = jest.fn().mockImplementation(({ data }) => ({
      id: 'order-1',
      ...data,
    }));
    addDrugItem = jest.fn().mockResolvedValue({ id: 'item-1' });

    const tx = {
      medicationOrder: { create: medicationOrderCreate },
    };

    const prisma = {
      $transaction: jest.fn(async (cb: (client: typeof tx) => unknown) =>
        cb(tx),
      ),
      encounter: {
        findUnique: jest.fn().mockResolvedValue({
          id: encounterId,
          patientId,
          status: EncounterStatus.ONGOING,
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

    const invoiceService = {
      ensureInvoiceForEncounter: jest
        .fn()
        .mockResolvedValue({ id: 'inv-1' }),
      addDrugItem,
    };

    service = new MedicationOrderService(
      prisma as any,
      invoiceService as any,
    );
  });

  it('persists quantity on the order and invoice when only quantity is sent', async () => {
    await service.create({ ...baseDto, quantity: 14 });

    expect(addDrugItem).toHaveBeenCalledWith(
      expect.objectContaining({ quantity: 14 }),
      expect.anything(),
    );
    expect(medicationOrderCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          quantity: new Prisma.Decimal(14),
        }),
      }),
    );
  });

  it('uses billingQuantity for invoice and quantity for the order when both are sent', async () => {
    await service.create({
      ...baseDto,
      quantity: 2,
      billingQuantity: 14,
    });

    expect(addDrugItem).toHaveBeenCalledWith(
      expect.objectContaining({ quantity: 14 }),
      expect.anything(),
    );
    expect(medicationOrderCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          quantity: new Prisma.Decimal(2),
        }),
      }),
    );
  });

  it('defaults invoice to 1 and leaves order quantity null when neither is sent', async () => {
    await service.create(baseDto);

    expect(addDrugItem).toHaveBeenCalledWith(
      expect.objectContaining({ quantity: 1 }),
      expect.anything(),
    );
    expect(medicationOrderCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          quantity: undefined,
        }),
      }),
    );
  });
});
