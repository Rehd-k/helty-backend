import { RadiologyInvestigationsService } from './radiology-investigations.service';

describe('RadiologyInvestigationsService', () => {
  const prisma = {
    radiologyOrderItem: { findMany: jest.fn() },
  };

  let service: RadiologyInvestigationsService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.radiologyOrderItem.findMany.mockResolvedValue([]);
    service = new RadiologyInvestigationsService(prisma as any);
  });

  it('aggregates summary by department and test name', async () => {
    prisma.radiologyOrderItem.findMany.mockResolvedValue([
      {
        id: 'ri-1',
        scanType: 'X_RAY',
        bodyPart: 'Chest',
        status: 'PENDING',
        priority: 'ROUTINE',
        createdAt: new Date('2026-06-20T10:00:00Z'),
        order: {
          department: { id: 'dept-1', name: 'Emergency' },
          patient: {
            id: 'p1',
            patientId: 'P001',
            firstName: 'Jane',
            otherName: 'Q',
            surname: 'Public',
          },
        },
        invoiceItem: {
          quantity: 1,
          unitPrice: 12000,
          invoice: { id: 'inv-1', invoiceID: 'INV-1', status: 'PAID' },
          service: null,
        },
      },
    ]);

    const summary = await service.getSummary({
      fromDate: '2026-06-20',
      toDate: '2026-06-20',
    });

    expect(summary.totalCount).toBe(1);
    expect(summary.totalAmount).toBe(12000);
    expect(summary.byDepartment).toEqual([
      expect.objectContaining({
        departmentId: 'dept-1',
        departmentName: 'Emergency',
        count: 1,
        amount: 12000,
      }),
    ]);
    expect(summary.byTestName[0].testName).toBe('X_RAY - Chest');
  });

  it('filters by departmentId in prisma where clause', async () => {
    await service.list({ departmentId: 'dept-1', skip: 0, take: 10 });

    expect(prisma.radiologyOrderItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            { order: { departmentId: 'dept-1' } },
          ]),
        }),
      }),
    );
  });
});
