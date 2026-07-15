import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  InvoiceAuditAction,
  InvoiceCoverageStatus,
  InvoiceItemRefundStatus,
  InvoicePaymentSource,
  Prisma,
  WalletTransactionType,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ConsumableStockService } from '../store/consumable-stock.service';
import { PurchaseItemStockService } from '../purchases/purchase-item-stock.service';
import { assertRefundReviewer, staffLabel } from '../accounts/accounts.utils';
import { InvoiceService } from './invoice.service';

const refundItemInclude = {
  usageSegments: { orderBy: { startAt: 'asc' as const } },
  radiologyOrderItem: {
    include: { procedure: true, report: true },
  },
  labOrder: true,
  labRequest: true,
  dialysisSession: true,
  medicationOrder: {
    include: { _count: { select: { administrations: true } } },
  },
  refundRequests: {
    where: { status: InvoiceItemRefundStatus.pending },
    include: {
      requestedBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          staffId: true,
        },
      },
    },
    take: 1,
  },
  invoice: { select: { id: true, staffId: true, patientId: true } },
} satisfies Prisma.InvoiceItemInclude;

type RefundItemRow = Prisma.InvoiceItemGetPayload<{
  include: typeof refundItemInclude;
}>;

export type ItemRefundEligibility = {
  refundable: boolean;
  blockReason: string | null;
};

