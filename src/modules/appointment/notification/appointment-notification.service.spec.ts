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
    patientFamilyLink: {
      findMany: jest.fn().mockResolvedValue([]),
    },
  };

  const mailService: any = {
    sendAppointmentNotification: jest.fn(),
  };

  const smsService: any = {
    sendAppointmentSms: jest.fn(),
  };

  const fcmService: any = {
    sendToPatient: jest.fn(),
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
      fcmService,
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
    expect(fcmService.sendToPatient).not.toHaveBeenCalled();
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
    fcmService.sendToPatient.mockResolvedValue({
      status: 'SKIPPED_CONFIG',
    });
    prisma.appointmentNotification.create.mockImplementation(({ data }: any) =>
      Promise.resolve({ id: 'new', ...data }),
    );

    await service.notifyCreated('appt-1');

    expect(prisma.appointmentNotification.create).toHaveBeenCalledTimes(3);
    expect(prisma.appointmentNotification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'SKIPPED_CONFIG' }),
      }),
    );
  });

  it('persists SKIPPED_NO_CONTACT for PUSH when patient has no tokens', async () => {
    prisma.appointment.findUnique.mockResolvedValue({
      id: 'appt-1',
      patientId: 'pat-1',
      date: new Date('2026-05-27T09:00:00.000Z'),
      patient: {
        id: 'pat-1',
        firstName: 'Jane',
        surname: 'Doe',
        email: null,
        phoneNumber: null,
      },
    });
    prisma.appointmentNotification.findUnique.mockResolvedValue(null);
    mailService.sendAppointmentNotification.mockResolvedValue({
      status: 'SKIPPED_NO_CONTACT',
    });
    smsService.sendAppointmentSms.mockResolvedValue({
      status: 'SKIPPED_NO_CONTACT',
    });
    fcmService.sendToPatient.mockResolvedValue({
      status: 'SKIPPED_NO_CONTACT',
    });
    prisma.appointmentNotification.create.mockImplementation(({ data }: any) =>
      Promise.resolve({ id: 'new', ...data }),
    );

    await service.notifyCreated('appt-1');

    expect(fcmService.sendToPatient).toHaveBeenCalledWith(
      'pat-1',
      expect.objectContaining({
        title: expect.any(String),
        body: expect.any(String),
      }),
    );
    expect(prisma.appointmentNotification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          channel: 'PUSH',
          status: 'SKIPPED_NO_CONTACT',
        }),
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
    smsService.sendAppointmentSms.mockResolvedValue({
      status: 'SENT',
      provider: 'test',
    });
    mailService.sendAppointmentNotification.mockResolvedValue({
      status: 'SKIPPED_NO_CONTACT',
    });
    fcmService.sendToPatient.mockResolvedValue({
      status: 'SKIPPED_NO_CONTACT',
    });
    prisma.appointmentNotification.create.mockImplementation(({ data }: any) =>
      Promise.resolve({ id: 'new', ...data }),
    );

    const sentCount = await service.sendDayOfReminders(
      new Date('2026-05-27T05:00:00.000Z'),
    );

    expect(smsService.sendAppointmentSms).toHaveBeenCalledTimes(1);
    expect(sentCount).toBe(1);
  });

  it('sends day-before reminders for tomorrow appointments', async () => {
    prisma.appointment.findMany.mockResolvedValue([
      {
        id: 'appt-tomorrow',
        patientId: 'pat-1',
        date: new Date('2026-05-28T09:00:00.000Z'),
        status: 'scheduled',
        patient: {
          id: 'pat-1',
          firstName: 'Jane',
          surname: 'Doe',
          email: 'jane@example.com',
          phoneNumber: '+2348000000000',
        },
      },
    ]);
    prisma.appointmentNotification.findUnique.mockResolvedValue(null);
    mailService.sendAppointmentNotification.mockResolvedValue({
      status: 'SENT',
      provider: 'test',
    });
    smsService.sendAppointmentSms.mockResolvedValue({
      status: 'SENT',
      provider: 'test',
    });
    fcmService.sendToPatient.mockResolvedValue({
      status: 'SENT',
      provider: 'fcm',
    });
    prisma.appointmentNotification.create.mockImplementation(({ data }: any) =>
      Promise.resolve({ id: 'new', ...data }),
    );

    const sentCount = await service.sendDayBeforeReminders(
      new Date('2026-05-27T05:00:00.000Z'),
    );

    expect(prisma.appointment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          date: expect.objectContaining({
            gte: expect.any(Date),
            lte: expect.any(Date),
          }),
        }),
      }),
    );
    expect(fcmService.sendToPatient).toHaveBeenCalled();
    expect(sentCount).toBe(3);
  });
});
