import { ForbiddenException } from '@nestjs/common';
import {
  InvoiceAuditAction,
  InvoicePaymentSource,
  InvoiceStatus,
  Prisma,
  WalletTransactionType,
} from '@prisma/client';
import { InvoiceSoftDeleteService } from './invoice-soft-delete.service';

function paidInvoice(overrides: Record<string, unknown> = {}) {
  return {
    id: 'inv-1',
    invoiceID: 'INV-1',
    patientId: 'patient-1',
    status: InvoiceStatus.PAID,
    amountPaid: new Prisma.Decimal(1500),
    payments: [
      {
        id: 'pay-1',
        source: InvoicePaymentSource.WALLET,
        amount: new Prisma.Decimal(1500),
      },
    ],
    invoiceItems: [
      {
        id: 'item-1',
        dispensedAt: null,
        labOrder: null,
        labRequest: { id: 'lab-req-1' },
        radiologyOrderItem: null,
        medicationOrder: null,
        medicationRequest: null,
        dialysisSession: null,
        surgeryRequest: null,
        prescriptionRefillRequest: null,
      },
    ],
    ...overrides,
  };
}

function createService(invoice: Record<string, unknown> | null) {
  const tx = {
    invoice: {
      findUnique: jest.fn().mockResolvedValue(invoice),
      update: jest.fn().mockResolvedValue(invoice),
    },
    labRequest: {
      delete: jest.fn().mockResolvedValue({}),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    labOrder: { delete: jest.fn() },
    radiologyOrderItem: { delete: jest.fn() },
    radiologyOrder: { deleteMany: jest.fn() },
    medicationOrder: { delete: jest.fn() },
    medicationRequest: { delete: jest.fn() },
    dialysisSession: { delete: jest.fn() },
    surgeryRequest: { delete: jest.fn() },
    prescriptionRefillRequest: { update: jest.fn() },
    patientWallet: {
      findUnique: jest.fn().mockResolvedValue({ id: 'wallet-1' }),
      update: jest.fn().mockResolvedValue({}),
    },
    walletTransaction: { create: jest.fn().mockResolvedValue({}) },
    invoiceAuditLog: { create: jest.fn().mockResolvedValue({}) },
  };
  const prisma = {
    $transaction: jest.fn(async (fn: (client: typeof tx) => Promise<unknown>) =>
      fn(tx),
    ),
  };
  return {
    service: new InvoiceSoftDeleteService(prisma as never),
    tx,
  };
}

describe('InvoiceSoftDeleteService', () => {
  const actor = { sub: 'staff-1', staffRole: 'BILLING_HEAD' };

  it('rejects accounting staff', async () => {
    const { service } = createService(paidInvoice());
    await expect(
      service.softDeleteMany(['inv-1'], {
        sub: 'staff-2',
        staffRole: 'ACCOUNTING_STAFF',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('soft-deletes a paid invoice, removes the lab request, and credits the wallet', async () => {
    const { service, tx } = createService(paidInvoice());
    const result = await service.softDeleteMany(['inv-1'], actor);

    expect(result.deleted).toEqual([{ id: 'inv-1', invoiceID: 'INV-1' }]);
    expect(result.rejected).toEqual([]);
    expect(tx.labRequest.delete).toHaveBeenCalledWith({
      where: { id: 'lab-req-1' },
    });
    expect(tx.patientWallet.update).toHaveBeenCalledWith({
      where: { id: 'wallet-1' },
      data: { balance: { increment: new Prisma.Decimal(1500) } },
    });
    expect(tx.walletTransaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: WalletTransactionType.CREDIT,
        invoiceId: 'inv-1',
        createdById: 'staff-1',
      }),
    });
    expect(tx.invoice.update).toHaveBeenCalledWith({
      where: { id: 'inv-1' },
      data: expect.objectContaining({
        status: InvoiceStatus.DELETED,
        deletedById: 'staff-1',
      }),
    });
    expect(tx.invoiceAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: InvoiceAuditAction.INVOICE_DELETED,
      }),
    });
  });

  it('rejects an invoice whose drug was already dispensed', async () => {
    const { service, tx } = createService(
      paidInvoice({
        invoiceItems: [
          {
            id: 'item-1',
            dispensedAt: new Date(),
            labOrder: null,
            labRequest: null,
            radiologyOrderItem: null,
            medicationOrder: null,
            medicationRequest: null,
            dialysisSession: null,
            surgeryRequest: null,
            prescriptionRefillRequest: null,
          },
        ],
      }),
    );

    const result = await service.softDeleteMany(['inv-1'], actor);

    expect(result.deleted).toEqual([]);
    expect(result.rejected[0]?.reason).toMatch(/dispensed/i);
    expect(tx.invoice.update).not.toHaveBeenCalled();
  });

  it('skips an invoice that is already deleted', async () => {
    const { service } = createService(
      paidInvoice({ status: InvoiceStatus.DELETED }),
    );
    const result = await service.softDeleteMany(['inv-1'], actor);
    expect(result.skipped).toEqual([
      { id: 'inv-1', reason: 'Invoice is already deleted.' },
    ]);
  });
});
