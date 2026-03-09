import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateLabResultDto } from './dto/create-lab-result.dto';
import { CreateLabResultBatchDto } from './dto/create-lab-result-batch.dto';

@Injectable()
export class LabResultService {
  constructor(private readonly prisma: PrismaService) {}

  private async validateFieldBelongsToOrderItem(
    orderItemId: string,
    fieldId: string,
  ) {
    const orderItem = await this.prisma.labOrderItem.findUnique({
      where: { id: orderItemId },
      select: { testVersionId: true },
    });
    if (!orderItem) {
      throw new NotFoundException(`Lab order item "${orderItemId}" not found.`);
    }
    const field = await this.prisma.labTestField.findUnique({
      where: { id: fieldId },
      select: { testVersionId: true },
    });
    if (!field) {
      throw new NotFoundException(`Lab test field "${fieldId}" not found.`);
    }
    if (field.testVersionId !== orderItem.testVersionId) {
      throw new BadRequestException(
        `Field "${fieldId}" does not belong to the test version of order item "${orderItemId}".`,
      );
    }
  }

  async create(dto: CreateLabResultDto) {
    await this.validateFieldBelongsToOrderItem(dto.orderItemId, dto.fieldId);

    const staff = await this.prisma.staff.findUnique({
      where: { id: dto.enteredBy },
    });
    if (!staff) {
      throw new NotFoundException(`Staff "${dto.enteredBy}" not found.`);
    }

    return this.prisma.labResult.upsert({
      where: {
        orderItemId_fieldId: { orderItemId: dto.orderItemId, fieldId: dto.fieldId },
      },
      create: {
        orderItemId: dto.orderItemId,
        fieldId: dto.fieldId,
        value: dto.value,
        enteredById: dto.enteredBy,
      },
      update: { value: dto.value, enteredById: dto.enteredBy },
      include: {
        field: true,
        enteredBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async createBatch(dto: CreateLabResultBatchDto) {
    const staff = await this.prisma.staff.findUnique({
      where: { id: dto.enteredBy },
    });
    if (!staff) {
      throw new NotFoundException(`Staff "${dto.enteredBy}" not found.`);
    }

    for (const r of dto.results) {
      await this.validateFieldBelongsToOrderItem(dto.orderItemId, r.fieldId);
    }

    const created = await this.prisma.$transaction(
      dto.results.map((r) =>
        this.prisma.labResult.upsert({
          where: {
            orderItemId_fieldId: {
              orderItemId: dto.orderItemId,
              fieldId: r.fieldId,
            },
          },
          create: {
            orderItemId: dto.orderItemId,
            fieldId: r.fieldId,
            value: r.value,
            enteredById: dto.enteredBy,
          },
          update: { value: r.value, enteredById: dto.enteredBy },
          include: { field: true },
        }),
      ),
    );
    return created;
  }

  async findAllByOrderItemId(orderItemId: string) {
    const orderItem = await this.prisma.labOrderItem.findUnique({
      where: { id: orderItemId },
    });
    if (!orderItem) {
      throw new NotFoundException(
        `Lab order item "${orderItemId}" not found.`,
      );
    }
    return this.prisma.labResult.findMany({
      where: { orderItemId },
      include: {
        field: true,
        enteredBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { field: { position: 'asc' } },
    });
  }
}
