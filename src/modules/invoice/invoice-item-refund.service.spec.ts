import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import {
  InvoiceAuditAction,
  InvoiceItemRefundStatus,
  InvoicePaymentSource,
  InvoiceStatus,
  Prisma,
  WalletTransactionType,
} from '@prisma/client';
import { InvoiceItemRefundService } from './invoice-item-refund.service';

function baseItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 'item-1',
    invoiceId: 'inv-1',
    settled: false,
    isRecurringDaily: false,
    consultationVisitsConsumed: 0,
    dispensedAt: null,
    consumableId: null,
    purchaseItemId: null,
    drugId: null,
    unitPrice: new Prisma.Decimal(1000),
    quantity: 1,
    amountPaid: new Prisma.Decimal(0),
    usageSegments: [],
    radiologyOrderItem: null,
    labOrder: null,
    labRequest: null,
    dialysisSession: null,
    medicationOrder: null,
    refundRequests: [],
    invoice: { id: 'inv-1', staffId: 'staff-1', patientId: 'patient-1' },
    ...overrides,
  };
}

function createService(deps: {
  prisma?: any;
  invoiceService?: any;
  consumableStock?: any;
  purchaseItemStock?: any;
}) {
  return new InvoiceItemRefundService(
    deps.prisma ?? {},
    deps.invoiceService ?? { recalculateInvoiceTotals: jest.fn() },
    deps.consumableStock ?? {
      releaseFifoOutForInvoiceItem: jest.fn().mockResolvedValue(undefined),
    },
    deps.purchaseItemStock ?? {
      releaseFifoOutForInvoiceItem: jest.fn().mockResolvedValue(undefined),
    },
  );
}

