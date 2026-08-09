import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { AccountType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateAppointmentDto,
  UpdateAppointmentDto,
} from './dto/create-appointment.dto';
import { AppointmentCalendarCountsQueryDto } from './dto/appointment-calendar-counts.query.dto';
import {
  ConfirmAppointmentRequestDto,
  DenyAppointmentRequestDto,
} from './dto/appointment-request.dto';
import { DateRangeSkipTakeDto } from '../../common/dto/date-range.dto';
import { parseDateRange } from '../../common/utils/date-range';
import { patientNameFieldsSelect } from '../../common/utils/patient-display-name.util';
import { AppointmentNotificationService } from './notification/appointment-notification.service';
import { isCancelledStatus } from './notification/appointment-message.util';
import { staffBriefSelect } from '../../common/constants/staff-select.constants';
import {
  APPOINTMENT_INCLUDE,
  PORTAL_APPOINTMENT_STATUS,
  RAW_REQUESTED_STATUSES,
} from '../patient-appointments/patient-appointments.constants';
import { toPortalStatus } from '../patient-appointments/patient-appointments.status';

@Injectable()
export class AppointmentService {
  private readonly logger = new Logger(AppointmentService.name);

  constructor(
    private prisma: PrismaService,
    private readonly notificationService: AppointmentNotificationService,
  ) {}

  async create(
    createAppointmentDto: CreateAppointmentDto,
    createdById: string,
  ) {
    const { encounterId, ...appointmentData } = createAppointmentDto;

    return this.prisma.$transaction(async (tx) => {
      const appointment = await tx.appointment.create({
        data: {
          patientId: appointmentData.patientId,
          date: new Date(appointmentData.date),
          status: appointmentData.status,
          notes: appointmentData.notes,
          referral: appointmentData.referral,
          createdById,
        },
      });

      if (encounterId) {
        const encounter = await tx.encounter.findUnique({
          where: { id: encounterId },
        });
        if (!encounter) {
          throw new NotFoundException('Encounter not found');
        }
        if (encounter.patientId !== appointmentData.patientId) {
          throw new BadRequestException(
            'Encounter does not belong to the appointment patient',
          );
        }
        await tx.encounter.update({
          where: { id: encounterId },
          data: {
            appointmentId: appointment.id,
            updatedById: createdById,
          },
        });
      }

      return tx.appointment.findUniqueOrThrow({
        where: { id: appointment.id },
        include: {
          patient: true,
          encounters: true,
        },
      });
    }).then(async (appointment) => {
      await this.safeNotify(() =>
        this.notificationService.notifyCreated(appointment.id),
      );
      return appointment;
    });
  }

  async findAll(query: DateRangeSkipTakeDto) {
    const { skip = 0, take = 20, fromDate, toDate } = query;
    const { from, to } = parseDateRange(fromDate, toDate);
    const [appointments, total] = await Promise.all([
      this.prisma.appointment.findMany({
        where: { date: { gte: from, lte: to } },
        skip,
        take,
        include: {
          patient: {
            select: patientNameFieldsSelect,
          },
          staff: {
            select: {
              id: true,
              staffId: true,
              firstName: true,
              lastName: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: { date: 'desc' },
      }),
      this.prisma.appointment.count({
        where: { date: { gte: from, lte: to } },
      }),
    ]);

    return { appointments, total, skip, take };
  }

  /**
   * Per-day counts for calendar month grid. Same inclusive `date` filter as {@link findAll}
   * (`parseDateRange`). Each `date` key is the **UTC** calendar day (YYYY-MM-DD) of
   * `Appointment.date` (PostgreSQL `to_char(date AT TIME ZONE 'UTC', 'YYYY-MM-DD')`).
   *
   * Note: `fromDate`/`toDate` normalization uses the same helpers as list — start/end of
   * **calendar day in the Node process local timezone** after parsing the ISO strings
   * (see `parseDateRange` / `startOfDay` / `endOfDay`). Align Flutter query params with
   * existing GET /appointments calls for consistent windows.
   */
  async getCalendarCounts(query: AppointmentCalendarCountsQueryDto) {
    const { from, to } = parseDateRange(query.fromDate, query.toDate);
    const includeCancelled = query.includeCancelled === true;

    const rows = includeCancelled
      ? await this.prisma.$queryRaw<Array<{ day: string; count: bigint }>>(Prisma.sql`
          SELECT to_char("Appointment"."date" AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day,
                 COUNT(*)::int AS count
          FROM "Appointment"
          WHERE "Appointment"."date" >= ${from}
            AND "Appointment"."date" <= ${to}
          GROUP BY 1
          ORDER BY 1
        `)
      : await this.prisma.$queryRaw<Array<{ day: string; count: bigint }>>(Prisma.sql`
          SELECT to_char("Appointment"."date" AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day,
                 COUNT(*)::int AS count
          FROM "Appointment"
          WHERE "Appointment"."date" >= ${from}
            AND "Appointment"."date" <= ${to}
            AND LOWER("Appointment"."status") <> 'cancelled'
          GROUP BY 1
          ORDER BY 1
        `);

    return {
      counts: rows.map((r) => ({
        date: r.day,
        count: Number(r.count),
      })),
    };
  }

  async findOne(id: string) {
    return this.prisma.appointment.findUnique({
      where: { id },
      include: {
        patient: true,
        createdBy: { select: staffBriefSelect },
      },
    });
  }

  async findByPatientId(patientId: string) {
    return this.prisma.appointment.findMany({
      where: { patientId },
      orderBy: { date: 'desc' },
      include: {
        patient: true,
        createdBy: { select: staffBriefSelect },
      },
    });
  }

  async getUpcomingAppointments() {
    const today = new Date();
    return this.prisma.appointment.findMany({
      where: {
        date: {
          gte: today,
        },
        status: { in: ['scheduled', 'rescheduled'] },
      },
      include: {
        patient: true,
        createdBy: { select: staffBriefSelect },
      },
      orderBy: { date: 'asc' },
    });
  }

  async listRequests(status?: string) {
    const resolved = (status ?? PORTAL_APPOINTMENT_STATUS.REQUESTED).trim();
    const normalized = resolved.toUpperCase();
    const statusFilter =
      normalized === PORTAL_APPOINTMENT_STATUS.REQUESTED
        ? [...RAW_REQUESTED_STATUSES]
        : [resolved, normalized];

    const appointments = await this.prisma.appointment.findMany({
      where: { status: { in: statusFilter } },
      orderBy: { date: 'asc' },
      include: {
        patient: { select: patientNameFieldsSelect },
        staff: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            medicalSpecialty: true,
            department: { select: { name: true } },
          },
        },
        createdBy: { select: staffBriefSelect },
      },
    });

    return { data: appointments, total: appointments.length };
  }

  async confirmRequest(
    id: string,
    dto: ConfirmAppointmentRequestDto,
    updatedById: string,
  ) {
    const existing = await this.prisma.appointment.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`Appointment "${id}" not found.`);
    }
    if (
      toPortalStatus(existing.status) !== PORTAL_APPOINTMENT_STATUS.REQUESTED
    ) {
      throw new ConflictException('Only REQUESTED appointments can be confirmed.');
    }

