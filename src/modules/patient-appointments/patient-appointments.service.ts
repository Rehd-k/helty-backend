import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { AccountType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CLINICAL_SPECIALTY_CATALOG } from '../clinical-specialty/clinical-specialty-catalog';
import { AppointmentNotificationService } from '../appointment/notification/appointment-notification.service';
import { PatientFamilyService } from '../patient-family/patient-family.service';
import { PatientJwtPayload } from '../patient-auth/patient-auth.service';
import {
  buildAvailabilitySlots,
  isSlotAvailable,
} from './patient-appointments.availability';
import {
  APPOINTMENT_INCLUDE,
  APPOINTMENT_LIST_FILTER,
  PATIENT_PORTAL_SYSTEM_STAFF_ID_ENV,
  PORTAL_APPOINTMENT_STATUS,
  RAW_CANCELLED_STATUSES,
} from './patient-appointments.constants';
import {
  canCancelAppointment,
  canRescheduleAppointment,
} from './patient-appointments.policy';
import {
  buildAppointmentFilterWhere,
  sortOrderForFilter,
} from './patient-appointments.status';
import {
  toAppointmentDetailDto,
  toAppointmentSummaryDto,
  toBookingDoctorDto,
  toConsultationHistoryDto,
} from './patient-appointments.util';
import { AvailabilityQueryDto, ListDoctorsQueryDto } from './dto/booking-query.dto';
import { CreatePatientAppointmentDto } from './dto/create-appointment.dto';
import {
  AppointmentsDashboardQueryDto,
  ListAppointmentsQueryDto,
} from './dto/list-appointments-query.dto';
import { RescheduleAppointmentDto } from './dto/reschedule-appointment.dto';

const ENCOUNTER_HISTORY_INCLUDE = {
  doctor: {
    select: {
      firstName: true,
      lastName: true,
      department: { select: { name: true } },
    },
  },
  diagnoses: {
    select: { primaryIcdDescription: true },
    orderBy: { createdAt: 'desc' as const },
    take: 1,
  },
  labRequests: { select: { status: true } },
  labReports: { select: { results: true } },
} as const;

@Injectable()
export class PatientAppointmentsService {
  private readonly logger = new Logger(PatientAppointmentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: AppointmentNotificationService,
    private readonly family: PatientFamilyService,
  ) {}

  async getDashboard(
    user: PatientJwtPayload,
    query: AppointmentsDashboardQueryDto,
  ) {
    const subjectPatientId = await this.family.resolveSubjectPatientId(
      user,
      query.forPatientId,
    );
    const filter = query.status ?? APPOINTMENT_LIST_FILTER.UPCOMING;
    const now = new Date();

    if (filter === APPOINTMENT_LIST_FILTER.UPCOMING) {
      const [upcoming, consultationHistory] = await Promise.all([
        this.prisma.appointment.findMany({
          where: buildAppointmentFilterWhere(subjectPatientId, filter, now),
          orderBy: { date: 'asc' },
          include: APPOINTMENT_INCLUDE,
        }),
        this.prisma.encounter.findMany({
          where: { patientId: subjectPatientId, status: 'COMPLETED' },
          orderBy: { startTime: 'desc' },
          take: 2,
          include: ENCOUNTER_HISTORY_INCLUDE,
        }),
      ]);

      const summaries = upcoming.map((row) =>
        toAppointmentSummaryDto(row, now),
      );
      const [nextAppointment, ...rest] = summaries;

      return {
        nextAppointment: nextAppointment ?? null,
        upcomingAppointments: rest,
        consultationHistory: consultationHistory.map(toConsultationHistoryDto),
        subjectPatientId,
      };
    }

    const appointments = await this.prisma.appointment.findMany({
      where: buildAppointmentFilterWhere(subjectPatientId, filter, now),
      orderBy: sortOrderForFilter(filter),
      include: APPOINTMENT_INCLUDE,
    });

    return {
      nextAppointment: null,
      upcomingAppointments: appointments.map((row) =>
        toAppointmentSummaryDto(row, now),
      ),
      consultationHistory: [],
      subjectPatientId,
    };
  }

