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
  };

  const prisma = {
    patient: { findUnique: jest.fn().mockResolvedValue({ id: 'pat-1' }) },
    encounter: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'enc-1',
        patientId: 'pat-1',
      }),
    },
    staff: { findUnique: jest.fn().mockResolvedValue({ id: 'doc-1' }) },
    department: { findUnique: jest.fn() },
    $transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        radiologyOrder: {
          create: jest.fn().mockResolvedValue({
            id: 'ord-1',
            items: [],
          }),
        },
      }),
    ),
  };

  let service: RadiologyRequestService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new RadiologyRequestService(prisma as any, invoiceService as any);
  });

  it('encounter-billed imaging skips admission and consumable payment checks', async () => {
    await service.create({
      patientId: 'pat-1',
      encounterId: 'enc-1',
      requestedById: 'doc-1',
      items: [
        {
          scanType: 'XRAY' as any,
          serviceId: 'svc-1',
        },
      ],
    });

    expect(invoiceService.assertInpatientCreditAllowed).not.toHaveBeenCalled();
    expect(invoiceService.assertPaidInvoiceItemConsumable).not.toHaveBeenCalled();
    expect(invoiceService.createWithServiceItem).toHaveBeenCalled();
  });
});
