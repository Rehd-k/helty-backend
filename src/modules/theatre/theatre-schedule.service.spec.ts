import { BadRequestException, ConflictException } from '@nestjs/common';
import { SurgeryRequestStatus } from '@prisma/client';
import { TheatreScheduleService } from './theatre-schedule.service';

describe('TheatreScheduleService', () => {
  const prisma = {
    surgeryRequest: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    theatreRoom: {
      findUnique: jest.fn().mockResolvedValue({ id: 'room-1', isActive: true }),
    },
    staff: { findUnique: jest.fn().mockResolvedValue({ id: 'staff-1' }) },
    theatreSchedule: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({ id: 'sch-1' }),
      findUnique: jest.fn(),
      update: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
    },
    $transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        theatreSchedule: {
          create: jest.fn().mockResolvedValue({ id: 'sch-1' }),
        },
        surgeryRequest: {
          update: jest.fn(),
        },
      }),
    ),
  };

  let service: TheatreScheduleService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TheatreScheduleService(prisma as any);
  });

  it('schedules a requested surgery', async () => {
    prisma.surgeryRequest.findUnique.mockResolvedValue({
      id: 'req-1',
      status: SurgeryRequestStatus.REQUESTED,
      schedule: null,
    });

    await service.create({
      surgeryRequestId: 'req-1',
      theatreRoomId: 'room-1',
      scheduledAt: '2026-06-25T09:00:00.000Z',
      surgeonId: 'staff-1',
    });

    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it('rejects scheduling non-requested surgery', async () => {
    prisma.surgeryRequest.findUnique.mockResolvedValue({
      id: 'req-1',
      status: SurgeryRequestStatus.SCHEDULED,
      schedule: null,
    });

    await expect(
      service.create({
        surgeryRequestId: 'req-1',
        theatreRoomId: 'room-1',
        scheduledAt: '2026-06-25T09:00:00.000Z',
        surgeonId: 'staff-1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('detects room scheduling conflicts', async () => {
    prisma.surgeryRequest.findUnique.mockResolvedValue({
      id: 'req-1',
      status: SurgeryRequestStatus.REQUESTED,
      schedule: null,
    });
    prisma.theatreSchedule.findMany.mockResolvedValue([
      {
        id: 'other',
        scheduledAt: new Date('2026-06-25T09:00:00.000Z'),
        estimatedDurationMins: 120,
      },
    ]);

    await expect(
      service.create({
        surgeryRequestId: 'req-1',
        theatreRoomId: 'room-1',
        scheduledAt: '2026-06-25T09:30:00.000Z',
        estimatedDurationMins: 60,
        surgeonId: 'staff-1',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
