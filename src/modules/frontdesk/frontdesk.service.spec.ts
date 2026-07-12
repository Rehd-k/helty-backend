import { PatientFeedbackStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { FrontdeskService } from './frontdesk.service';

function mockPrisma(p: Record<string, unknown>): PrismaService {
  return p as unknown as PrismaService;
}

describe('FrontdeskService', () => {
  const anchor = '2026-03-29T10:00:00.000Z';

  it('dashboardSummary maps appointment counts to compareMetrics', async () => {
    const prisma = mockPrisma({
      appointment: {
        count: jest.fn().mockResolvedValueOnce(8).mockResolvedValueOnce(4),
      },
      waitingPatient: { count: jest.fn().mockResolvedValue(2) },
      admission: { count: jest.fn().mockResolvedValue(0) },
      invoiceItem: { findMany: jest.fn().mockResolvedValue([]) },
      encounter: { findMany: jest.fn().mockResolvedValue([]) },
    });

    const service = new FrontdeskService(prisma);
    const s = await service.dashboardSummary(anchor);

    expect(s.appointmentsToday).toBe(8);
    expect(s.appointmentsYesterday).toBe(4);
    expect(s.appointmentsChange.percentChange).toBe(100);
    expect(s.appointmentsChange.direction).toBe('up');
    expect(s.checkInsToday).toBe(2);
    expect(s.waitingRoomCount).toBe(0);
    expect(s.dischargesToday).toBe(0);
  });

  it('waitingRoomCount counts distinct paid patients minus ongoing OPD', async () => {
    const paidLine = {
      amountPaid: new Prisma.Decimal(15000),
      unitPrice: new Prisma.Decimal(15000),
      quantity: 1,
      isRecurringDaily: false,
      usageSegments: [],
      invoice: { patientId: 'patient-a' },
    };

    const encounterFindMany = jest.fn().mockResolvedValue([]);

    const prisma = mockPrisma({
      appointment: {
        count: jest.fn().mockResolvedValue(0),
      },
      waitingPatient: { count: jest.fn().mockResolvedValue(0) },
      admission: { count: jest.fn().mockResolvedValue(0) },
      invoiceItem: {
        findMany: jest.fn().mockResolvedValue([paidLine]),
      },
      encounter: {
        findMany: encounterFindMany,
      },
    });

    const service = new FrontdeskService(prisma);
    const s = await service.dashboardSummary(anchor);
    expect(s.waitingRoomCount).toBe(1);

    encounterFindMany.mockResolvedValue([{ patientId: 'patient-a' }]);
    const s2 = await service.dashboardSummary(anchor);
    expect(s2.waitingRoomCount).toBe(0);
  });

  it('liveQueue prefers encounter row when patient also has a waiting entry', async () => {
    const prisma = mockPrisma({
      waitingPatient: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'wp-1',
            patientId: 'p1',
            createdAt: new Date('2026-03-29T09:00:00.000Z'),
            consultingRoomId: null,
            patient: {
              id: 'p1',
              firstName: 'Ann',
              otherName: null,
              surname: 'Lee',
              title: null,
            },
            consultingRoom: null,
          },
        ]),
      },
      encounter: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'enc-1',
            patientId: 'p1',
            startTime: new Date('2026-03-29T09:30:00.000Z'),
            patient: {
              id: 'p1',
              firstName: 'Ann',
              otherName: null,
              surname: 'Lee',
              title: null,
            },
            doctor: {
              id: 'd1',
              firstName: 'Dr',
              lastName: 'X',
            },
          },
        ]),
      },
    });

    const service = new FrontdeskService(prisma);
    const q = await service.liveQueue(anchor);

    expect(q).toHaveLength(1);
    expect(q[0].status).toBe('InConsultation');
    expect(q[0].encounterId).toBe('enc-1');
    expect(q[0].waitingPatientId).toBe('wp-1');
    expect(q[0].firstName).toBe('Ann');
    expect(q[0].otherName).toBeNull();
    expect(q[0].surname).toBe('Lee');
    expect(q[0].patientName).toBe('Ann Lee');
  });

  it('liveQueue includes waiting-only row with Waiting status', async () => {
    const prisma = mockPrisma({
      waitingPatient: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'wp-2',
            patientId: 'p2',
            createdAt: new Date('2026-03-29T08:00:00.000Z'),
            consultingRoomId: null,
            patient: {
              id: 'p2',
              firstName: 'Bob',
              otherName: null,
              surname: 'Zed',
              title: null,
            },
            consultingRoom: null,
          },
        ]),
      },
      encounter: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    });

    const service = new FrontdeskService(prisma);
    const q = await service.liveQueue(anchor);

    expect(q).toHaveLength(1);
    expect(q[0].status).toBe('Waiting');
    expect(q[0].id).toBe('wp:wp-2');
  });

  it('lists patient feedback with patient display names', async () => {
    const prisma = mockPrisma({
      patientFeedback: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'fb-1',
            patient: {
              id: 'p1',
              title: null,
              firstName: 'Ann',
              otherName: null,
              surname: 'Lee',
            },
          },
        ]),
        count: jest.fn().mockResolvedValue(1),
      },
    });

    const service = new FrontdeskService(prisma);
    const result = await service.listFeedback({
      status: PatientFeedbackStatus.OPEN,
      page: 1,
      limit: 20,
    });

    expect(result.total).toBe(1);
    expect(result.data[0].patient.patientName).toBe('Ann Lee');
    expect(prisma.patientFeedback.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: PatientFeedbackStatus.OPEN },
      }),
    );
  });

  it('marks feedback as responded by the current staff member', async () => {
    const row = {
      id: 'fb-1',
      status: PatientFeedbackStatus.OPEN,
      patient: {
        id: 'p1',
        title: null,
        firstName: 'Ann',
        otherName: null,
        surname: 'Lee',
      },
    };
    const prisma = mockPrisma({
      patientFeedback: {
        findUnique: jest.fn().mockResolvedValue(row),
        update: jest.fn().mockResolvedValue({
          ...row,
          status: PatientFeedbackStatus.RESOLVED,
          staffResponse: 'Thank you. Resolved.',
        }),
      },
    });

    const service = new FrontdeskService(prisma);
    const result = await service.updateFeedback(
      'fb-1',
      {
        status: PatientFeedbackStatus.RESOLVED,
        staffResponse: 'Thank you. Resolved.',
      },
      'staff-1',
    );

    expect(result.status).toBe(PatientFeedbackStatus.RESOLVED);
    expect(prisma.patientFeedback.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          respondedById: 'staff-1',
          status: PatientFeedbackStatus.RESOLVED,
        }),
      }),
    );
  });
});