  async listAppointments(
    user: PatientJwtPayload,
    query: ListAppointmentsQueryDto,
  ) {
    const subjectPatientId = await this.family.resolveSubjectPatientId(
      user,
      query.forPatientId,
    );
    const filter = query.status ?? APPOINTMENT_LIST_FILTER.UPCOMING;
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const now = new Date();
    const where = buildAppointmentFilterWhere(subjectPatientId, filter, now);

    const [appointments, total] = await Promise.all([
      this.prisma.appointment.findMany({
        where,
        skip,
        take: limit,
        orderBy: sortOrderForFilter(filter),
        include: APPOINTMENT_INCLUDE,
      }),
      this.prisma.appointment.count({ where }),
    ]);

    return {
      data: appointments.map((row) => toAppointmentSummaryDto(row, now)),
      total,
      page,
      limit,
      subjectPatientId,
    };
  }

  async getAppointment(
    user: PatientJwtPayload,
    id: string,
    forPatientId?: string,
  ) {
    const subjectPatientId = await this.family.resolveSubjectPatientId(
      user,
      forPatientId,
    );
    const appointment = await this.findOwnedAppointment(subjectPatientId, id);
    return toAppointmentDetailDto(appointment);
  }

  async listSpecialties() {
    return {
      data: CLINICAL_SPECIALTY_CATALOG.map((entry) => ({
        id: entry.code,
        name: entry.displayName,
        description: entry.description,
      })),
    };
  }

  async listDoctors(query: ListDoctorsQueryDto) {
    const doctors = await this.prisma.staff.findMany({
      where: {
        isActive: true,
        accountType: AccountType.PHYSICIAN,
        medicalSpecialty: query.specialtyId,
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        medicalSpecialty: true,
        department: { select: { name: true } },
      },
    });

    return {
      data: doctors.map((doctor) =>
        toBookingDoctorDto(doctor, query.specialtyId),
      ),
    };
  }

  async getAvailability(query: AvailabilityQueryDto) {
    await this.assertActivePhysician(query.doctorId);

    const slots = buildAvailabilitySlots({
      date: query.date,
      bookedAt: await this.getDoctorBookedSlots(
        query.doctorId,
        query.date,
      ),
    });

    return {
      doctorId: query.doctorId,
      date: query.date,
      slots,
    };
  }

  async createAppointment(
    user: PatientJwtPayload,
    dto: CreatePatientAppointmentDto,
  ) {
    const scheduledAt = this.parsePreferredDate(dto.date);
    const todayKey = this.toLocalDateKey(new Date());
    const requestedKey = this.toLocalDateKey(scheduledAt);
    if (requestedKey < todayKey) {
      throw new UnprocessableEntityException('date must be today or in the future.');
    }

    const createdById = this.getSystemStaffId();

    const appointment = await this.prisma.appointment.create({
      data: {
        patientId: user.sub,
        staffId: null,
        date: scheduledAt,
        status: PORTAL_APPOINTMENT_STATUS.REQUESTED,
        specialty: dto.specialty,
        visitType: dto.visitType,
        reason: dto.reason,
        location: null,
        createdById,
      },
      include: APPOINTMENT_INCLUDE,
    });

    await this.safeNotify(() =>
      this.notificationService.notifyCreated(appointment.id),
    );

    return toAppointmentDetailDto(appointment);
  }