@Injectable()
export class InvoiceItemRefundService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => InvoiceService))
    private readonly invoiceService: InvoiceService,
    private readonly consumableStock: ConsumableStockService,
    private readonly purchaseItemStock: PurchaseItemStockService,
  ) {}

  private asDecimal(value: number | string | Prisma.Decimal) {
    return value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value);
  }

  evaluateEligibility(
    item: RefundItemRow,
    options?: { ignorePendingRequestId?: string },
  ): ItemRefundEligibility {
    const render = this.evaluateRenderEligibility(item);
    if (!render.refundable) return render;

    const pending = item.refundRequests[0];
    if (
      pending &&
      (!options?.ignorePendingRequestId ||
        pending.id !== options.ignorePendingRequestId)
    ) {
      return {
        refundable: false,
        blockReason: 'A refund request is already pending accountant approval.',
      };
    }
    return { refundable: true, blockReason: null };
  }

  evaluateRenderEligibility(item: RefundItemRow): ItemRefundEligibility {
    if (item.isRecurringDaily) {
      return {
        refundable: false,
        blockReason: 'Recurring daily lines cannot be refunded.',
      };
    }
    if (item.settled) {
      return {
        refundable: false,
        blockReason: 'This charge has already been rendered and cannot be refunded.',
      };
    }
    if (item.consultationVisitsConsumed > 0) {
      return {
        refundable: false,
        blockReason: 'Consultation credit has already been partially used.',
      };
    }
    if (item.labOrder) {
      return {
        refundable: false,
        blockReason: 'A lab order has already been created for this line.',
      };
    }
    if (item.dialysisSession) {
      return {
        refundable: false,
        blockReason: 'A dialysis session has already been linked to this line.',
      };
    }
    const radiology = item.radiologyOrderItem;
    if (radiology?.procedure || radiology?.report) {
      return {
        refundable: false,
        blockReason: 'Radiology study has already been performed or reported.',
      };
    }
    if (item.dispensedAt) {
      return {
        refundable: false,
        blockReason: 'This drug has already been dispensed.',
      };
    }
    const med = item.medicationOrder;
    if (med) {
      if (med.status === 'Dispensed') {
        return {
          refundable: false,
          blockReason: 'Linked medication order has already been dispensed.',
        };
      }
      if (med._count.administrations > 0) {
        return {
          refundable: false,
          blockReason: 'Linked medication has already been administered.',
        };
      }
    }
    return { refundable: true, blockReason: null };
  }

  enrichItemRefundFields(item: RefundItemRow) {
    const eligibility = this.evaluateEligibility(item);
    const pending = item.refundRequests[0] ?? null;
    return {
      refundPending: pending != null,
      refundable: eligibility.refundable,
      refundBlockReason: eligibility.blockReason,
      activeRefundRequest: pending
        ? {
            id: pending.id,
            status: pending.status,
            reason: pending.reason,
            submittedAt: pending.submittedAt.toISOString(),
            requestedBy: staffLabel(pending.requestedBy),
          }
        : null,
    };
  }

  async listForInvoice(invoiceId: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: { id: true },
    });
    if (!invoice) {
      throw new NotFoundException(`Invoice ${invoiceId} not found`);
    }

    const requests = await this.prisma.invoiceItemRefundRequest.findMany({
      where: { invoiceId },
      orderBy: { submittedAt: 'desc' },
      include: {
        requestedBy: {
          select: {
            email: true,
            staffId: true,
            firstName: true,
            lastName: true,
          },
        },
        reviewedBy: {
          select: {
            email: true,
            staffId: true,
            firstName: true,
            lastName: true,
          },
        },
        invoiceItem: {
          select: {
            id: true,
            customDescription: true,
            serviceId: true,
            drugId: true,
            consumableId: true,
            purchaseItemId: true,
            quantity: true,
            unitPrice: true,
          },
        },
      },
    });

    return {
      requests: requests.map((r) => ({
        id: r.id,
        invoiceId: r.invoiceId,
        invoiceItemId: r.invoiceItemId,
        amount: this.asDecimal(r.amount).toNumber(),
        lineTotal: this.asDecimal(r.lineTotal).toNumber(),
        reason: r.reason,
        status: r.status,
        rejectReason: r.rejectReason,
        submittedAt: r.submittedAt.toISOString(),
        reviewedAt: r.reviewedAt?.toISOString() ?? null,
        executedAt: r.executedAt?.toISOString() ?? null,
        requestedBy: staffLabel(r.requestedBy),
        reviewedBy: r.reviewedBy ? staffLabel(r.reviewedBy) : null,
        invoiceItem: r.invoiceItem,
      })),
    };
  }

  async listPending() {
    const requests = await this.prisma.invoiceItemRefundRequest.findMany({
      where: { status: InvoiceItemRefundStatus.pending },
      orderBy: { submittedAt: 'desc' },
      include: {
        requestedBy: {
          select: {
            email: true,
            staffId: true,
            firstName: true,
            lastName: true,
          },
        },
        invoice: {
          select: {
            id: true,
            invoiceID: true,
            patientId: true,
            status: true,
            totalAmount: true,
          },
        },
        invoiceItem: {
          select: {
            id: true,
            customDescription: true,
            serviceId: true,
            drugId: true,
            consumableId: true,
            purchaseItemId: true,
            quantity: true,
            unitPrice: true,
            amountPaid: true,
          },
        },
      },
    });

    return {
      requests: requests.map((r) => ({
        id: r.id,
        invoiceId: r.invoiceId,
        invoiceItemId: r.invoiceItemId,
        lineTotal: this.asDecimal(r.lineTotal).toNumber(),
        reason: r.reason,
        status: r.status,
        submittedAt: r.submittedAt.toISOString(),
        requestedBy: staffLabel(r.requestedBy),
        invoice: {
          ...r.invoice,
          totalAmount: this.asDecimal(r.invoice.totalAmount).toNumber(),
        },
        invoiceItem: r.invoiceItem
          ? {
              ...r.invoiceItem,
              unitPrice: this.asDecimal(r.invoiceItem.unitPrice).toNumber(),
              amountPaid: this.asDecimal(r.invoiceItem.amountPaid).toNumber(),
            }
          : null,
      })),
    };
  }

  async submit(
    invoiceId: string,
    itemId: string,
    reason: string,
    requesterId: string,
  ) {
    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      throw new BadRequestException('Refund reason is required.');
    }

    const item = await this.prisma.invoiceItem.findFirst({
      where: { id: itemId, invoiceId },
      include: refundItemInclude,
    });
    if (!item) {
      throw new NotFoundException(
        `Invoice item ${itemId} not found on invoice ${invoiceId}`,
      );
    }

    const eligibility = this.evaluateEligibility(item);
    if (!eligibility.refundable) {
      throw new BadRequestException(
        eligibility.blockReason ?? 'This line is not eligible for refund.',
      );
    }

    const existingPending = await this.prisma.invoiceItemRefundRequest.findFirst({
      where: {
        invoiceItemId: itemId,
        status: InvoiceItemRefundStatus.pending,
      },
    });
    if (existingPending) {
      throw new ConflictException(
        'A refund request is already pending for this line.',
      );
    }

    const lineTotal = this.computeLineTotal(item);

    const request = await this.prisma.invoiceItemRefundRequest.create({
      data: {
        invoiceId,
        invoiceItemId: itemId,
        lineTotal,
        reason: trimmedReason,
        requestedById: requesterId,
        status: InvoiceItemRefundStatus.pending,
      },
      include: {
        requestedBy: {
          select: {
            email: true,
            staffId: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return {
      id: request.id,
      invoiceId: request.invoiceId,
      invoiceItemId: request.invoiceItemId,
      lineTotal: this.asDecimal(request.lineTotal).toNumber(),
      reason: request.reason,
      status: request.status,
      submittedAt: request.submittedAt.toISOString(),
      requestedBy: staffLabel(request.requestedBy),
    };
  }

  async cancel(
    invoiceId: string,
    itemId: string,
    requestId: string,
    staffId: string,
    staffRole?: string,
  ) {
    const request = await this.prisma.invoiceItemRefundRequest.findFirst({
      where: { id: requestId, invoiceId, invoiceItemId: itemId },
    });
    if (!request) {
      throw new NotFoundException('Refund request not found.');
    }
    if (request.status !== InvoiceItemRefundStatus.pending) {
      throw new ConflictException('Only pending refund requests can be cancelled.');
    }

    const isAccountHead =
      staffRole === 'ACCOUNT_HEAD' ||
      staffRole === 'SUPER_ADMIN' ||
      staffRole === 'CMD';
    if (request.requestedById !== staffId && !isAccountHead) {
      throw new ForbiddenException(
        'Only the requester or account head can cancel this refund request.',
      );
    }

    return this.prisma.invoiceItemRefundRequest.update({
      where: { id: requestId },
      data: { status: InvoiceItemRefundStatus.cancelled },
    });
  }

  async reject(
    id: string,
    reason: string,
    reviewerId: string,
    staffRole?: string,
  ) {
    assertRefundReviewer(staffRole);
    const trimmed = reason.trim();
    if (!trimmed) {
      throw new BadRequestException('Rejection reason is required.');
    }

    const request = await this.prisma.invoiceItemRefundRequest.findUnique({
      where: { id },
    });
    if (!request) {
      throw new NotFoundException('Refund request not found.');
    }
    if (request.status !== InvoiceItemRefundStatus.pending) {
      throw new ConflictException('Refund request is no longer pending.');
    }

    return this.prisma.invoiceItemRefundRequest.update({
      where: { id },
      data: {
        status: InvoiceItemRefundStatus.rejected,
        rejectReason: trimmed,
        reviewedById: reviewerId,
        reviewedAt: new Date(),
      },
    });
  }

  async approve(id: string, reviewerId: string, staffRole?: string) {
    assertRefundReviewer(staffRole);

    return this.prisma.$transaction(async (tx) => {
      const request = await tx.invoiceItemRefundRequest.findUnique({
        where: { id },
      });
      if (!request) {
        throw new NotFoundException('Refund request not found.');
      }
      if (request.status !== InvoiceItemRefundStatus.pending) {
        throw new ConflictException('Refund request is no longer pending.');
      }

      if (!request.invoiceItemId) {
        throw new BadRequestException(
          'Refund request is missing its invoice line reference.',
        );
      }

      const item = await tx.invoiceItem.findFirst({
        where: {
          id: request.invoiceItemId,
          invoiceId: request.invoiceId,
        },
        include: refundItemInclude,
      });
      if (!item) {
        throw new NotFoundException('Invoice line no longer exists.');
      }

      const eligibility = this.evaluateRenderEligibility(item);
      if (!eligibility.refundable) {
        throw new BadRequestException(
          eligibility.blockReason ?? 'This line is no longer eligible for refund.',
        );
      }

      const invoice = await tx.invoice.findUnique({
        where: { id: request.invoiceId },
      });
      if (!invoice) {
        throw new NotFoundException('Invoice not found.');
      }

      const reversedAmount = await this.reverseItemPaymentAllocations(
        tx,
        item.id,
        invoice.id,
        invoice.patientId,
        reviewerId,
      );

      await this.reverseItemCoverages(tx, item.id, invoice.id, reviewerId);
      await this.cleanupPendingLinks(tx, item.id);

      if (item.consumableId) {
        await this.consumableStock.releaseFifoOutForInvoiceItem(
          tx,
          item.id,
          invoice.staffId,
        );
      }
      if (item.purchaseItemId) {
        await this.purchaseItemStock.releaseFifoOutForInvoiceItem(
          tx,
          item.id,
          invoice.staffId,
        );
      }

      const remainingCount = await tx.invoiceItem.count({
        where: {
          invoiceId: invoice.id,
          id: { not: item.id },
        },
      });
      const isLastItem = remainingCount === 0;

      let invoiceRefundId: string | null = null;
      if (reversedAmount.gt(0)) {
        const refund = await tx.invoiceRefund.create({
          data: {
            invoiceId: invoice.id,
            invoiceItemId: item.id,
            amount: reversedAmount,
            reason: request.reason,
            processedById: reviewerId,
            createdById: request.requestedById,
          },
        });
        invoiceRefundId = refund.id;

        await tx.invoiceAuditLog.create({
          data: {
            invoiceId: invoice.id,
            action: InvoiceAuditAction.REFUND_ISSUED,
            description: `Refund of ₦${reversedAmount.toFixed(2)} approved for invoice line.`,
            performedById: reviewerId,
            metadata: {
              invoiceItemRefundRequestId: request.id,
              invoiceItemId: item.id,
              invoiceRefundId: refund.id,
              amount: reversedAmount.toFixed(2),
            } as Prisma.InputJsonValue,
          },
        });
      } else {
        await tx.invoiceAuditLog.create({
          data: {
            invoiceId: invoice.id,
            action: InvoiceAuditAction.ITEM_REMOVED,
            description: `Refund approved: line removed (${request.reason}).`,
            performedById: reviewerId,
            metadata: {
              invoiceItemRefundRequestId: request.id,
              invoiceItemId: item.id,
            } as Prisma.InputJsonValue,
          },
        });
      }

      const updatedRequest = await tx.invoiceItemRefundRequest.update({
        where: { id: request.id },
        data: {
          status: InvoiceItemRefundStatus.approved,
          amount: reversedAmount,
          reviewedById: reviewerId,
          reviewedAt: new Date(),
          executedAt: new Date(),
          invoiceRefundId,
        },
      });

      await tx.invoiceItem.delete({ where: { id: item.id } });

      let invoiceDeleted = false;
      if (isLastItem) {
        const refreshed = await tx.invoice.findUnique({
          where: { id: invoice.id },
        });
        const activeCoverage = await tx.invoiceCoverage.count({
          where: {
            invoiceId: invoice.id,
            status: { not: InvoiceCoverageStatus.REVERSED },
          },
        });
        if (
          refreshed &&
          this.asDecimal(refreshed.amountPaid).lte(0) &&
          activeCoverage === 0
        ) {
          await tx.invoice.delete({ where: { id: invoice.id } });
          invoiceDeleted = true;
        } else if (refreshed) {
          await this.invoiceService.recalculateInvoiceTotals(invoice.id, tx);
        }
      } else {
        await this.invoiceService.recalculateInvoiceTotals(invoice.id, tx);
      }

      return {
        request: updatedRequest,
        invoiceDeleted,
        invoiceId: invoice.id,
        refundedAmount: reversedAmount.toNumber(),
      };
    });
  }

  private computeLineTotal(item: {
    unitPrice: Prisma.Decimal;
    quantity: number;
    isRecurringDaily: boolean;
    usageSegments: Array<{ startAt: Date; endAt: Date | null }>;
  }) {
    const unitPrice = this.asDecimal(item.unitPrice);
    if (item.isRecurringDaily) {
      let totalDays = 0;
      const now = new Date();
      for (const segment of item.usageSegments) {
        const endAt = segment.endAt ?? now;
        const duration = endAt.getTime() - segment.startAt.getTime();
        if (duration <= 0) continue;
        const days = segment.endAt
          ? Math.ceil(duration / (24 * 60 * 60 * 1000))
          : Math.floor(duration / (24 * 60 * 60 * 1000));
        totalDays += days;
      }
      return unitPrice.mul(totalDays);
    }
    return unitPrice.mul(item.quantity);
  }

  private async reverseItemPaymentAllocations(
    tx: Prisma.TransactionClient,
    invoiceItemId: string,
    invoiceId: string,
    patientId: string,
    performedByStaffId: string,
  ): Promise<Prisma.Decimal> {
    const allocations = await tx.invoiceItemPayment.findMany({
      where: { invoiceItemId },
      include: {
        invoicePayment: {
          include: { walletTransaction: true },
        },
      },
    });

    if (allocations.length === 0) {
      return new Prisma.Decimal(0);
    }

    let totalReversed = new Prisma.Decimal(0);
    const walletCredits = new Map<string, Prisma.Decimal>();

    for (const alloc of allocations) {
      const allocAmt = this.asDecimal(alloc.amount);
      totalReversed = totalReversed.add(allocAmt);

      await tx.invoiceItem.update({
        where: { id: invoiceItemId },
        data: { amountPaid: { decrement: allocAmt } },
      });

      const payment = alloc.invoicePayment;
      if (payment?.source === InvoicePaymentSource.WALLET && payment.id) {
        const prev = walletCredits.get(payment.id) ?? new Prisma.Decimal(0);
        walletCredits.set(payment.id, prev.add(allocAmt));
      }

      await tx.invoiceItemPayment.delete({ where: { id: alloc.id } });
    }

    const invoice = await tx.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) {
      throw new NotFoundException('Invoice not found during payment reversal.');
    }

    await tx.invoice.update({
      where: { id: invoiceId },
      data: {
        amountPaid: this.asDecimal(invoice.amountPaid).sub(totalReversed),
      },
    });

    if (walletCredits.size > 0) {
      const wallet = await tx.patientWallet.upsert({
        where: { patientId },
        update: {},
        create: { patientId },
      });

      for (const [paymentId, creditAmt] of walletCredits) {
        await tx.patientWallet.update({
          where: { id: wallet.id },
          data: { balance: { increment: creditAmt } },
        });
        await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            type: WalletTransactionType.CREDIT,
            amount: creditAmt,
            reference: `refund_item_${invoiceItemId}`,
            invoiceId,
            createdById: performedByStaffId,
          },
        });
      }
    }

    return totalReversed;
  }

  private async reverseItemCoverages(
    tx: Prisma.TransactionClient,
    invoiceItemId: string,
    invoiceId: string,
    staffId: string,
  ) {
    const coverages = await tx.invoiceCoverage.findMany({
      where: {
        invoiceItemId,
        invoiceId,
        status: { not: InvoiceCoverageStatus.REVERSED },
      },
    });

    for (const coverage of coverages) {
      await tx.invoiceCoverage.update({
        where: { id: coverage.id },
        data: {
          status: InvoiceCoverageStatus.REVERSED,
          reversedById: staffId,
          reversedAt: new Date(),
          reversalReason: 'Invoice item refund approved',
        },
      });
    }
  }

  private async cleanupPendingLinks(
    tx: Prisma.TransactionClient,
    invoiceItemId: string,
  ) {
    const labRequest = await tx.labRequest.findFirst({
      where: { invoiceItemId },
    });
    if (labRequest) {
      await tx.labRequest.delete({ where: { id: labRequest.id } });
    }

    const radiologyItem = await tx.radiologyOrderItem.findFirst({
      where: { invoiceItemId },
      include: { procedure: true, report: true },
    });
    if (radiologyItem && !radiologyItem.procedure && !radiologyItem.report) {
      await tx.radiologyOrderItem.delete({ where: { id: radiologyItem.id } });
    }

    const medicationOrder = await tx.medicationOrder.findFirst({
      where: { invoiceItemId },
      include: { _count: { select: { administrations: true } } },
    });
    if (
      medicationOrder &&
      medicationOrder.status !== 'Dispensed' &&
      medicationOrder._count.administrations === 0
    ) {
      await tx.medicationOrder.delete({ where: { id: medicationOrder.id } });
    }
  }
}
