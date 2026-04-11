import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { LabRequestStatus } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { InvoiceService } from '../../invoice/invoice.service';
import { CreateLabResultDto } from './dto/create-lab-result.dto';
import { CreateLabResultBatchDto } from './dto/create-lab-result-batch.dto';

@Injectable()
export class LabResultService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly invoiceService: InvoiceService,
  ) {}

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

  /** When every required field on every order line has a result, mark linked LabRequest COMPLETED. */
  private async maybeCompleteLabRequestIfOrderResultsComplete(
    orderId: string,
  ): Promise<void> {
    const order = await this.prisma.labOrder.findUnique({
      where: { id: orderId },
      select: {
        invoiceItemId: true,
        items: {
          select: {
            results: { select: { fieldId: true } },
            testVersion: {
              select: {
                fields: {
                  where: { required: true },
                  select: { id: true },
                },
              },
            },
          },
        },
      },
    });
    if (!order?.invoiceItemId) return;

    for (const item of order.items) {
      const requiredIds = item.testVersion.fields.map((f) => f.id);
      const resultFieldIds = new Set(item.results.map((r) => r.fieldId));
      for (const req of requiredIds) {
        if (!resultFieldIds.has(req)) return;
      }
    }

    await this.prisma.labRequest.updateMany({
      where: {
        invoiceItemId: order.invoiceItemId,
        status: { not: LabRequestStatus.CANCELLED },
      },
      data: { status: LabRequestStatus.COMPLETED },
    });
  }

  async create(dto: CreateLabResultDto) {
    await this.validateFieldBelongsToOrderItem(dto.orderItemId, dto.fieldId);

    const staff = await this.prisma.staff.findUnique({
      where: { id: dto.enteredBy },
    });
    if (!staff) {
      throw new NotFoundException(`Staff "${dto.enteredBy}" not found.`);
    }

    const link = await this.prisma.labOrderItem.findUnique({
      where: { id: dto.orderItemId },
      select: { orderId: true },
    });
    if (!link) {
      throw new NotFoundException(`Lab order item "${dto.orderItemId}" not found.`);
    }

    const out = await this.prisma.$transaction(async (tx) => {
      const orderItem = await tx.labOrderItem.findUnique({
        where: { id: dto.orderItemId },
        select: { order: { select: { invoiceItemId: true } } },
      });
      await this.invoiceService.settleInvoiceItemIfPresent(
        tx,
        orderItem?.order?.invoiceItemId,
      );
      return tx.labResult.upsert({
        where: {
          orderItemId_fieldId: {
            orderItemId: dto.orderItemId,
            fieldId: dto.fieldId,
          },
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
    });
    await this.maybeCompleteLabRequestIfOrderResultsComplete(link.orderId);
    return out;
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

    const link = await this.prisma.labOrderItem.findUnique({
      where: { id: dto.orderItemId },
      select: { orderId: true },
    });
    if (!link) {
      throw new NotFoundException(`Lab order item "${dto.orderItemId}" not found.`);
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const orderItem = await tx.labOrderItem.findUnique({
        where: { id: dto.orderItemId },
        select: { order: { select: { invoiceItemId: true } } },
      });
      await this.invoiceService.settleInvoiceItemIfPresent(
        tx,
        orderItem?.order?.invoiceItemId,
      );
      return Promise.all(
        dto.results.map((r) =>
          tx.labResult.upsert({
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
    });
    await this.maybeCompleteLabRequestIfOrderResultsComplete(link.orderId);
    return created;
  }

  async findAllByOrderItemId(orderItemId: string) {
    const orderItem = await this.prisma.labOrderItem.findUnique({
      where: { id: orderItemId },
    });
    if (!orderItem) {
      throw new NotFoundException(`Lab order item "${orderItemId}" not found.`);
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
