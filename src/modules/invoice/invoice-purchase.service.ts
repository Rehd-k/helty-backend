import {
  BadRequestException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InvoiceAuditAction, InvoiceStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PurchaseItemStockService } from '../purchases/purchase-item-stock.service';
import { InvoiceService } from './invoice.service';
import { patientNameFieldsSelect } from '../../common/utils/patient-display-name.util';
import { ReturnPurchaseInvoiceItemDto } from './dto/invoice.dto';

@Injectable()
export class InvoicePurchaseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly purchaseItemStock: PurchaseItemStockService,
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

  private async hasPurchaseItems(invoiceId: string): Promise<boolean> {
    const count = await this.prisma.invoiceItem.count({
      where: { invoiceId, purchaseItemId: { not: null } },
    });
    return count > 0;
  }

  async returnPurchaseInvoiceItem(
    invoiceId: string,
    itemId: string,
    dto: ReturnPurchaseInvoiceItemDto,
    performedByStaffId: string,
  ) {
    try {
      const hasPurchaseItems = await this.hasPurchaseItems(invoiceId);
      if (!hasPurchaseItems) {
        throw new NotFoundException(
          `Invoice ${invoiceId} does not contain purchase item lines`,
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
        if (!item || !item.purchaseItemId || !item.purchasesLocationId) {
          throw new NotFoundException(
            `Purchase item invoice line ${itemId} not found on invoice ${invoiceId}`,
          );
        }

        if (item.isRecurringDaily) {
          throw new BadRequestException(
            'Returns are not supported for recurring daily purchase item lines.',
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

        await this.purchaseItemStock.releaseOutQuantityForInvoiceItem(
          tx,
          itemId,
          returnQty,
          performedByStaffId,
        );

        const isFullReturn = returnQty === item.quantity;
        const returnRow = await tx.invoicePurchaseItemReturn.create({
          data: {
            invoiceId,
            invoiceItemId: isFullReturn ? item.id : itemId,
            purchaseItemId: item.purchaseItemId,
            quantity: returnQty,
            purchasesLocationId: item.purchasesLocationId,
            performedById: performedByStaffId,
            reason: dto.reason?.trim() || null,
          },
          select: { id: true },
        });

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
            action: InvoiceAuditAction.PURCHASE_ITEM_RETURNED,
            description: `Purchase item return: ${returnQty} unit(s)${isFullReturn ? ' (line removed)' : ''}.`,
            performedById: performedByStaffId,
            metadata: {
              returnId: returnRow.id,
              invoiceItemId: item.id,
              purchaseItemId: item.purchaseItemId,
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
              where: { purchaseItemId: { not: null } },
              include: {
                purchaseItem: { select: { id: true, itemName: true, sku: true } },
                purchasesLocation: { select: { id: true, name: true } },
              },
            },
          },
        });

        return {
          returnId: returnRow.id,
          fullLineRemoved: isFullReturn,
          invoice: updatedInvoice,
        };
      });
    } catch (error) {
      if (error instanceof HttpException) throw error;
      const message =
        error instanceof Error ? error.message : 'Purchase item return failed';
      throw new BadRequestException(message);
    }
  }
}
