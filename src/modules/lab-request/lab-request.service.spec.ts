import { LabRequestService } from './lab-request.service';

describe('LabRequestService', () => {
  const invoiceService = {
    assertInpatientCreditAllowed: jest.fn(),
    assertServiceCategoryForEncounterBilling: jest.fn().mockResolvedValue(undefined),
    createWithServiceItem: jest.fn().mockResolvedValue({
      invoice: { id: 'inv-1' },
      invoiceItemId: 'item-1',
    }),
  };

  const prisma = {
    encounter: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'enc-1',
        patientId: 'pat-1',
      }),
    },
    labRequest: {
      create: jest.fn().mockResolvedValue({ id: 'req-1' }),
      update: jest.fn().mockResolvedValue({
        id: 'req-1',
        invoiceId: 'inv-1',
        invoiceItemId: 'item-1',
      }),
      findUniqueOrThrow: jest.fn(),
    },
  };

  let service: LabRequestService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new LabRequestService(prisma as any, invoiceService as any);
  });

  it('creates billed lab request without checking active admission', async () => {
    await service.create({
      encounterId: 'enc-1',
      patientId: 'pat-1',
      requestedByDoctorId: 'doc-1',
      serviceId: 'svc-1',
    });

    expect(invoiceService.assertInpatientCreditAllowed).not.toHaveBeenCalled();
    expect(invoiceService.createWithServiceItem).toHaveBeenCalledWith({
      patientId: 'pat-1',
      encounterId: 'enc-1',
      staffId: 'doc-1',
      serviceId: 'svc-1',
    });
  });
});
