import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateAppointmentDto,
  UpdateAppointmentDto,
} from './dto/create-appointment.dto';
import { AppointmentCalendarCountsQueryDto } from './dto/appointment-calendar-counts.query.dto';
import { DateRangeSkipTakeDto } from '../../common/dto/date-range.dto';
import { parseDateRange } from '../../common/utils/date-range';

@Injectable()
export class AppointmentService {
  constructor(private prisma: PrismaService) {}

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
            select: {
              id: true,
              patientId: true,
              firstName: true,
              surname: true,
            },
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
      },
    });
  }

  async findByPatientId(patientId: string) {
    return this.prisma.appointment.findMany({
      where: { patientId },
      orderBy: { date: 'desc' },
      include: {
        patient: true,
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
      },
      orderBy: { date: 'asc' },
    });
  }

  async update(
    id: string,
    updateAppointmentDto: UpdateAppointmentDto,
    staffId: string,
  ) {
    return this.prisma.appointment.update({
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
  }

  async remove(id: string) {
    return this.prisma.appointment.delete({
      where: { id },
    });
  }
}
