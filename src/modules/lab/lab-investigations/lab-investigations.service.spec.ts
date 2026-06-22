import { LabInvestigationsService } from './lab-investigations.service';

describe('LabInvestigationsService', () => {
  const prisma = {
    labOrderItem: { findMany: jest.fn() },
    labRequest: { findMany: jest.fn() },
  };

  let service: LabInvestigationsService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.labOrderItem.findMany.mockResolvedValue([]);
    prisma.labRequest.findMany.mockResolvedValue([]);
    service = new LabInvestigationsService(prisma as any);
  });

  it('aggregates summary totals from order items and requests', async () => {
    prisma.labOrderItem.findMany.mockResolvedValue([
      {
        id: 'oi-1',
        status: 'PENDING',
        createdAt: new Date('2026-06-20T10:00:00Z'),
        sample: null,
        testVersion: { test: { name: 'CBC', price: 5000 } },
        order: {
          sampleCollectedAt: null,
          patient: {
            id: 'p1',
            patientId: 'P001',
            firstName: 'Ada',
            otherName: 'M',
            surname: 'Lovelace',
            ward: null,
          },
          invoiceItem: {
            quantity: 1,
            unitPrice: 5000,
            invoice: { id: 'inv-1', invoiceID: 'INV-1', status: 'PAID' },
            service: { department: null },
          },
        },
      },
    ]);
    prisma.labRequest.findMany.mockResolvedValue([
      {
        id: 'lr-1',
        testType: 'HIV',
        status: 'COLLECTED',
        createdAt: new Date('2026-06-20T11:00:00Z'),
        updatedAt: new Date('2026-06-20T11:30:00Z'),
        patient: {
          id: 'p2',
          patientId: 'P002',
          firstName: 'John',
          otherName: null,
          surname: 'Doe',
          ward: { id: 'ward-1', name: 'OPD' },
        },
        invoiceItem: {
          quantity: 1,
          unitPrice: 3000,
          invoice: { id: 'inv-2', invoiceID: 'INV-2', status: 'PAID' },
          service: { name: 'HIV Screen', department: null },
        },
      },
    ]);

    const summary = await service.getSummary({
      fromDate: '2026-06-20',
      toDate: '2026-06-20',
    });

    expect(summary.totalCount).toBe(2);
    expect(summary.totalAmount).toBe(8000);
    expect(summary.sampleCollectedCount).toBe(1);
    expect(summary.samplePendingCount).toBe(1);
    expect(summary.byTestName).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ testName: 'CBC', count: 1, amount: 5000 }),
        expect.objectContaining({ testName: 'HIV', count: 1, amount: 3000 }),
      ]),
    );
  });

  it('filters order items by testName in prisma where clause', async () => {
    await service.list({ testName: 'CBC', skip: 0, take: 10 });

    expect(prisma.labOrderItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({
              OR: expect.arrayContaining([
                expect.objectContaining({
                  testVersion: expect.objectContaining({
                    test: { name: { contains: 'CBC', mode: 'insensitive' } },
                  }),
                }),
              ]),
            }),
          ]),
        }),
      }),
    );
  });

  it('sorts list rows by amount descending', async () => {
    prisma.labOrderItem.findMany.mockResolvedValue([
      {
        id: 'oi-low',
        status: 'PENDING',
        createdAt: new Date('2026-06-20T09:00:00Z'),
        sample: null,
        testVersion: { test: { name: 'Low', price: 100 } },
        order: {
          sampleCollectedAt: null,
          patient: {
            id: 'p1',
            patientId: null,
            firstName: 'A',
            otherName: null,
            surname: 'B',
            ward: null,
          },
          invoiceItem: null,
        },
      },
      {
        id: 'oi-high',
        status: 'PENDING',
        createdAt: new Date('2026-06-20T08:00:00Z'),
        sample: null,
        testVersion: { test: { name: 'High', price: 900 } },
        order: {
          sampleCollectedAt: null,
          patient: {
            id: 'p2',
            patientId: null,
            firstName: 'C',
            otherName: null,
            surname: 'D',
            ward: null,
          },
          invoiceItem: null,
        },
      },
    ]);

    const result = await service.list({
      sortBy: 'amount' as any,
      sortOrder: 'desc' as any,
      skip: 0,
      take: 10,
    });

    expect(result.data[0].testName).toBe('High');
    expect(result.data[1].testName).toBe('Low');
  });
});
