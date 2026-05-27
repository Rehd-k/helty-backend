import { ConfigService } from '@nestjs/config';
import { AppointmentNotificationService } from './appointment-notification.service';

describe('AppointmentNotificationService', () => {
  const prisma: any = {
    appointment: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    appointmentNotification: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  };

  const mailService: any = {
    sendAppointmentNotification: jest.fn(),
  };

  const smsService: any = {
    sendAppointmentSms: jest.fn(),
  };

  const config = {
    get: jest.fn((key: string) => {
      if (key === 'HOSPITAL_NAME') return 'Helty Hospital';
      return undefined;
    }),
  } as unknown as ConfigService;

  let service: AppointmentNotificationService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AppointmentNotificationService(
      prisma,
      mailService,
      smsService,
      config,
    );
  });

  it('skips duplicate notifications by idempotency key', async () => {
    prisma.appointment.findUnique.mockResolvedValue({
      id: 'appt-1',
      patientId: 'pat-1',
      date: new Date('2026-05-27T09:00:00.000Z'),
      patient: {
        id: 'pat-1',
        firstName: 'Jane',
        surname: 'Doe',
        email: 'jane@example.com',
        phoneNumber: '+2348000000000',
      },
    });
    prisma.appointmentNotification.findUnique.mockResolvedValue({
      id: 'notif-1',
      channel: 'EMAIL',
      kind: 'CREATED',
      status: 'SENT',
    });

    await service.notifyCreated('appt-1');

    expect(mailService.sendAppointmentNotification).not.toHaveBeenCalled();
    expect(smsService.sendAppointmentSms).not.toHaveBeenCalled();
    expect(prisma.appointmentNotification.create).not.toHaveBeenCalled();
  });

  it('persists skipped config when providers are missing', async () => {
    prisma.appointment.findUnique.mockResolvedValue({
      id: 'appt-1',
      patientId: 'pat-1',
      date: new Date('2026-05-27T09:00:00.000Z'),
      patient: {
        id: 'pat-1',
        firstName: 'Jane',
        surname: 'Doe',
        email: 'jane@example.com',
        phoneNumber: '+2348000000000',
      },
    });
    prisma.appointmentNotification.findUnique.mockResolvedValue(null);
    mailService.sendAppointmentNotification.mockResolvedValue({
      status: 'SKIPPED_CONFIG',
    });
    smsService.sendAppointmentSms.mockResolvedValue({
      status: 'SKIPPED_CONFIG',
    });
    prisma.appointmentNotification.create.mockImplementation(({ data }: any) =>
      Promise.resolve({ id: 'new', ...data }),
    );

    await service.notifyCreated('appt-1');

    expect(prisma.appointmentNotification.create).toHaveBeenCalledTimes(2);
    expect(prisma.appointmentNotification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'SKIPPED_CONFIG' }),
      }),
    );
  });

  it('sends day-of reminders only for eligible appointments', async () => {
    prisma.appointment.findMany.mockResolvedValue([
      {
        id: 'appt-1',
        patientId: 'pat-1',
        date: new Date('2026-05-27T09:00:00.000Z'),
        status: 'scheduled',
        patient: {
          id: 'pat-1',
          firstName: 'Jane',
          surname: 'Doe',
          email: null,
          phoneNumber: '+2348000000000',
        },
      },
      {
        id: 'appt-2',
        patientId: 'pat-2',
        date: new Date('2026-05-27T11:00:00.000Z'),
        status: 'cancelled',
        patient: {
          id: 'pat-2',
          firstName: 'John',
          surname: 'Smith',
          email: null,
          phoneNumber: '+2348111111111',
        },
      },
    ]);
    prisma.appointmentNotification.findUnique.mockResolvedValue(null);
    smsService.sendAppointmentSms.mockResolvedValue({ status: 'SENT', provider: 'test' });
    prisma.appointmentNotification.create.mockImplementation(({ data }: any) =>
      Promise.resolve({ id: 'new', ...data }),
    );

    const sentCount = await service.sendDayOfReminders(
      new Date('2026-05-27T05:00:00.000Z'),
    );

    expect(smsService.sendAppointmentSms).toHaveBeenCalledTimes(1);
    expect(sentCount).toBe(1);
  });
});
