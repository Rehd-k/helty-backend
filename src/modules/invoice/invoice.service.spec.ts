import { BadRequestException } from '@nestjs/common';
import {
  InvoicePaymentSource,
  InvoiceStatus,
  Prisma,
  TransactionPaymentMethod,
  TransactionStatus,
  WalletTransactionType,
} from '@prisma/client';
import { InvoiceService } from './invoice.service';

describe('InvoiceService', () => {
  const now = new Date('2026-03-27T12:00:00.000Z');
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(now);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('recalculates recurring totals with ceil day rule', async () => {
    const prisma: any = {
      invoice: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'inv-1',
          amountPaid: new Prisma.Decimal(0),
          invoiceItems: [
            {
              unitPrice: new Prisma.Decimal(100),
              quantity: 1,
              isRecurringDaily: true,
              usageSegments: [
                {
                  startAt: new Date('2026-03-26T08:00:00.000Z'),
                  endAt: new Date('2026-03-26T20:00:00.000Z'),
                },
                {
                  startAt: new Date('2026-03-27T00:00:00.000Z'),
                  endAt: null,
                },
              ],
            },
          ],
        }),
        update: jest.fn().mockImplementation(({ data }) => ({ ...data })),
      },
    };

    const service = new InvoiceService(prisma);
    const updated = await service.recalculateInvoiceTotals('inv-1');

    expect(updated.totalAmount.toString()).toBe('200');
    expect(updated.status).toBe(InvoiceStatus.PENDING);
  });

  it('records wallet payment atomically', async () => {
    const tx: any = {
      invoice: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'inv-1',
          patientId: 'pat-1',
          totalAmount: new Prisma.Decimal(500),
          amountPaid: new Prisma.Decimal(100),
          invoiceItems: [],
        }),
        update: jest
          .fn()
          .mockResolvedValueOnce({})
          .mockResolvedValueOnce({
            id: 'inv-1',
            totalAmount: new Prisma.Decimal(500),
            amountPaid: new Prisma.Decimal(300),
            status: InvoiceStatus.PARTIALLY_PAID,
          }),
      },
      patientWallet: {
        upsert: jest.fn().mockResolvedValue({
          id: 'wal-1',
          patientId: 'pat-1',
          balance: new Prisma.Decimal(1000),
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      walletTransaction: {
        create: jest.fn().mockResolvedValue({ id: 'wtx-1' }),
      },
      invoicePayment: {
        create: jest.fn().mockResolvedValue({ id: 'pay-1' }),
      },
    };

    const prisma: any = {
      invoice: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'inv-1',
          amountPaid: new Prisma.Decimal(100),
          invoiceItems: [],
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      $transaction: jest.fn().mockImplementation(async (cb) => cb(tx)),
    };

    const service = new InvoiceService(prisma);
    await service.recordPayment('inv-1', {
      amount: 200,
      source: InvoicePaymentSource.WALLET,
      reference: 'invoice_payment',
    });

    expect(tx.walletTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: WalletTransactionType.DEBIT,
        }),
      }),
    );
    expect(tx.invoicePayment.create).toHaveBeenCalled();
  });

  it('rejects wallet payment when balance is insufficient', async () => {
    const tx: any = {
      invoice: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'inv-1',
          patientId: 'pat-1',
          totalAmount: new Prisma.Decimal(500),
          amountPaid: new Prisma.Decimal(100),
          invoiceItems: [],
        }),
      },
      patientWallet: {
        upsert: jest.fn().mockResolvedValue({
          id: 'wal-1',
          patientId: 'pat-1',
          balance: new Prisma.Decimal(50),
        }),
      },
    };

    const prisma: any = {
      invoice: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'inv-1',
          amountPaid: new Prisma.Decimal(100),
          invoiceItems: [],
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      $transaction: jest.fn().mockImplementation(async (cb) => cb(tx)),
    };

    const service = new InvoiceService(prisma);
    await expect(
      service.recordPayment('inv-1', {
        amount: 200,
        source: InvoicePaymentSource.WALLET,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  const baseItem = (over: Partial<Record<string, unknown>> = {}) => ({
    id: 'line-1',
    quantity: 1,
    unitPrice: new Prisma.Decimal(500),
    isRecurringDaily: false,
    usageSegments: [],
    amountPaid: new Prisma.Decimal(0),
    ...over,
  });

  const makeAllocateTxMocks = (invoiceItems: ReturnType<typeof baseItem>[]) => {
    const innerInvoice = {
      id: 'inv-1',
      patientId: 'pat-1',
      totalAmount: new Prisma.Decimal(500),
      amountPaid: new Prisma.Decimal(0),
      invoiceItems,
    };
    const tx: any = {
      invoice: {
        findUnique: jest.fn().mockResolvedValue(innerInvoice),
        update: jest.fn().mockResolvedValue({
          ...innerInvoice,
          status: InvoiceStatus.PARTIALLY_PAID,
        }),
      },
      transaction: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: 'bt-1',
          patientId: 'pat-1',
          invoiceId: 'inv-1',
          totalAmount: new Prisma.Decimal(500),
          amountPaid: new Prisma.Decimal(0),
          discountAmount: new Prisma.Decimal(0),
          insuranceCovered: new Prisma.Decimal(0),
          status: TransactionStatus.ACTIVE,
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      transactionPayment: {
        create: jest.fn().mockResolvedValue({
          id: 'tp-1',
          receivedBy: {},
          bank: null,
        }),
      },
      invoiceItemPayment: {
        create: jest.fn().mockResolvedValue({ id: 'iip-1' }),
      },
      invoiceItem: {
        update: jest.fn().mockResolvedValue({}),
      },
      transactionAuditLog: {
        create: jest.fn().mockResolvedValue({}),
      },
    };
    const prisma: any = {
      staff: { findUnique: jest.fn().mockResolvedValue({ id: 'st-1' }) },
      invoice: {
        findUnique: jest.fn().mockResolvedValue(innerInvoice),
        update: jest.fn().mockResolvedValue({}),
      },
      $transaction: jest.fn().mockImplementation(async (cb) => cb(tx)),
    };
    return { tx, prisma, innerInvoice };
  };

  it('allocates partial payment to one invoice line atomically', async () => {
    const { tx, prisma } = makeAllocateTxMocks([baseItem()]);
    const service = new InvoiceService(prisma);
    const result = await service.allocatePaymentToInvoiceItems('inv-1', {
      staffId: 'st-1',
      amount: 200,
      method: TransactionPaymentMethod.CASH,
      allocations: [{ invoiceItemId: 'line-1', amount: 200 }],
    });
    expect(tx.transactionPayment.create).toHaveBeenCalled();
    expect(tx.invoiceItemPayment.create).toHaveBeenCalledTimes(1);
    expect(tx.invoiceItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'line-1' },
        data: { amountPaid: { increment: new Prisma.Decimal(200) } },
      }),
    );
    expect(result.allocations).toHaveLength(1);
  });

  it('rejects allocation when sum of lines does not equal payment amount', async () => {
    const { tx, prisma } = makeAllocateTxMocks([baseItem(), baseItem({ id: 'line-2' })]);
    const service = new InvoiceService(prisma);
    await expect(
      service.allocatePaymentToInvoiceItems('inv-1', {
        staffId: 'st-1',
        amount: 100,
        method: TransactionPaymentMethod.CASH,
        allocations: [
          { invoiceItemId: 'line-1', amount: 80 },
          { invoiceItemId: 'line-2', amount: 50 },
        ],
      }),
    ).rejects.toThrow(BadRequestException);
    expect(tx.transactionPayment.create).not.toHaveBeenCalled();
  });

  it('rejects allocation that would overpay a line', async () => {
    const { tx, prisma } = makeAllocateTxMocks([
      baseItem({ amountPaid: new Prisma.Decimal(200) }),
    ]);
    const service = new InvoiceService(prisma);
    await expect(
      service.allocatePaymentToInvoiceItems('inv-1', {
        staffId: 'st-1',
        amount: 350,
        method: TransactionPaymentMethod.CASH,
        allocations: [{ invoiceItemId: 'line-1', amount: 350 }],
      }),
    ).rejects.toThrow(BadRequestException);
    expect(tx.transactionPayment.create).not.toHaveBeenCalled();
  });

  it('rejects unknown invoice item before recording payment', async () => {
    const { tx, prisma } = makeAllocateTxMocks([baseItem()]);
    const service = new InvoiceService(prisma);
    await expect(
      service.allocatePaymentToInvoiceItems('inv-1', {
        staffId: 'st-1',
        amount: 50,
        method: TransactionPaymentMethod.CASH,
        allocations: [{ invoiceItemId: 'wrong-line', amount: 50 }],
      }),
    ).rejects.toThrow(BadRequestException);
    expect(tx.transactionPayment.create).not.toHaveBeenCalled();
  });
});
