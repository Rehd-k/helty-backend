import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateWaitingPatientDto,
  QueryWaitingPatientDto,
  SendToConsultingRoomDto,
  UpdateWaitingPatientDto,
} from './dto/waiting-patient.dto';
import { parseDateRange } from '../../common/utils/date-range';

@Injectable()
export class WaitingPatientService {
  constructor(private readonly prisma: PrismaService) { }

  /** Ensures the patient has at least one vitals record before allowing room assignment. */
  private async assertPatientHasVitals(patientId: string): Promise<void> {
    const count = await this.prisma.patientVitals.count({
      where: { patientId },
    });
    if (count === 0) {
      throw new BadRequestException(
        'Vitals must be added for this patient before sending them to a consulting room.',
      );
    }
  }

  /** Add a patient to the waiting list (not yet in a consulting room). */
  async create(dto: CreateWaitingPatientDto) {
    const patient = await this.prisma.patient.findUnique({
      where: { id: dto.patientId },
    });
    if (!patient) {
      throw new NotFoundException(`Patient "${dto.patientId}" not found.`);
    }

    if (dto.staffId) {
      const staff = await this.prisma.staff.findUnique({
        where: { id: dto.staffId },
      });
      if (!staff) {
        throw new NotFoundException(`Staff "${dto.staffId}" not found.`);
      }
    }

    return this.prisma.waitingPatient.create({
      data: {
        patient: { connect: { id: dto.patientId } },
        ...(dto.staffId && {
          createdBy: { connect: { id: dto.staffId } },
          updatedBy: { connect: { id: dto.staffId } },
        }),
      },
      include: {
        patient: true,
        consultingRoom: true,
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  async findAll(query: QueryWaitingPatientDto) {
    const {
      consultingRoomId,
      patientId,
      unassignedOnly,
      seen,
      skip = 0,
      take = 20,
      toDate,
      fromDate,
    } = query;

    const { from, to } = parseDateRange(fromDate, toDate);

    const where: Prisma.WaitingPatientWhereInput = {
      createdAt: { gte: from, lte: to },
    };

    if (unassignedOnly) {
      where.consultingRoomId = null;
    }
    else if (seen) {
      where.seen = true;
    } else if (consultingRoomId) {
      where.consultingRoomId = consultingRoomId;
    } else if (unassignedOnly === false) {
      where.consultingRoomId = { not: null };
    }

    if (patientId) {
      where.patientId = patientId;
    }

    const [data, total] = await Promise.all([
      this.prisma.waitingPatient.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'asc' },
        include: {
          patient: true,

          vitals: true,
          consultingRoom: {
            select: {
              id: true,
              name: true,
            },
          },
          service: {
            select: {
              id: true,
              name: true,
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
      }),
      this.prisma.waitingPatient.count({ where }),
    ]);

    return { data, total, skip, take };
  }

  async findOne(id: string) {
    const waiting = await this.prisma.waitingPatient.findUnique({
      where: { id },
      include: {
        patient: true,
        consultingRoom: true,
        vitals: true,

        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        updatedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!waiting) {
      throw new NotFoundException(`Waiting patient "${id}" not found.`);
    }

    return waiting;
  }

  /** Send a waiting patient to a consulting room. Vitals must exist for the patient first. */
  async sendToConsultingRoom(id: string, dto: SendToConsultingRoomDto) {
    const waiting = await this.findOne(id);

    await this.assertPatientHasVitals(waiting.patientId);

    const room = await this.prisma.consultingRoom.findUnique({
      where: { id: dto.consultingRoomId },
    });
    if (!room) {
      throw new NotFoundException(
        `Consulting room "${dto.consultingRoomId}" not found.`,
      );
    }

    if (dto.staffId) {
      const staff = await this.prisma.staff.findUnique({
        where: { id: dto.staffId },
      });
      if (!staff) {
        throw new NotFoundException(`Staff "${dto.staffId}" not found.`);
      }
    }

    return this.prisma.waitingPatient.update({
      where: { id },
      data: {
        consultingRoom: { connect: { id: dto.consultingRoomId } },
        ...(dto.staffId && {
          updatedBy: { connect: { id: dto.staffId } },
        }),
      },
      include: {
        patient: true,
        consultingRoom: true,
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        updatedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  async findByConsultingRoom(consultingRoomId: string) {
    const room = await this.prisma.consultingRoom.findUnique({
      where: { id: consultingRoomId },
    });
    if (!room) {
      throw new NotFoundException(
        `Consulting room "${consultingRoomId}" not found.`,
      );
    }

    return this.prisma.waitingPatient.findMany({
      where: { consultingRoomId },
      orderBy: { createdAt: 'asc' },
      include: {
        patient: true,
        consultingRoom: true,
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  async update(id: string, dto: UpdateWaitingPatientDto) {
    const waiting = await this.findOne(id);
    console.log(dto, id);
    const { consultingRoomId, seen, staffId } = dto;

    if (consultingRoomId) {
      await this.assertPatientHasVitals(waiting.patientId);

      const room = await this.prisma.consultingRoom.findUnique({
        where: { id: consultingRoomId },
      });
      if (!room) {
        throw new NotFoundException(
          `Consulting room "${consultingRoomId}" not found.`,
        );
      }
    }

    if (staffId) {
      const staff = await this.prisma.staff.findUnique({
        where: { id: staffId },
      });
      if (!staff) {
        throw new NotFoundException(`Staff "${staffId}" not found.`);
      }
    }

    return this.prisma.waitingPatient.update({
      where: { id },
      data: {
        ...(consultingRoomId && {
          consultingRoom: { connect: { id: consultingRoomId } },
        }),
        ...(seen !== undefined && { seen }),
        ...(staffId && {
          updatedBy: { connect: { id: staffId } },
        }),
      },
      include: {
        patient: true,
        consultingRoom: true,
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        updatedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    await this.prisma.waitingPatient.delete({
      where: { id },
    });

    return { message: 'Waiting patient entry removed successfully.' };
  }
}