describe('InvoiceItemRefundService', () => {
  afterEach(() => jest.clearAllMocks());

  describe('evaluateEligibility', () => {
    it('blocks settled service lines', () => {
      const service = createService({});
      const result = service.evaluateEligibility(
        baseItem({ settled: true }) as any,
      );
      expect(result.refundable).toBe(false);
      expect(result.blockReason).toMatch(/rendered/i);
    });

    it('blocks dispensed drug lines', () => {
      const service = createService({});
      const result = service.evaluateEligibility(
        baseItem({
          drugId: 'drug-1',
          dispensedAt: new Date(),
        }) as any,
      );
      expect(result.refundable).toBe(false);
      expect(result.blockReason).toMatch(/dispensed/i);
    });

    it('blocks when lab order exists', () => {
      const service = createService({});
      const result = service.evaluateEligibility(
        baseItem({ labOrder: { id: 'lab-order-1' } }) as any,
      );
      expect(result.refundable).toBe(false);
      expect(result.blockReason).toMatch(/lab order/i);
    });

    it('allows unrendered unpaid lines', () => {
      const service = createService({});
      const result = service.evaluateEligibility(baseItem() as any);
      expect(result.refundable).toBe(true);
      expect(result.blockReason).toBeNull();
    });
  });

  describe('submit', () => {
    it('creates a pending refund request', async () => {
      const item = baseItem();
      const prisma = {
        invoiceItem: {
          findFirst: jest.fn().mockResolvedValue(item),
        },
        invoiceItemRefundRequest: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({
            id: 'req-1',
            invoiceId: 'inv-1',
            invoiceItemId: 'item-1',
            lineTotal: new Prisma.Decimal(1000),
            reason: 'Patient changed mind',
            status: InvoiceItemRefundStatus.pending,
            submittedAt: new Date('2026-06-07T10:00:00.000Z'),
            requestedBy: {
              firstName: 'Jane',
              lastName: 'Doe',
              email: 'jane@example.com',
              staffId: 'S001',
            },
          }),
        },
      };
      const service = createService({ prisma });

      const result = await service.submit(
        'inv-1',
        'item-1',
        'Patient changed mind',
        'staff-1',
      );

      expect(result.id).toBe('req-1');
      expect(result.status).toBe(InvoiceItemRefundStatus.pending);
      expect(prisma.invoiceItemRefundRequest.create).toHaveBeenCalled();
    });

    it('rejects duplicate pending requests', async () => {
      const prisma = {
        invoiceItem: {
          findFirst: jest.fn().mockResolvedValue(baseItem()),
        },
        invoiceItemRefundRequest: {
          findFirst: jest.fn().mockResolvedValue({ id: 'existing' }),
        },
      };
      const service = createService({ prisma });

      await expect(
        service.submit('inv-1', 'item-1', 'reason', 'staff-1'),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('reject', () => {
    it('rejects pending request without deleting the line', async () => {
      const prisma = {
        invoiceItemRefundRequest: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'req-1',
            status: InvoiceItemRefundStatus.pending,
          }),
          update: jest.fn().mockResolvedValue({
            id: 'req-1',
            status: InvoiceItemRefundStatus.rejected,
          }),
        },
      };
      const service = createService({ prisma });

      const result = await service.reject(
        'req-1',
        'Not eligible',
        'head-1',
        'ACCOUNT_HEAD',
      );

      expect(result.status).toBe(InvoiceItemRefundStatus.rejected);
      expect(prisma.invoiceItemRefundRequest.update).toHaveBeenCalled();
    });

    it('requires account head role', async () => {
      const service = createService({});
      await expect(
        service.reject('req-1', 'reason', 'staff-1', 'ACCOUNTING_STAFF'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('approve', () => {
    it('removes unpaid line without creating InvoiceRefund', async () => {
      const item = baseItem();
      const request = {
        id: 'req-1',
        invoiceId: 'inv-1',
        invoiceItemId: 'item-1',
        reason: 'Duplicate charge',
        requestedById: 'staff-1',
        status: InvoiceItemRefundStatus.pending,
      };

      const tx = {
        invoiceItemRefundRequest: {
          findUnique: jest.fn().mockResolvedValue(request),
          update: jest.fn().mockResolvedValue({
            ...request,
            status: InvoiceItemRefundStatus.approved,
          }),
        },
        invoiceItem: {
          findFirst: jest.fn().mockResolvedValue(item),
          count: jest.fn().mockResolvedValue(0),
          delete: jest.fn().mockResolvedValue(item),
          update: jest.fn(),
        },
        invoice: {
          findUnique: jest
            .fn()
            .mockResolvedValueOnce({
              id: 'inv-1',
              patientId: 'patient-1',
              staffId: 'staff-1',
              amountPaid: new Prisma.Decimal(0),
            })
            .mockResolvedValueOnce({
              id: 'inv-1',
              amountPaid: new Prisma.Decimal(0),
            }),
          delete: jest.fn().mockResolvedValue({ id: 'inv-1' }),
          update: jest.fn(),
        },
        invoiceItemPayment: { findMany: jest.fn().mockResolvedValue([]) },
        invoiceCoverage: {
          findMany: jest.fn().mockResolvedValue([]),
          count: jest.fn().mockResolvedValue(0),
        },
        labRequest: { findFirst: jest.fn().mockResolvedValue(null) },
        radiologyOrderItem: { findFirst: jest.fn().mockResolvedValue(null) },
        medicationOrder: { findFirst: jest.fn().mockResolvedValue(null) },
        invoiceRefund: { create: jest.fn() },
        invoiceAuditLog: { create: jest.fn() },
      };

      const prisma = {
        $transaction: jest.fn((fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
      };
      const invoiceService = {
        recalculateInvoiceTotals: jest.fn(),
      };
      const service = createService({ prisma, invoiceService });

      const result = await service.approve('req-1', 'head-1', 'ACCOUNT_HEAD');

      expect(tx.invoiceItem.delete).toHaveBeenCalledWith({
        where: { id: 'item-1' },
      });
      expect(tx.invoiceRefund.create).not.toHaveBeenCalled();
      expect(tx.invoice.delete).toHaveBeenCalled();
      expect(result.invoiceDeleted).toBe(true);
      expect(tx.invoiceAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: InvoiceAuditAction.ITEM_REMOVED,
          }),
        }),
      );
    });

    it('reverses paid allocations and creates InvoiceRefund', async () => {
      const item = baseItem({
        amountPaid: new Prisma.Decimal(500),
      });
      const request = {
        id: 'req-1',
        invoiceId: 'inv-1',
        invoiceItemId: 'item-1',
        reason: 'Service not performed',
        requestedById: 'staff-1',
        status: InvoiceItemRefundStatus.pending,
      };

      const tx = {
        invoiceItemRefundRequest: {
          findUnique: jest.fn().mockResolvedValue(request),
          update: jest.fn().mockResolvedValue({
            ...request,
            status: InvoiceItemRefundStatus.approved,
            amount: new Prisma.Decimal(500),
          }),
        },
        invoiceItem: {
          findFirst: jest.fn().mockResolvedValue(item),
          count: jest.fn().mockResolvedValue(1),
          delete: jest.fn().mockResolvedValue(item),
          update: jest.fn(),
        },
        invoice: {
          findUnique: jest
            .fn()
            .mockResolvedValueOnce({
              id: 'inv-1',
              patientId: 'patient-1',
              staffId: 'staff-1',
              amountPaid: new Prisma.Decimal(500),
            })
            .mockResolvedValueOnce({
              id: 'inv-1',
              amountPaid: new Prisma.Decimal(0),
              status: InvoiceStatus.PARTIALLY_PAID,
            }),
          update: jest.fn(),
        },
        invoiceItemPayment: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: 'alloc-1',
              amount: new Prisma.Decimal(500),
              invoicePayment: {
                id: 'pay-1',
                source: InvoicePaymentSource.CASH,
                walletTransaction: null,
              },
            },
          ]),
          delete: jest.fn(),
        },
        invoiceCoverage: { findMany: jest.fn().mockResolvedValue([]) },
        labRequest: { findFirst: jest.fn().mockResolvedValue(null) },
        radiologyOrderItem: { findFirst: jest.fn().mockResolvedValue(null) },
        medicationOrder: { findFirst: jest.fn().mockResolvedValue(null) },
        invoiceRefund: {
          create: jest.fn().mockResolvedValue({
            id: 'refund-1',
            amount: new Prisma.Decimal(500),
          }),
        },
        invoiceAuditLog: { create: jest.fn() },
        patientWallet: {
          upsert: jest.fn(),
        },
        walletTransaction: { create: jest.fn() },
      };

      const prisma = {
        $transaction: jest.fn((fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
      };
      const invoiceService = {
        recalculateInvoiceTotals: jest.fn().mockResolvedValue({
          status: InvoiceStatus.PENDING,
        }),
      };
      const service = createService({ prisma, invoiceService });

      const result = await service.approve('req-1', 'head-1', 'ACCOUNT_HEAD');

      expect(tx.invoiceRefund.create).toHaveBeenCalled();
      expect(result.refundedAmount).toBe(500);
      expect(invoiceService.recalculateInvoiceTotals).toHaveBeenCalled();
      expect(tx.invoiceAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: InvoiceAuditAction.REFUND_ISSUED,
          }),
        }),
      );
    });

    it('credits wallet for wallet-sourced allocations', async () => {
      const item = baseItem({
        amountPaid: new Prisma.Decimal(300),
      });
      const request = {
        id: 'req-1',
        invoiceId: 'inv-1',
        invoiceItemId: 'item-1',
        reason: 'Cancelled',
        requestedById: 'staff-1',
        status: InvoiceItemRefundStatus.pending,
      };

      const tx = {
        invoiceItemRefundRequest: {
          findUnique: jest.fn().mockResolvedValue(request),
          update: jest.fn().mockResolvedValue({
            ...request,
            status: InvoiceItemRefundStatus.approved,
          }),
        },
        invoiceItem: {
          findFirst: jest.fn().mockResolvedValue(item),
          count: jest.fn().mockResolvedValue(1),
          delete: jest.fn(),
          update: jest.fn(),
        },
        invoice: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'inv-1',
            patientId: 'patient-1',
            staffId: 'staff-1',
            amountPaid: new Prisma.Decimal(300),
          }),
          update: jest.fn(),
        },
        invoiceItemPayment: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: 'alloc-1',
              amount: new Prisma.Decimal(300),
              invoicePayment: {
                id: 'pay-1',
                source: InvoicePaymentSource.WALLET,
                walletTransaction: { id: 'wt-1' },
              },
            },
          ]),
          delete: jest.fn(),
        },
        invoiceCoverage: { findMany: jest.fn().mockResolvedValue([]) },
        labRequest: { findFirst: jest.fn().mockResolvedValue(null) },
        radiologyOrderItem: { findFirst: jest.fn().mockResolvedValue(null) },
        medicationOrder: { findFirst: jest.fn().mockResolvedValue(null) },
        invoiceRefund: {
          create: jest.fn().mockResolvedValue({ id: 'refund-1' }),
        },
        invoiceAuditLog: { create: jest.fn() },
        patientWallet: {
          upsert: jest.fn().mockResolvedValue({ id: 'wallet-1' }),
          update: jest.fn(),
        },
        walletTransaction: {
          create: jest.fn().mockResolvedValue({ id: 'credit-1' }),
        },
      };

      const prisma = {
        $transaction: jest.fn((fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
      };
      const service = createService({
        prisma,
        invoiceService: {
          recalculateInvoiceTotals: jest.fn(),
        },
      });

      await service.approve('req-1', 'head-1', 'ACCOUNT_HEAD');

      expect(tx.patientWallet.update).toHaveBeenCalled();
      expect(tx.walletTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: WalletTransactionType.CREDIT,
            amount: new Prisma.Decimal(300),
          }),
        }),
      );
    });

    it('blocks approval when line is no longer eligible', async () => {
      const request = {
        id: 'req-1',
        invoiceId: 'inv-1',
        invoiceItemId: 'item-1',
        reason: 'Too late',
        requestedById: 'staff-1',
        status: InvoiceItemRefundStatus.pending,
      };
      const tx = {
        invoiceItemRefundRequest: {
          findUnique: jest.fn().mockResolvedValue(request),
        },
        invoiceItem: {
          findFirst: jest.fn().mockResolvedValue(
            baseItem({ settled: true }),
          ),
        },
      };
      const prisma = {
        $transaction: jest.fn((fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
      };
      const service = createService({ prisma });

      await expect(
        service.approve('req-1', 'head-1', 'ACCOUNT_HEAD'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('cancel', () => {
    it('allows requester to cancel pending request', async () => {
      const prisma = {
        invoiceItemRefundRequest: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'req-1',
            requestedById: 'staff-1',
            status: InvoiceItemRefundStatus.pending,
          }),
          update: jest.fn().mockResolvedValue({
            status: InvoiceItemRefundStatus.cancelled,
          }),
        },
      };
      const service = createService({ prisma });

      const result = await service.cancel(
        'inv-1',
        'item-1',
        'req-1',
        'staff-1',
      );

      expect(result.status).toBe(InvoiceItemRefundStatus.cancelled);
    });
  });
});
