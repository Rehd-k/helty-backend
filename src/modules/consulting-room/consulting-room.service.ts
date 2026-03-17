import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateConsultingRoomDto,
  QueryConsultingRoomDto,
  UpdateConsultingRoomDto,
} from './dto/consulting-room.dto';

@Injectable()
export class ConsultingRoomService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateConsultingRoomDto) {
    if (dto.staffId) {
      const staff = await this.prisma.staff.findUnique({
        where: { id: dto.staffId },
      });
      if (!staff) {
        throw new NotFoundException(`Staff "${dto.staffId}" not found.`);
      }
    }

    const { name, description, location, capacity, staffId } = dto;

    return this.prisma.consultingRoom.create({
      data: {
        name,
        description,
        location,
        capacity,
        ...(staffId && {
          staff: { connect: { id: staffId } },
        }),
      },
      include: {
        staff: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        waitingPatients: true,
      },
    });
  }

  async findAll(query: QueryConsultingRoomDto) {
    const { search, skip = 0, take = 20 } = query;

    const where = search
      ? {
          OR: [
            {
              name: {
                contains: search,
                mode: 'insensitive' as const,
              },
            },
            {
              location: {
                contains: search,
                mode: 'insensitive' as const,
              },
            },
          ],
        }
      : {};

    const [data, total] = await Promise.all([
      this.prisma.consultingRoom.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          staff: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          waitingPatients: {
            include: {
              patient: {
                select: {
                  id: true,
                  firstName: true,
                  surname: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.consultingRoom.count({ where }),
    ]);

    return { data, total, skip, take };
  }

  async findOne(id: string) {
    const room = await this.prisma.consultingRoom.findUnique({
      where: { id },
      include: {
        staff: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        waitingPatients: {
          include: {
            patient: {
              select: {
                id: true,
                firstName: true,
                surname: true,
              },
            },
          },
        },
      },
    });

    if (!room) {
      throw new NotFoundException(`Consulting room "${id}" not found.`);
    }

    return room;
  }

  async update(id: string, dto: UpdateConsultingRoomDto) {
    await this.findOne(id);

    if (dto.staffId) {
      const staff = await this.prisma.staff.findUnique({
        where: { id: dto.staffId },
      });
      if (!staff) {
        throw new NotFoundException(`Staff "${dto.staffId}" not found.`);
      }
    }

    const { name, description, location, capacity, staffId } = dto;

    return this.prisma.consultingRoom.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(location !== undefined && { location }),
        ...(capacity !== undefined && { capacity }),
        ...(staffId && {
          staff: { connect: { id: staffId } },
        }),
      },
      include: {
        staff: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        waitingPatients: {
          include: {
            patient: {
              select: {
                id: true,
                firstName: true,
                surname: true,
              },
            },
          },
        },
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    const waitingCount = await this.prisma.waitingPatient.count({
      where: { consultingRoomId: id },
    });

    if (waitingCount > 0) {
      throw new BadRequestException(
        `Cannot delete consulting room "${id}" — it has ${waitingCount} waiting patient(s).`,
      );
    }

    await this.prisma.consultingRoom.delete({
      where: { id },
    });

    return { message: 'Consulting room deleted successfully.' };
  }
}
