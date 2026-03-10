import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateRadiologyProcedureDto } from './dto/radiology-procedure.dto';
import { UpdateRadiologyProcedureDto } from './dto/radiology-procedure.dto';
import { RadiologyRequestStatus } from '@prisma/client';

@Injectable()
export class RadiologyProcedureService {
  constructor(private readonly prisma: PrismaService) {}

  async create(requestId: string, dto: CreateRadiologyProcedureDto) {
    const request = await this.prisma.radiologyRequest.findUnique({
      where: { id: requestId },
      include: { procedure: true },
    });
    if (!request) {
      throw new NotFoundException(`Radiology request "${requestId}" not found.`);
    }
    if (request.procedure) {
      throw new BadRequestException('This request already has a procedure record. Use PATCH to update.');
    }
    if (request.status !== RadiologyRequestStatus.SCHEDULED && request.status !== RadiologyRequestStatus.PENDING) {
      throw new BadRequestException('Only SCHEDULED or PENDING requests can start a procedure.');
    }
    const staff = await this.prisma.staff.findUnique({
      where: { id: dto.performedById },
    });
    if (!staff) {
      throw new NotFoundException(`Staff "${dto.performedById}" not found.`);
    }
    if (dto.machineId) {
      const machine = await this.prisma.radiologyMachine.findUnique({
        where: { id: dto.machineId },
      });
      if (!machine) {
        throw new NotFoundException(`Radiology machine "${dto.machineId}" not found.`);
      }
    }

    const [procedure] = await this.prisma.$transaction([
      this.prisma.radiologyProcedure.create({
        data: {
          radiologyRequestId: requestId,
          performedById: dto.performedById,
          machineId: dto.machineId ?? null,
          startTime: new Date(dto.startTime),
          endTime: dto.endTime ? new Date(dto.endTime) : null,
          notes: dto.notes ?? null,
        },
        include: {
          performedBy: { select: { id: true, firstName: true, lastName: true } },
          machine: true,
        },
      }),
      this.prisma.radiologyRequest.update({
        where: { id: requestId },
        data: { status: RadiologyRequestStatus.IN_PROGRESS },
      }),
    ]);
    return procedure;
  }

  async update(requestId: string, dto: UpdateRadiologyProcedureDto) {
    const request = await this.prisma.radiologyRequest.findUnique({
      where: { id: requestId },
      include: { procedure: true },
    });
    if (!request) {
      throw new NotFoundException(`Radiology request "${requestId}" not found.`);
    }
    if (!request.procedure) {
      throw new NotFoundException('No procedure record for this request. Use POST to create.');
    }

    const updateData: { endTime?: Date; notes?: string } = {};
    if (dto.endTime !== undefined) updateData.endTime = new Date(dto.endTime);
    if (dto.notes !== undefined) updateData.notes = dto.notes;

    const procedure = await this.prisma.radiologyProcedure.update({
      where: { radiologyRequestId: requestId },
      data: updateData,
      include: {
        performedBy: { select: { id: true, firstName: true, lastName: true } },
        machine: true,
      },
    });

    if (dto.endTime) {
      await this.prisma.radiologyRequest.update({
        where: { id: requestId },
        data: { status: RadiologyRequestStatus.COMPLETED },
      });
    }

    return procedure;
  }

  async getByRequestId(requestId: string) {
    const procedure = await this.prisma.radiologyProcedure.findUnique({
      where: { radiologyRequestId: requestId },
      include: {
        performedBy: { select: { id: true, firstName: true, lastName: true } },
        machine: true,
      },
    });
    if (!procedure) {
      throw new NotFoundException(`No procedure record for radiology request "${requestId}".`);
    }
    return procedure;
  }
}
