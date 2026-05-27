import { NotFoundException } from '@nestjs/common';
import { AppointmentService } from './appointment.service';

describe('AppointmentService notifications', () => {
  const notificationService: any = {
    notifyCreated: jest.fn().mockResolvedValue(undefined),
    notifyRescheduled: jest.fn().mockResolvedValue(undefined),
    notifyCancelled: jest.fn().mockResolvedValue(undefined),
  };

  const tx: any = {
    appointment: {
      create: jest.fn().mockResolvedValue({ id: 'appt-1' }),
      findUniqueOrThrow: jest.fn().mockResolvedValue({
        id: 'appt-1',
        patientId: 'pat-1',
        date: new Date('2026-05-27T09:00:00.000Z'),
        patient: { id: 'pat-1' },
        encounters: [],
      }),
    },
    encounter: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  const prisma: any = {
    $transaction: jest.fn().mockImplementation((cb) => cb(tx)),
    appointment: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  let service: AppointmentService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AppointmentService(prisma, notificationService);
  });

  it('triggers created notifications after appointment create', async () => {
    await service.create(
      {
        patientId: 'pat-1',
        date: '2026-05-27T09:00:00.000Z',
        status: 'scheduled',
      },
      'staff-1',
    );

    expect(notificationService.notifyCreated).toHaveBeenCalledWith('appt-1');
  });

  it('triggers rescheduled notifications when date changes', async () => {
    const previousDate = new Date('2026-05-27T09:00:00.000Z');
    prisma.appointment.findUnique.mockResolvedValue({
      id: 'appt-1',
      date: previousDate,
      status: 'scheduled',
    });
    prisma.appointment.update.mockResolvedValue({
      id: 'appt-1',
      date: new Date('2026-05-28T09:00:00.000Z'),
      status: 'rescheduled',
    });

    await service.update(
      'appt-1',
      { date: '2026-05-28T09:00:00.000Z', status: 'rescheduled' },
      'staff-1',
    );

    expect(notificationService.notifyRescheduled).toHaveBeenCalledWith(
      'appt-1',
      previousDate,
    );
  });

  it('triggers cancelled notifications when status becomes cancelled', async () => {
    prisma.appointment.findUnique.mockResolvedValue({
      id: 'appt-1',
      date: new Date('2026-05-27T09:00:00.000Z'),
      status: 'scheduled',
    });
    prisma.appointment.update.mockResolvedValue({
      id: 'appt-1',
      status: 'cancelled',
    });

    await service.update('appt-1', { status: 'cancelled' }, 'staff-1');

    expect(notificationService.notifyCancelled).toHaveBeenCalledWith('appt-1');
  });

  it('throws when updating a missing appointment', async () => {
    prisma.appointment.findUnique.mockResolvedValue(null);

    await expect(
      service.update('missing', { status: 'cancelled' }, 'staff-1'),
    ).rejects.toThrow(NotFoundException);
  });
});
