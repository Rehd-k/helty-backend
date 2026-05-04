import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateRadiologyScheduleDto } from './dto/radiology-schedule.dto';
import { UpdateRadiologyScheduleDto } from './dto/radiology-schedule.dto';
import { RadiologyRequestStatus } from '@prisma/client';

@Injectable()
export class RadiologyScheduleService {
  constructor(private readonly prisma: PrismaService) {}

  async create(orderItemId: string, dto: CreateRadiologyScheduleDto) {
    const orderItem = await this.prisma.radiologyOrderItem.findUnique({
      where: { id: orderItemId },
      include: { schedule: true },
    });
    if (!orderItem) {
      throw new NotFoundException(
        `Radiology order item "${orderItemId}" not found.`,
      );
    }
    if (orderItem.schedule) {
      throw new BadRequestException(
        'This order item already has a schedule. Use PATCH to update.',
      );
    }
    if (orderItem.status !== RadiologyRequestStatus.PENDING) {
      throw new BadRequestException(
        'Only PENDING order items can be scheduled.',
      );
    }
    if (dto.radiographerId) {
      const staff = await this.prisma.staff.findUnique({
        where: { id: dto.radiographerId },
      });
      if (!staff) {
        throw new NotFoundException(`Staff "${dto.radiographerId}" not found.`);
      }
    }
    if (dto.machineId) {
      const machine = await this.prisma.radiologyMachine.findUnique({
        where: { id: dto.machineId },
      });
      if (!machine) {
        throw new NotFoundException(
          `Radiology machine "${dto.machineId}" not found.`,
        );
      }
    }

    const [schedule] = await this.prisma.$transaction([
      this.prisma.radiologySchedule.create({
        data: {
          radiologyOrderItemId: orderItemId,
          scheduledAt: new Date(dto.scheduledAt),
          radiographerId: dto.radiographerId ?? null,
          machineId: dto.machineId ?? null,
        },
        include: {
          radiographer: {
            select: { id: true, firstName: true, lastName: true },
          },
          machine: true,
        },
      }),
      this.prisma.radiologyOrderItem.update({
        where: { id: orderItemId },
        data: { status: RadiologyRequestStatus.SCHEDULED },
      }),
    ]);
    return schedule;
  }

  async update(orderItemId: string, dto: UpdateRadiologyScheduleDto) {
    const orderItem = await this.prisma.radiologyOrderItem.findUnique({
      where: { id: orderItemId },
      include: { schedule: true },
    });
    if (!orderItem) {
      throw new NotFoundException(
        `Radiology order item "${orderItemId}" not found.`,
      );
    }
    if (!orderItem.schedule) {
      throw new NotFoundException(
        'No schedule found for this order item. Use POST to create.',
      );
    }
    if (dto.radiographerId !== undefined) {
      const staff = await this.prisma.staff.findUnique({
        where: { id: dto.radiographerId },
      });
      if (!staff) {
        throw new NotFoundException(`Staff "${dto.radiographerId}" not found.`);
      }
    }
    if (dto.machineId !== undefined) {
      const machine = await this.prisma.radiologyMachine.findUnique({
        where: { id: dto.machineId },
      });
      if (!machine) {
        throw new NotFoundException(
          `Radiology machine "${dto.machineId}" not found.`,
        );
      }
    }

    return this.prisma.radiologySchedule.update({
      where: { radiologyOrderItemId: orderItemId },
      data: {
        ...(dto.scheduledAt && { scheduledAt: new Date(dto.scheduledAt) }),
        ...(dto.radiographerId !== undefined && {
          radiographerId: dto.radiographerId ?? null,
        }),
        ...(dto.machineId !== undefined && {
          machineId: dto.machineId ?? null,
        }),
      },
      include: {
        radiographer: { select: { id: true, firstName: true, lastName: true } },
        machine: true,
      },
    });
  }

  async getByOrderItemId(orderItemId: string) {
    const schedule = await this.prisma.radiologySchedule.findUnique({
      where: { radiologyOrderItemId: orderItemId },
      include: {
        radiographer: { select: { id: true, firstName: true, lastName: true } },
        machine: true,
      },
    });
    if (!schedule) {
      throw new NotFoundException(
        `No schedule found for radiology order item "${orderItemId}".`,
      );
    }
    return schedule;
  }
}