    await this.assertActivePhysician(dto.staffId);

    let nextDate = existing.date;
    if (dto.date) {
      nextDate = new Date(dto.date);
      if (Number.isNaN(nextDate.getTime())) {
        throw new UnprocessableEntityException('Invalid date.');
      }
    }

    const location = await this.resolveDoctorLocation(dto.staffId);

    const appointment = await this.prisma.appointment.update({
      where: { id },
      data: {
        staffId: dto.staffId,
        date: nextDate,
        status: PORTAL_APPOINTMENT_STATUS.CONFIRMED,
        location,
        updatedById,
      },
      include: {
        patient: { select: patientNameFieldsSelect },
        ...APPOINTMENT_INCLUDE,
        updatedBy: { select: staffBriefSelect },
      },
    });

    await this.safeNotify(() =>
      this.notificationService.notifyCreated(appointment.id),
    );

    return appointment;
  }

  async denyRequest(
    id: string,
    dto: DenyAppointmentRequestDto,
    updatedById: string,
  ) {
    const existing = await this.prisma.appointment.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`Appointment "${id}" not found.`);
    }
    if (
      toPortalStatus(existing.status) !== PORTAL_APPOINTMENT_STATUS.REQUESTED
    ) {
      throw new ConflictException('Only REQUESTED appointments can be denied.');
    }

    const appointment = await this.prisma.appointment.update({
      where: { id },
      data: {
        status: PORTAL_APPOINTMENT_STATUS.CANCELLED,
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
        updatedById,
      },
      include: {
        patient: { select: patientNameFieldsSelect },
        ...APPOINTMENT_INCLUDE,
        updatedBy: { select: staffBriefSelect },
      },
    });

    await this.safeNotify(() =>
      this.notificationService.notifyCancelled(appointment.id),
    );

    return appointment;
  }

  private async assertActivePhysician(staffId: string) {
    const doctor = await this.prisma.staff.findFirst({
      where: {
        id: staffId,
        isActive: true,
        accountType: AccountType.PHYSICIAN,
      },
      select: { id: true },
    });
    if (!doctor) {
      throw new UnprocessableEntityException('Invalid staffId (physician required).');
    }
  }

  private async resolveDoctorLocation(doctorId: string): Promise<string | null> {
    const room = await this.prisma.consultingRoom.findFirst({
      where: { staffId: doctorId },
      select: { location: true, name: true },
    });
    if (!room) {
      return null;
    }
    return room.location ?? room.name;
  }

  async update(
    id: string,
    updateAppointmentDto: UpdateAppointmentDto,
    staffId: string,
  ) {
    const existing = await this.prisma.appointment.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`Appointment "${id}" not found.`);
    }

    const previousDate = existing.date;
    const dateChanged =
      !!updateAppointmentDto.date &&
      new Date(updateAppointmentDto.date).getTime() !==
        new Date(existing.date).getTime();
    const statusChanged =
      updateAppointmentDto.status !== undefined &&
      updateAppointmentDto.status !== existing.status;
    const becameCancelled =
      statusChanged && isCancelledStatus(updateAppointmentDto.status);

    const appointment = await this.prisma.appointment.update({
      where: { id },
      data: {
        ...(updateAppointmentDto.date && {
          date: new Date(updateAppointmentDto.date),
        }),
        status: updateAppointmentDto.status,
        notes: updateAppointmentDto.notes,
        referral: updateAppointmentDto.referral,
        updatedById: staffId,
      },
      include: {
        updatedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    if (becameCancelled) {
      await this.safeNotify(() =>
        this.notificationService.notifyCancelled(appointment.id),
      );
    } else if (dateChanged) {
      await this.safeNotify(() =>
        this.notificationService.notifyRescheduled(
          appointment.id,
          previousDate,
        ),
      );
    }

    return appointment;
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

  async remove(id: string) {
    return this.prisma.appointment.delete({
      where: { id },
    });
  }
}
