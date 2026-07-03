import {
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { AccountType, MedicalSpecialty } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AppointmentNotificationService } from '../appointment/notification/appointment-notification.service';
import { PatientJwtPayload } from '../patient-auth/patient-auth.service';
import {
  APPOINTMENT_LIST_FILTER,
  PATIENT_PORTAL_SYSTEM_STAFF_ID_ENV,
  PORTAL_APPOINTMENT_STATUS,
} from './patient-appointments.constants';
import { PatientAppointmentsService } from './patient-appointments.service';

describe('PatientAppointmentsService', () => {
  const prisma = {
    appointment: {
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    encounter: {
      findMany: jest.fn(),
    },
    staff: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    consultingRoom: {
      findFirst: jest.fn(),
    },
  };

  const notificationService = {
    notifyCreated: jest.fn(),
    notifyRescheduled: jest.fn(),
    notifyCancelled: jest.fn(),
  };

  const service = new PatientAppointmentsService(
    prisma as unknown as PrismaService,
    notificationService as unknown as AppointmentNotificationService,
  );

  const patientUser: PatientJwtPayload = {
    sub: 'patient-uuid-1',
    patientId: 'AB12CD34',
    accountType: 'PATIENT',
  };

  const doctor = {
    id: 'doctor-1',
    firstName: 'Emem',
    lastName: 'Akpan',
    medicalSpecialty: MedicalSpecialty.CARDIOLOGY,
    department: { name: 'Cardiology' },
  };

  const futureDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  futureDate.setMinutes(0, 0, 0);

  const appointmentRow = {
    id: 'appt-1',
    date: futureDate,
    status: PORTAL_APPOINTMENT_STATUS.CONFIRMED,
    location: 'Wing B',
    reason: 'Follow-up',
    notes: 'Bring ECG',
    createdAt: new Date('2024-10-01T09:00:00.000Z'),
    updatedAt: new Date('2024-10-10T11:00:00.000Z'),
    staff: doctor,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env[PATIENT_PORTAL_SYSTEM_STAFF_ID_ENV] = 'system-staff-1';
  });

  describe('getDashboard', () => {
    it('returns next appointment and consultation history for UPCOMING', async () => {
      const secondDate = new Date(futureDate.getTime() + 60 * 60 * 1000);
      prisma.appointment.findMany.mockResolvedValue([
        appointmentRow,
        { ...appointmentRow, id: 'appt-2', date: secondDate },
      ]);
      prisma.encounter.findMany.mockResolvedValue([
        {
          id: 'enc-1',
          startTime: new Date('2024-09-12T10:00:00.000Z'),
          status: 'COMPLETED',
          chiefComplaint: 'General Checkup',
          visitType: 'OPD',
          primaryIcdDescription: null,
          doctor: {
            firstName: 'David',
            lastName: 'Obi',
            department: null,
          },
          diagnoses: [],
          labRequests: [],
          labReports: [],
        },
      ]);

      const result = await service.getDashboard(patientUser, {
        status: APPOINTMENT_LIST_FILTER.UPCOMING,
      });

      expect(result.nextAppointment?.id).toBe('appt-1');
      expect(result.upcomingAppointments).toHaveLength(1);
      expect(result.consultationHistory).toHaveLength(1);
      expect(result.consultationHistory[0].title).toBe('General Checkup');
    });

    it('returns empty consultation history for PENDING filter', async () => {
      prisma.appointment.findMany.mockResolvedValue([
        { ...appointmentRow, status: PORTAL_APPOINTMENT_STATUS.PENDING },
      ]);

      const result = await service.getDashboard(patientUser, {
        status: APPOINTMENT_LIST_FILTER.PENDING,
      });

      expect(result.nextAppointment).toBeNull();
      expect(result.consultationHistory).toEqual([]);
      expect(result.upcomingAppointments).toHaveLength(1);
    });
  });

  describe('listAppointments', () => {
    it('returns paginated appointments', async () => {
      prisma.appointment.findMany.mockResolvedValue([appointmentRow]);
      prisma.appointment.count.mockResolvedValue(1);

      const result = await service.listAppointments(patientUser, {
        status: APPOINTMENT_LIST_FILTER.UPCOMING,
        page: 1,
        limit: 20,
      });

      expect(result.total).toBe(1);
      expect(result.data[0].id).toBe('appt-1');
    });
  });

  describe('getAppointment', () => {
    it('throws 404 when appointment is not owned by patient', async () => {
      prisma.appointment.findFirst.mockResolvedValue(null);

      await expect(
        service.getAppointment(patientUser, 'missing'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('createAppointment', () => {
    it('throws 422 for past scheduledAt', async () => {
      await expect(
        service.createAppointment(patientUser, {
          doctorId: 'doctor-1',
          scheduledAt: '2020-01-01T08:30:00.000Z',
        }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });

    it('throws 409 when slot is unavailable', async () => {
      prisma.staff.findFirst.mockResolvedValue({ id: 'doctor-1' });
      prisma.appointment.findMany.mockResolvedValue([
        { date: futureDate },
      ]);

      await expect(
        service.createAppointment(patientUser, {
          doctorId: 'doctor-1',
          scheduledAt: futureDate.toISOString(),
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('creates a pending appointment', async () => {
      prisma.staff.findFirst.mockResolvedValue({ id: 'doctor-1' });
      prisma.appointment.findMany.mockResolvedValue([]);
      prisma.consultingRoom.findFirst.mockResolvedValue({
        location: 'Wing B',
        name: 'Room 204',
      });
      prisma.appointment.create.mockResolvedValue({
        ...appointmentRow,
        status: PORTAL_APPOINTMENT_STATUS.PENDING,
      });

      const result = await service.createAppointment(patientUser, {
        doctorId: 'doctor-1',
        scheduledAt: futureDate.toISOString(),
        reason: 'Follow-up',
      });

      expect(prisma.appointment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: PORTAL_APPOINTMENT_STATUS.PENDING,
            staffId: 'doctor-1',
          }),
        }),
      );
      expect(result.status).toBe(PORTAL_APPOINTMENT_STATUS.PENDING);
      expect(notificationService.notifyCreated).toHaveBeenCalledWith('appt-1');
    });
  });

  describe('rescheduleAppointment', () => {
    it('throws 409 when appointment cannot be rescheduled', async () => {
      prisma.appointment.findFirst.mockResolvedValue({
        ...appointmentRow,
        status: PORTAL_APPOINTMENT_STATUS.COMPLETED,
      });

      await expect(
        service.rescheduleAppointment(patientUser, 'appt-1', {
          scheduledAt: futureDate.toISOString(),
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('cancelAppointment', () => {
    it('cancels an upcoming appointment', async () => {
      prisma.appointment.findFirst.mockResolvedValue(appointmentRow);
      prisma.appointment.update.mockResolvedValue({
        id: 'appt-1',
        status: PORTAL_APPOINTMENT_STATUS.CANCELLED,
      });

      const result = await service.cancelAppointment(patientUser, 'appt-1');

      expect(result).toEqual({
        id: 'appt-1',
        status: PORTAL_APPOINTMENT_STATUS.CANCELLED,
      });
      expect(notificationService.notifyCancelled).toHaveBeenCalledWith('appt-1');
    });
  });

  describe('listDoctors', () => {
    it('lists active physicians for a specialty', async () => {
      prisma.staff.findMany.mockResolvedValue([doctor]);

      const result = await service.listDoctors({
        specialtyId: MedicalSpecialty.CARDIOLOGY,
      });

      expect(prisma.staff.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            accountType: AccountType.PHYSICIAN,
            medicalSpecialty: MedicalSpecialty.CARDIOLOGY,
          }),
        }),
      );
      expect(result.data[0].name).toBe('Dr. Emem Akpan');
    });
  });

  describe('getAvailability', () => {
    it('returns slots for a doctor and date', async () => {
      prisma.staff.findFirst.mockResolvedValue({ id: 'doctor-1' });
      prisma.appointment.findMany.mockResolvedValue([]);

      const result = await service.getAvailability({
        doctorId: 'doctor-1',
        date: '2099-01-15',
      });

      expect(result.doctorId).toBe('doctor-1');
      expect(result.date).toBe('2099-01-15');
      expect(result.slots.length).toBeGreaterThan(0);
    });
  });
});