  async rescheduleAppointment(
    user: PatientJwtPayload,
    id: string,
    dto: RescheduleAppointmentDto,
  ) {
    if (!dto.scheduledAt && dto.reason === undefined) {
      throw new BadRequestException(
        'At least one of scheduledAt or reason is required.',
      );
    }

    const existing = await this.findOwnedAppointment(user.sub, id);

    if (!canRescheduleAppointment(existing.status, existing.date)) {
      throw new ConflictException('Appointment cannot be rescheduled.');
    }

    const previousDate = existing.date;
    let nextDate = existing.date;

    if (dto.scheduledAt) {
      nextDate = new Date(dto.scheduledAt);
      if (Number.isNaN(nextDate.getTime())) {
        throw new UnprocessableEntityException('Invalid scheduledAt.');
      }
      if (nextDate <= new Date()) {
        throw new UnprocessableEntityException(
          'scheduledAt must be in the future.',
        );
      }

      if (existing.staffId) {
        const dateKey = this.toLocalDateKey(nextDate);
        const booked = await this.getDoctorBookedSlots(
          existing.staffId,
          dateKey,
          existing.id,
        );
        if (!isSlotAvailable(nextDate, booked)) {
          throw new ConflictException('Selected slot is no longer available.');
        }
      }
    }

    const appointment = await this.prisma.appointment.update({
      where: { id },
      data: {
        ...(dto.scheduledAt ? { date: nextDate } : {}),
        ...(dto.reason !== undefined ? { reason: dto.reason } : {}),
        updatedById: this.getSystemStaffId(),
      },
      include: APPOINTMENT_INCLUDE,
    });

    if (dto.scheduledAt) {
      await this.safeNotify(() =>
        this.notificationService.notifyRescheduled(
          appointment.id,
          previousDate,
        ),
      );
    }

    return toAppointmentDetailDto(appointment);
  }

  async cancelAppointment(user: PatientJwtPayload, id: string) {
    const existing = await this.findOwnedAppointment(user.sub, id);

    if (!canCancelAppointment(existing.status, existing.date)) {
      throw new ConflictException('Appointment cannot be cancelled.');
    }

    const appointment = await this.prisma.appointment.update({
      where: { id },
      data: {
        status: PORTAL_APPOINTMENT_STATUS.CANCELLED,
        updatedById: this.getSystemStaffId(),
      },
    });

    await this.safeNotify(() =>
      this.notificationService.notifyCancelled(appointment.id),
    );

    return {
      id: appointment.id,
      status: 'CANCELLED' as const,
    };
  }

  private async findOwnedAppointment(patientId: string, id: string) {
    const appointment = await this.prisma.appointment.findFirst({
      where: { id, patientId },
      include: APPOINTMENT_INCLUDE,
    });

    if (!appointment) {
      throw new NotFoundException(`Appointment "${id}" not found.`);
    }

    return appointment;
  }

  private async assertActivePhysician(doctorId: string) {
    const doctor = await this.prisma.staff.findFirst({
      where: {
        id: doctorId,
        isActive: true,
        accountType: AccountType.PHYSICIAN,
      },
      select: { id: true },
    });

    if (!doctor) {
      throw new UnprocessableEntityException('Invalid doctorId.');
    }
  }

  private getSystemStaffId(): string {
    const staffId = process.env[PATIENT_PORTAL_SYSTEM_STAFF_ID_ENV]?.trim();
    if (!staffId) {
      throw new InternalServerErrorException(
        `${PATIENT_PORTAL_SYSTEM_STAFF_ID_ENV} is not configured.`,
      );
    }
    return staffId;
  }

  private async getDoctorBookedSlots(
    doctorId: string,
    date: string,
    excludeAppointmentId?: string,
  ): Promise<Date[]> {
    const offset = '+01:00';
    const from = new Date(`${date}T00:00:00.000${offset}`);
    const to = new Date(`${date}T23:59:59.999${offset}`);

    const appointments = await this.prisma.appointment.findMany({
      where: {
        staffId: doctorId,
        date: { gte: from, lte: to },
        status: { notIn: [...RAW_CANCELLED_STATUSES] },
        ...(excludeAppointmentId ? { id: { not: excludeAppointmentId } } : {}),
      },
      select: { date: true },
    });

    return appointments.map((row) => row.date);
  }

  private parsePreferredDate(raw: string): Date {
    const trimmed = raw.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const offset = '+01:00';
      const parsed = new Date(`${trimmed}T00:00:00.000${offset}`);
      if (Number.isNaN(parsed.getTime())) {
        throw new UnprocessableEntityException('Invalid date.');
      }
      return parsed;
    }

    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) {
      throw new UnprocessableEntityException('Invalid date.');
    }
    return parsed;
  }

  private toLocalDateKey(date: Date): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone:
        process.env.APPOINTMENT_REMINDER_TIMEZONE?.trim() || 'Africa/Lagos',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  }

  private async safeNotify(fn: () => Promise<void>): Promise<void> {
    try {
      await fn();
    } catch (err) {
      this.logger.warn(
        `Appointment notification failed: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }
}
