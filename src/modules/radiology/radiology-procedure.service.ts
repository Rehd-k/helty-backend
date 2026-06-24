import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateRadiologyProcedureDto } from './dto/radiology-procedure.dto';
import { UpdateRadiologyProcedureDto } from './dto/radiology-procedure.dto';
import { RadiologyRequestStatus } from '@prisma/client';
import { syncRadiologyOrderStatusAfterItemChange } from './radiology-order-status.util';

@Injectable()
export class RadiologyProcedureService {
  constructor(private readonly prisma: PrismaService) {}

  async create(orderItemId: string, dto: CreateRadiologyProcedureDto) {
    const orderItem = await this.prisma.radiologyOrderItem.findUnique({
      where: { id: orderItemId },
      include: { procedure: true },
    });
    if (!orderItem) {
      throw new NotFoundException(
        `Radiology order item "${orderItemId}" not found.`,
      );
    }
    if (orderItem.procedure) {
      throw new BadRequestException(
        'This order item already has a procedure record. Use PATCH to update.',
      );
    }
    if (
      orderItem.status !== RadiologyRequestStatus.SCHEDULED &&
      orderItem.status !== RadiologyRequestStatus.PENDING
    ) {
      throw new BadRequestException(
        'Only SCHEDULED or PENDING order items can start a procedure.',
      );
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
        throw new NotFoundException(
          `Radiology machine "${dto.machineId}" not found.`,
        );
      }
    }

    const itemStatus = dto.endTime
      ? RadiologyRequestStatus.COMPLETED
      : RadiologyRequestStatus.IN_PROGRESS;

    return this.prisma.$transaction(async (tx) => {
      const procedure = await tx.radiologyProcedure.create({
        data: {
          radiologyOrderItemId: orderItemId,
          performedById: dto.performedById,
          machineId: dto.machineId ?? null,
          startTime: new Date(dto.startTime),
          endTime: dto.endTime ? new Date(dto.endTime) : null,
          notes: dto.notes ?? null,
        },
        include: {
          performedBy: {
            select: { id: true, firstName: true, lastName: true },
          },
          machine: true,
        },
      });
      await tx.radiologyOrderItem.update({
        where: { id: orderItemId },
        data: { status: itemStatus },
      });
      await syncRadiologyOrderStatusAfterItemChange(tx, orderItem.orderId);
      return procedure;
    });
  }

  async update(orderItemId: string, dto: UpdateRadiologyProcedureDto) {
    const orderItem = await this.prisma.radiologyOrderItem.findUnique({
      where: { id: orderItemId },
      include: { procedure: true },
    });
    if (!orderItem) {
      throw new NotFoundException(
        `Radiology order item "${orderItemId}" not found.`,
      );
    }
    if (!orderItem.procedure) {
      throw new NotFoundException(
        'No procedure record for this order item. Use POST to create.',
      );
    }

    const updateData: { endTime?: Date; notes?: string } = {};
    if (dto.endTime !== undefined) updateData.endTime = new Date(dto.endTime);
    if (dto.notes !== undefined) updateData.notes = dto.notes;

    return this.prisma.$transaction(async (tx) => {
      const procedure = await tx.radiologyProcedure.update({
        where: { radiologyOrderItemId: orderItemId },
        data: updateData,
        include: {
          performedBy: {
            select: { id: true, firstName: true, lastName: true },
          },
          machine: true,
        },
      });

      if (dto.endTime || procedure.endTime) {
        await tx.radiologyOrderItem.update({
          where: { id: orderItemId },
          data: { status: RadiologyRequestStatus.COMPLETED },
        });
        await syncRadiologyOrderStatusAfterItemChange(tx, orderItem.orderId);
      }

      return procedure;
    });
  }

  async getByOrderItemId(orderItemId: string) {
    const procedure = await this.prisma.radiologyProcedure.findUnique({
      where: { radiologyOrderItemId: orderItemId },
      include: {
        performedBy: { select: { id: true, firstName: true, lastName: true } },
        machine: true,
      },
    });
    if (!procedure) {
      throw new NotFoundException(
        `No procedure record for radiology order item "${orderItemId}".`,
      );
    }
    return procedure;
  }
}
