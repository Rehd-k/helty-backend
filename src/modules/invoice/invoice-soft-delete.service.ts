import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import {
  DialysisSessionStatus,
  InvoiceAuditAction,
  InvoicePaymentSource,
  InvoiceStatus,
  LabOrderStatus,
  MedicationRequestStatus,
  PrescriptionRefillRequestStatus,
  Prisma,
  SurgeryRequestStatus,
  WalletTransactionType,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const SOFT_DELETE_ROLES = new Set([
  'BILLING_HEAD',
  'ACCOUNT_HEAD',
  'ACCOUNTING_HEAD',
  'SUPER_ADMIN',
]);

type SoftDeleteActor = {
  sub?: string;
  staffRole?: string;
  accountType?: string;
};

export type SoftDeleteInvoiceResult = {
  deleted: { id: string; invoiceID: string }[];
  skipped: { id: string; reason: string }[];
  rejected: { id: string; reason: string }[];
};

const invoiceForDeleteInclude = {
  payments: true,
  invoiceItems: {
    include: {
      labOrder: {
        include: {
          items: { include: { sample: true, results: true } },
        },
      },
      labRequest: true,
      radiologyOrderItem: {
        include: { procedure: true, report: true, order: true },
      },
      medicationOrder: {
        include: {
          _count: { select: { administrations: true } },
          medicationRequests: true,
        },
      },
      medicationRequest: true,
      dialysisSession: {
        include: { consumables: { select: { id: true, usageEventId: true } } },
      },
      surgeryRequest: {
        include: { schedule: true, case: true },
      },
      prescriptionRefillRequest: true,
    },
  },
} satisfies Prisma.InvoiceInclude;

type InvoiceForDelete = Prisma.InvoiceGetPayload<{
  include: typeof invoiceForDeleteInclude;
}>;

@Injectable()
export class InvoiceSoftDeleteService {
  constructor(private readonly prisma: PrismaService) {}

  assertCanSoftDelete(actor: SoftDeleteActor | undefined) {
    const role = (actor?.staffRole ?? '')
      .trim()
      .toUpperCase()
      .replace(/-/g, '_');
    const account = (actor?.accountType ?? '').trim().toUpperCase();
    if (SOFT_DELETE_ROLES.has(role) || account === 'SUPER_ADMIN') return;
    throw new ForbiddenException(
      'Only a billing head or account head can delete invoices.',
    );
  }

  async softDeleteMany(
    invoiceIds: string[],
    actor: SoftDeleteActor | undefined,
  ): Promise<SoftDeleteInvoiceResult> {
    this.assertCanSoftDelete(actor);
    const staffId = actor?.sub?.trim();
    if (!staffId) {
      throw new BadRequestException('Authenticated staff id is required.');
    }

    const result: SoftDeleteInvoiceResult = {
      deleted: [],
      skipped: [],
      rejected: [],
    };
    const seen = new Set<string>();

    for (const rawId of invoiceIds) {
      const id = rawId.trim();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      try {
        const outcome = await this.prisma.$transaction((tx) =>
          this.softDeleteOne(tx, id, staffId),
        );
        if (outcome.kind === 'deleted') {
          result.deleted.push({ id, invoiceID: outcome.invoiceID });
        } else if (outcome.kind === 'skipped') {
          result.skipped.push({ id, reason: outcome.reason });
        } else {
          result.rejected.push({ id, reason: outcome.reason });
        }
      } catch (error) {
        const reason =
          error instanceof Error ? error.message : 'Could not delete invoice.';
        result.rejected.push({ id, reason });
      }
    }

    return result;
  }

  private async softDeleteOne(
    tx: Prisma.TransactionClient,
    invoiceId: string,
    staffId: string,
  ): Promise<
    | { kind: 'deleted'; invoiceID: string }
    | { kind: 'skipped' | 'rejected'; reason: string }
  > {
    const invoice = await tx.invoice.findUnique({
      where: { id: invoiceId },
      include: invoiceForDeleteInclude,
    });
    if (!invoice) {
      return { kind: 'rejected', reason: 'Invoice not found.' };
    }
    if (invoice.status === InvoiceStatus.DELETED) {
      return { kind: 'skipped', reason: 'Invoice is already deleted.' };
    }
    if (invoice.status === InvoiceStatus.PENDING) {
      return {
        kind: 'rejected',
        reason: 'Unpaid invoices are removed with the existing delete action.',
      };
    }

    const block = this.blockReason(invoice);
    if (block) return { kind: 'rejected', reason: block };

    await this.removePendingWork(tx, invoice);
    await this.creditWalletPayments(tx, invoice, staffId);

    await tx.invoice.update({
      where: { id: invoice.id },
      data: {
        status: InvoiceStatus.DELETED,
        deletedAt: new Date(),
        deletedById: staffId,
        updatedById: staffId,
      },
    });

    await tx.invoiceAuditLog.create({
      data: {
        invoiceId: invoice.id,
        action: InvoiceAuditAction.INVOICE_DELETED,
        description: `Invoice ${invoice.invoiceID} marked deleted. Live totals exclude it.`,
        performedById: staffId,
        metadata: {
          previousStatus: invoice.status,
          amountPaid: invoice.amountPaid.toString(),
        } as Prisma.InputJsonValue,
      },
    });

    return { kind: 'deleted', invoiceID: invoice.invoiceID };
  }

  private blockReason(invoice: InvoiceForDelete): string | null {
    for (const item of invoice.invoiceItems) {
      if (item.dispensedAt) {
        return 'A drug on this invoice has already been dispensed.';
      }
      const lab = item.labOrder;
      if (lab) {
        if (lab.status !== LabOrderStatus.PENDING) {
          return 'A lab order on this invoice is already in progress.';
        }
        const started = lab.items.some(
          (line) => line.sample != null || line.results.length > 0,
        );
        if (started) {
          return 'A lab order on this invoice already has a sample or result.';
        }
      }
      const radiology = item.radiologyOrderItem;
      if (radiology?.procedure || radiology?.report) {
        return 'A radiology study on this invoice has already been performed or reported.';
      }
      const order = item.medicationOrder;
      if (order) {
        if (order.status === 'Dispensed' || order._count.administrations > 0) {
          return 'A medication on this invoice has already been dispensed or administered.';
        }
        if (
          order.medicationRequests.some(
            (req) => req.status === MedicationRequestStatus.DISPENSED,
          )
        ) {
          return 'A medication request on this invoice has already been dispensed.';
        }
      }
      if (item.medicationRequest?.status === MedicationRequestStatus.DISPENSED) {
        return 'A medication request on this invoice has already been dispensed.';
      }
      const dialysis = item.dialysisSession;
      if (dialysis) {
        if (
          dialysis.status === DialysisSessionStatus.IN_PROGRESS ||
          dialysis.status === DialysisSessionStatus.COMPLETED ||
          dialysis.startedAt != null
        ) {
          return 'A dialysis session on this invoice has already started.';
        }
        if (dialysis.consumables.some((row) => row.usageEventId)) {
          return 'Dialysis consumables on this invoice have already been used.';
        }
      }
      const surgery = item.surgeryRequest;
      if (surgery) {
        const started =
          surgery.schedule != null ||
          surgery.case != null ||
          (surgery.status !== SurgeryRequestStatus.REQUESTED &&
            surgery.status !== SurgeryRequestStatus.CANCELLED);
        if (started) {
          return 'A surgery request on this invoice has already been scheduled or started.';
        }
      }
      if (
        item.prescriptionRefillRequest?.status ===
        PrescriptionRefillRequestStatus.FULFILLED
      ) {
        return 'A prescription refill on this invoice has already been fulfilled.';
      }
    }
    return null;
  }

  private async removePendingWork(
    tx: Prisma.TransactionClient,
    invoice: InvoiceForDelete,
  ) {
    const radiologyOrderIds = new Set<string>();

    for (const item of invoice.invoiceItems) {
      if (item.labRequest) {
        await tx.labRequest.delete({ where: { id: item.labRequest.id } });
      }
      if (item.labOrder) {
        await tx.labOrder.delete({ where: { id: item.labOrder.id } });
      }
      if (item.radiologyOrderItem) {
        radiologyOrderIds.add(item.radiologyOrderItem.orderId);
        await tx.radiologyOrderItem.delete({
          where: { id: item.radiologyOrderItem.id },
        });
      }
      if (item.medicationOrder) {
        await tx.medicationOrder.delete({
          where: { id: item.medicationOrder.id },
        });
      } else if (item.medicationRequest) {
        await tx.medicationRequest.delete({
          where: { id: item.medicationRequest.id },
        });
      }
      if (
        item.dialysisSession &&
        item.dialysisSession.status === DialysisSessionStatus.PENDING
      ) {
        await tx.dialysisSession.delete({
          where: { id: item.dialysisSession.id },
        });
      }
      if (
        item.surgeryRequest &&
        item.surgeryRequest.status === SurgeryRequestStatus.REQUESTED &&
        !item.surgeryRequest.schedule &&
        !item.surgeryRequest.case
      ) {
        await tx.surgeryRequest.delete({
          where: { id: item.surgeryRequest.id },
        });
      }
      const refill = item.prescriptionRefillRequest;
      if (
        refill &&
        refill.status !== PrescriptionRefillRequestStatus.FULFILLED &&
        refill.status !== PrescriptionRefillRequestStatus.CANCELLED
      ) {
        await tx.prescriptionRefillRequest.update({
          where: { id: refill.id },
          data: {
            status: PrescriptionRefillRequestStatus.CANCELLED,
            invoiceItemId: null,
          },
        });
      }
    }

    if (radiologyOrderIds.size > 0) {
      await tx.radiologyOrder.deleteMany({
        where: {
          id: { in: [...radiologyOrderIds] },
          items: { none: {} },
        },
      });
    }

    await tx.labRequest.deleteMany({ where: { invoiceId: invoice.id } });
  }

  private async creditWalletPayments(
    tx: Prisma.TransactionClient,
    invoice: InvoiceForDelete,
    staffId: string,
  ) {
    const walletPayments = invoice.payments.filter(
      (payment) => payment.source === InvoicePaymentSource.WALLET,
    );
    if (walletPayments.length === 0) return;

    const wallet = await tx.patientWallet.findUnique({
      where: { patientId: invoice.patientId },
    });
    if (!wallet) {
      throw new BadRequestException(
        'Wallet payment cannot be reversed because the patient wallet is missing.',
      );
    }

    for (const payment of walletPayments) {
      await tx.patientWallet.update({
        where: { id: wallet.id },
        data: { balance: { increment: payment.amount } },
      });
      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: WalletTransactionType.CREDIT,
          amount: payment.amount,
          reference: `invoice_soft_delete_${invoice.id}`,
          invoiceId: invoice.id,
          createdById: staffId,
        },
      });
    }
  }
}
