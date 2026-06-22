import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, SurgeryRequestStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { parseDateRange } from '../../common/utils/date-range';
import {
  ListTheatreSchedulesQueryDto,
  ScheduleSurgeryDto,
  UpdateTheatreScheduleDto,
} from './dto/theatre.dto';
import { theatreScheduleListInclude } from './surgery-request-includes';

@Injectable()
export class TheatreScheduleService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertStaffExists(id: string, label: string) {
    const staff = await this.prisma.staff.findUnique({ where: { id } });
    if (!staff) {
      throw new NotFoundException(`${label} "${id}" not found.`);
    }
  }

  private async assertNoRoomConflict(
    theatreRoomId: string,
    scheduledAt: Date,
    estimatedDurationMins: number,
    excludeScheduleId?: string,
  ) {
    const endAt = new Date(
      scheduledAt.getTime() + estimatedDurationMins * 60 * 1000,
    );

    const existing = await this.prisma.theatreSchedule.findMany({
      where: {
        theatreRoomId,
        ...(excludeScheduleId ? { id: { not: excludeScheduleId } } : {}),
        surgeryRequest: {
          status: {
            in: [
              SurgeryRequestStatus.SCHEDULED,
              SurgeryRequestStatus.IN_PROGRESS,
            ],
          },
        },
      },
      select: {
        id: true,
        scheduledAt: true,
        estimatedDurationMins: true,
      },
    });

    for (const slot of existing) {
      const slotEnd = new Date(
        slot.scheduledAt.getTime() +
          (slot.estimatedDurationMins ?? 60) * 60 * 1000,
      );
      const overlaps =
        scheduledAt < slotEnd && endAt > slot.scheduledAt;
      if (overlaps) {
        throw new ConflictException(
          'Theatre room is already scheduled for an overlapping time slot.',
        );
      }
    }
  }

  async create(dto: ScheduleSurgeryDto) {
    const request = await this.prisma.surgeryRequest.findUnique({
      where: { id: dto.surgeryRequestId },
      include: { schedule: true },
    });
    if (!request) {
      throw new NotFoundException(
        `Surgery request "${dto.surgeryRequestId}" not found.`,
      );
    }
    if (request.status !== SurgeryRequestStatus.REQUESTED) {
      throw new BadRequestException(
        'Only requested surgeries can be scheduled.',
      );
    }
    if (request.schedule) {
      throw new BadRequestException(
        'This surgery request is already scheduled.',
      );
    }

    const room = await this.prisma.theatreRoom.findUnique({
      where: { id: dto.theatreRoomId },
    });
    if (!room || !room.isActive) {
      throw new NotFoundException(
        `Active theatre room "${dto.theatreRoomId}" not found.`,
      );
    }

    await this.assertStaffExists(dto.surgeonId, 'Surgeon');
    if (dto.anaesthetistId) {
      await this.assertStaffExists(dto.anaesthetistId, 'Anaesthetist');
    }
    if (dto.scrubNurseId) {
      await this.assertStaffExists(dto.scrubNurseId, 'Scrub nurse');
    }

    const scheduledAt = new Date(dto.scheduledAt);
    const duration = dto.estimatedDurationMins ?? 60;
    await this.assertNoRoomConflict(
      dto.theatreRoomId,
      scheduledAt,
      duration,
    );

    return this.prisma.$transaction(async (tx) => {
      const schedule = await tx.theatreSchedule.create({
        data: {
          surgeryRequestId: dto.surgeryRequestId,
          theatreRoomId: dto.theatreRoomId,
          scheduledAt,
          estimatedDurationMins: duration,
          surgeonId: dto.surgeonId,
          anaesthetistId: dto.anaesthetistId ?? null,
          scrubNurseId: dto.scrubNurseId ?? null,
        },
        include: theatreScheduleListInclude,
      });

      await tx.surgeryRequest.update({
        where: { id: dto.surgeryRequestId },
        data: { status: SurgeryRequestStatus.SCHEDULED },
      });

      return schedule;
    });
  }

  async findAll(query: ListTheatreSchedulesQueryDto) {
    const skip = query.skip ?? 0;
    const take = query.take ?? 20;
    const where: Prisma.TheatreScheduleWhereInput = {};

    if (query.theatreRoomId) where.theatreRoomId = query.theatreRoomId;
    if (query.surgeonId) where.surgeonId = query.surgeonId;
    if (query.fromDate && query.toDate) {
      const { from, to } = parseDateRange(query.fromDate, query.toDate);
      where.scheduledAt = { gte: from, lte: to };
    }

    const [data, total] = await Promise.all([
      this.prisma.theatreSchedule.findMany({
        where,
        skip,
        take,
        orderBy: { scheduledAt: 'asc' },
        include: theatreScheduleListInclude,
      }),
      this.prisma.theatreSchedule.count({ where }),
    ]);

    return { data, total, skip, take };
  }

  async update(id: string, dto: UpdateTheatreScheduleDto) {
    const schedule = await this.prisma.theatreSchedule.findUnique({
      where: { id },
      include: { surgeryRequest: true },
    });
    if (!schedule) {
      throw new NotFoundException(`Theatre schedule "${id}" not found.`);
    }
    if (
      schedule.surgeryRequest.status !== SurgeryRequestStatus.SCHEDULED &&
      schedule.surgeryRequest.status !== SurgeryRequestStatus.REQUESTED
    ) {
      throw new BadRequestException(
        'Cannot reschedule a surgery that has already started.',
      );
    }

    if (dto.surgeonId) await this.assertStaffExists(dto.surgeonId, 'Surgeon');
    if (dto.anaesthetistId) {
      await this.assertStaffExists(dto.anaesthetistId, 'Anaesthetist');
    }
    if (dto.scrubNurseId) {
      await this.assertStaffExists(dto.scrubNurseId, 'Scrub nurse');
    }

    const scheduledAt = dto.scheduledAt
      ? new Date(dto.scheduledAt)
      : schedule.scheduledAt;
    const duration =
      dto.estimatedDurationMins ?? schedule.estimatedDurationMins ?? 60;
    const roomId = dto.theatreRoomId ?? schedule.theatreRoomId;

    if (dto.scheduledAt || dto.theatreRoomId || dto.estimatedDurationMins) {
      await this.assertNoRoomConflict(roomId, scheduledAt, duration, id);
    }

    return this.prisma.theatreSchedule.update({
      where: { id },
      data: {
        theatreRoomId: dto.theatreRoomId,
        scheduledAt: dto.scheduledAt ? scheduledAt : undefined,
        estimatedDurationMins: dto.estimatedDurationMins,
        surgeonId: dto.surgeonId,
        anaesthetistId: dto.anaesthetistId,
        scrubNurseId: dto.scrubNurseId,
      },
      include: theatreScheduleListInclude,
    });
  }
}
