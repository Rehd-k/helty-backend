import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateRadiologyScheduleDto } from './dto/radiology-schedule.dto';
import { UpdateRadiologyScheduleDto } from './dto/radiology-schedule.dto';
import { RadiologyRequestStatus } from '@prisma/client';

@Injectable()
export class RadiologyScheduleService {
  constructor(private readonly prisma: PrismaService) {}

  async create(requestId: string, dto: CreateRadiologyScheduleDto) {
    const request = await this.prisma.radiologyRequest.findUnique({
      where: { id: requestId },
      include: { schedule: true },
    });
    if (!request) {
      throw new NotFoundException(`Radiology request "${requestId}" not found.`);
    }
    if (request.schedule) {
      throw new BadRequestException('This request already has a schedule. Use PATCH to update.');
    }
    if (request.status !== RadiologyRequestStatus.PENDING) {
      throw new BadRequestException('Only PENDING requests can be scheduled.');
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
        throw new NotFoundException(`Radiology machine "${dto.machineId}" not found.`);
      }
    }

    const [schedule] = await this.prisma.$transaction([
      this.prisma.radiologySchedule.create({
        data: {
          radiologyRequestId: requestId,
          scheduledAt: new Date(dto.scheduledAt),
          radiographerId: dto.radiographerId ?? null,
          machineId: dto.machineId ?? null,
        },
        include: {
          radiographer: { select: { id: true, firstName: true, lastName: true } },
          machine: true,
        },
      }),
      this.prisma.radiologyRequest.update({
        where: { id: requestId },
        data: { status: RadiologyRequestStatus.SCHEDULED },
      }),
    ]);
    return schedule;
  }

  async update(requestId: string, dto: UpdateRadiologyScheduleDto) {
    const request = await this.prisma.radiologyRequest.findUnique({
      where: { id: requestId },
      include: { schedule: true },
    });
    if (!request) {
      throw new NotFoundException(`Radiology request "${requestId}" not found.`);
    }
    if (!request.schedule) {
      throw new NotFoundException('No schedule found for this request. Use POST to create.');
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
        throw new NotFoundException(`Radiology machine "${dto.machineId}" not found.`);
      }
    }

    return this.prisma.radiologySchedule.update({
      where: { radiologyRequestId: requestId },
      data: {
        ...(dto.scheduledAt && { scheduledAt: new Date(dto.scheduledAt) }),
        ...(dto.radiographerId !== undefined && { radiographerId: dto.radiographerId ?? null }),
        ...(dto.machineId !== undefined && { machineId: dto.machineId ?? null }),
      },
      include: {
        radiographer: { select: { id: true, firstName: true, lastName: true } },
        machine: true,
      },
    });
  }

  async getByRequestId(requestId: string) {
    const schedule = await this.prisma.radiologySchedule.findUnique({
      where: { radiologyRequestId: requestId },
      include: {
        radiographer: { select: { id: true, firstName: true, lastName: true } },
        machine: true,
      },
    });
    if (!schedule) {
      throw new NotFoundException(`No schedule found for radiology request "${requestId}".`);
    }
    return schedule;
  }
}
