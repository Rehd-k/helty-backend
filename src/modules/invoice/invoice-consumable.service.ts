import {
  BadRequestException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, InvoiceAuditAction, InvoiceStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ConsumableStockService } from '../store/consumable-stock.service';
import { InvoiceService } from './invoice.service';
import { ReturnConsumableInvoiceItemDto } from './dto/invoice.dto';
import { DateRangeSkipTakeDto } from '../../common/dto/date-range.dto';
import { parseDateRange } from '../../common/utils/date-range';
import { patientNameFieldsSelect } from '../../common/utils/patient-display-name.util';

@Injectable()
export class InvoiceConsumableService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly consumableStock: ConsumableStockService,
    private readonly invoiceService: InvoiceService,
  ) {}

  private asDecimal(value: number | string | Prisma.Decimal) {
    return value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value);
  }

  private assertInvoiceNotPaid(status: InvoiceStatus) {
    if (status === InvoiceStatus.PAID) {
      throw new BadRequestException(
        'This invoice is paid and cannot be modified.',
      );
    }
  }

  private async hasConsumableItems(invoiceId: string): Promise<boolean> {
    const count = await this.prisma.invoiceItem.count({
      where: { invoiceId, consumableId: { not: null } },
    });
    return count > 0;
  }

  async findAllConsumableInvoices(
    params: DateRangeSkipTakeDto & {
      search?: string;
      category?: string;
      query?: string;
    },
  ) {
    const { skip = 0, take = 20, fromDate, toDate, query, category } = params;
    const { from, to } = parseDateRange(fromDate, toDate);
    const updatedAt: Prisma.DateTimeFilter = { gte: from, lte: to };
    let where: Prisma.InvoiceWhereInput = {
      updatedAt,
      invoiceItems: { some: { consumableId: { not: null } } },
    };
    const q = query?.trim();
    if (q) {
      const needle = { contains: q, mode: 'insensitive' as const };
      if (category === 'patientId') {
        where = { ...where, patient: { patientId: needle } };
      } else if (category === 'fullName') {
        where = {
          ...where,
          patient: { OR: [{ firstName: needle }, { surname: needle }] },
        };
      } else {
        where = {
          ...where,
          OR: [
            { patient: { OR: [{ firstName: needle }, { surname: needle }, { patientId: needle }] } },
            {
              invoiceItems: {
                some: {
                  consumable: { name: needle },
                },
              },
            },
          ],
        };
      }
    }

    const [invoices, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        skip: Number(skip),
        take: Number(take),
        orderBy: { createdAt: 'desc' },
        include: {
          patient: {
            select: patientNameFieldsSelect,
          },
          invoiceItems: {
            where: { consumableId: { not: null } },
            include: {
              consumable: { select: { id: true, name: true, category: true } },
            },
          },
        },
      }),
      this.prisma.invoice.count({ where }),
    ]);
    return { invoices, total, skip, take };
  }

  async returnConsumableInvoiceItem(
    invoiceId: string,
    itemId: string,
    dto: ReturnConsumableInvoiceItemDto,
    performedByStaffId: string,
  ) {
    try {
      const has = await this.hasConsumableItems(invoiceId);
      if (!has) {
        throw new NotFoundException(
          `Invoice ${invoiceId} does not contain consumable items`,
        );
      }

      return await this.prisma.$transaction(async (tx) => {
        const invoice = await tx.invoice.findUnique({
          where: { id: invoiceId },
        });
        if (!invoice) {
          throw new NotFoundException(`Invoice ${invoiceId} not found`);
        }
        this.assertInvoiceNotPaid(invoice.status);

        const item = await tx.invoiceItem.findFirst({
          where: { id: itemId, invoiceId },
          include: { _count: { select: { allocations: true } } },
        });
        if (!item || !item.consumableId) {
          throw new NotFoundException(
            `Consumable invoice item ${itemId} not found on invoice ${invoiceId}`,
          );
        }

        if (item.isRecurringDaily) {
          throw new BadRequestException(
            'Returns are not supported for recurring daily lines.',
          );
        }

        if (this.asDecimal(item.amountPaid).gt(0)) {
          throw new BadRequestException(
            'Cannot return a line that has a payment amount; only unpaid lines can be returned.',
          );
        }
        if (item._count.allocations > 0) {
          throw new BadRequestException(
            'Cannot return a line that has payment allocations.',
          );
        }

        const returnQty = dto.quantity;
        if (returnQty > item.quantity) {
          throw new BadRequestException(
            `Return quantity (${returnQty}) exceeds line quantity (${item.quantity}).`,
          );
        }

        await this.consumableStock.releaseOutQuantityForInvoiceItem(
          tx,
          itemId,
          returnQty,
          performedByStaffId,
        );

        const isFullReturn = returnQty === item.quantity;

        if (isFullReturn) {
          await tx.invoiceItem.delete({ where: { id: itemId } });
        } else {
          await tx.invoiceItem.update({
            where: { id: itemId },
            data: { quantity: item.quantity - returnQty },
          });
        }

        await this.invoiceService.recalculateInvoiceTotals(invoiceId, tx);

        await tx.invoiceAuditLog.create({
          data: {
            invoiceId,
            action: InvoiceAuditAction.ITEM_UPDATED,
            description: `Consumable return: ${returnQty} unit(s)${isFullReturn ? ' (line removed)' : ''}.`,
            performedById: performedByStaffId,
            metadata: {
              invoiceItemId: item.id,
              consumableId: item.consumableId,
              quantity: returnQty,
              fullLine: isFullReturn,
            } as Prisma.InputJsonValue,
          },
        });

        const updatedInvoice = await tx.invoice.findUniqueOrThrow({
          where: { id: invoiceId },
          include: {
            patient: {
              select: patientNameFieldsSelect,
            },
            invoiceItems: {
              include: {
                consumable: { select: { id: true, name: true } },
              },
            },
          },
        });

        return {
          fullLineRemoved: isFullReturn,
          invoice: updatedInvoice,
        };
      });
    } catch (error) {
      if (error instanceof HttpException) throw error;
      const message =
        error instanceof Error ? error.message : 'Consumable return failed';
      throw new BadRequestException(message);
    }
  }
}
