import { BadRequestException } from '@nestjs/common';
import {
  InvoicePaymentMethod,
  InvoicePaymentSource,
  InvoiceStatus,
  Prisma,
  WalletTransactionType,
} from '@prisma/client';
import { InvoiceService } from './invoice.service';

function createInvoiceService(prisma: any) {
  return new InvoiceService(prisma);
}

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

  it('recurring: closed segments use ceil; open segment uses floor (no instant day on resume)', async () => {
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

    const service = createInvoiceService(prisma);
    const updated = await service.recalculateInvoiceTotals('inv-1');

    // Closed 12h → ceil 1; open 12h → floor 0 until a full 24h elapses
    expect(updated.totalAmount.toString()).toBe('100');
    expect(updated.status).toBe(InvoiceStatus.PENDING);
  });

  it('recurring open segment counts a day after 24h elapsed', async () => {
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
                  startAt: new Date('2026-03-26T12:00:00.000Z'),
                  endAt: null,
                },
              ],
            },
          ],
        }),
        update: jest.fn().mockImplementation(({ data }) => ({ ...data })),
      },
    };

    const service = createInvoiceService(prisma);
    const updated = await service.recalculateInvoiceTotals(
      'inv-1',
      prisma,
      new Date('2026-03-27T13:00:00.000Z'),
    );

    expect(updated.totalAmount.toString()).toBe('100');
  });

  it('records wallet payment atomically', async () => {
    const lineItem = {
      unitPrice: new Prisma.Decimal(500),
      quantity: 1,
      isRecurringDaily: false,
      usageSegments: [],
    };
    const tx: any = {
      invoice: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'inv-1',
          patientId: 'pat-1',
          totalAmount: new Prisma.Decimal(500),
          amountPaid: new Prisma.Decimal(100),
          invoiceItems: [lineItem],
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
      invoiceAuditLog: {
        create: jest.fn().mockResolvedValue({}),
      },
      bank: { findUnique: jest.fn() },
      transaction: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    const prisma: any = {
      invoice: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'inv-1',
          amountPaid: new Prisma.Decimal(100),
          invoiceItems: [lineItem],
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      bank: { findUnique: jest.fn() },
      $transaction: jest.fn().mockImplementation(async (cb) => cb(tx)),
    };

    const service = createInvoiceService(prisma);
    await service.recordPayment(
      'inv-1',
      {
        amount: 200,
        source: InvoicePaymentSource.WALLET,
        reference: 'invoice_payment',
      },
      'staff-1',
    );

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
    const lineItem = {
      unitPrice: new Prisma.Decimal(500),
      quantity: 1,
      isRecurringDaily: false,
      usageSegments: [],
    };
    const tx: any = {
      invoice: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'inv-1',
          patientId: 'pat-1',
          totalAmount: new Prisma.Decimal(500),
          amountPaid: new Prisma.Decimal(100),
          invoiceItems: [lineItem],
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      patientWallet: {
        upsert: jest.fn().mockResolvedValue({
          id: 'wal-1',
          patientId: 'pat-1',
          balance: new Prisma.Decimal(50),
        }),
      },
      bank: { findUnique: jest.fn() },
      transaction: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    const prisma: any = {
      invoice: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'inv-1',
          amountPaid: new Prisma.Decimal(100),
          invoiceItems: [lineItem],
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      bank: { findUnique: jest.fn() },
      $transaction: jest.fn().mockImplementation(async (cb) => cb(tx)),
    };

    const service = createInvoiceService(prisma);
    await expect(
      service.recordPayment(
        'inv-1',
        {
          amount: 200,
          source: InvoicePaymentSource.WALLET,
        },
        'staff-1',
      ),
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
      invoicePayment: {
        create: jest.fn().mockResolvedValue({
          id: 'ip-1',
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
      invoiceAuditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma: any = {
      staff: { findUnique: jest.fn().mockResolvedValue({ id: 'st-1' }) },
      bank: { findUnique: jest.fn().mockResolvedValue(null) },
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
    const service = createInvoiceService(prisma);
    const result = await service.allocatePaymentToInvoiceItems('inv-1', {
      staffId: 'st-1',
      amount: 200,
      method: InvoicePaymentMethod.CASH,
      allocations: [{ invoiceItemId: 'line-1', amount: 200 }],
    });
    expect(tx.invoicePayment.create).toHaveBeenCalled();
    expect(tx.invoiceItemPayment.create).toHaveBeenCalledTimes(1);
    expect(tx.invoiceItemPayment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          invoicePaymentId: 'ip-1',
        }),
      }),
    );
    expect(tx.invoiceItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'line-1' },
        data: { amountPaid: { increment: new Prisma.Decimal(200) } },
      }),
    );
    expect(result.allocations).toHaveLength(1);
  });

  it('rejects allocation when sum of lines does not equal payment amount', async () => {
    const { tx, prisma } = makeAllocateTxMocks([
      baseItem(),
      baseItem({ id: 'line-2' }),
    ]);
    const service = createInvoiceService(prisma);
    await expect(
      service.allocatePaymentToInvoiceItems('inv-1', {
        staffId: 'st-1',
        amount: 100,
        method: InvoicePaymentMethod.CASH,
        allocations: [
          { invoiceItemId: 'line-1', amount: 80 },
          { invoiceItemId: 'line-2', amount: 50 },
        ],
      }),
    ).rejects.toThrow(BadRequestException);
    expect(tx.invoicePayment.create).not.toHaveBeenCalled();
  });

  it('rejects allocation that would overpay a line', async () => {
    const { tx, prisma } = makeAllocateTxMocks([
      baseItem({ amountPaid: new Prisma.Decimal(200) }),
    ]);
    const service = createInvoiceService(prisma);
    await expect(
      service.allocatePaymentToInvoiceItems('inv-1', {
        staffId: 'st-1',
        amount: 350,
        method: InvoicePaymentMethod.CASH,
        allocations: [{ invoiceItemId: 'line-1', amount: 350 }],
      }),
    ).rejects.toThrow(BadRequestException);
    expect(tx.invoicePayment.create).not.toHaveBeenCalled();
  });

  it('rejects unknown invoice item before recording payment', async () => {
    const { tx, prisma } = makeAllocateTxMocks([baseItem()]);
    const service = createInvoiceService(prisma);
    await expect(
      service.allocatePaymentToInvoiceItems('inv-1', {
        staffId: 'st-1',
        amount: 50,
        method: InvoicePaymentMethod.CASH,
        allocations: [{ invoiceItemId: 'wrong-line', amount: 50 }],
      }),
    ).rejects.toThrow(BadRequestException);
    expect(tx.invoicePayment.create).not.toHaveBeenCalled();
  });

  it('create reuses an open invoice instead of inserting a second one', async () => {
    const prisma: any = {
      invoice: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'inv-open',
          patientId: 'pat-1',
          status: InvoiceStatus.PENDING,
        }),
        update: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn().mockResolvedValue({
          id: 'inv-open',
          amountPaid: new Prisma.Decimal(0),
          invoiceItems: [],
        }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: 'inv-open',
          patient: {},
          createdBy: {},
          invoiceItems: [],
        }),
        create: jest.fn(),
      },
    };
    const service = createInvoiceService(prisma);
    await service.create(
      { patientId: 'pat-1', staffId: 'st-1' },
      { user: { sub: 'staff-actor' } },
    );
    expect(prisma.invoice.create).not.toHaveBeenCalled();
    expect(prisma.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'inv-open' },
        data: expect.objectContaining({
          staffId: 'st-1',
          updatedById: 'staff-actor',
        }),
      }),
    );
  });

  it('settleInvoiceItemIfPresent is a no-op when id is missing', async () => {
    const tx: any = {
      invoiceItem: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
    };
    const service = createInvoiceService({} as any);
    await service.settleInvoiceItemIfPresent(tx, undefined);
    expect(tx.invoiceItem.updateMany).not.toHaveBeenCalled();
  });

  it('settleInvoiceItemIfPresent updates only unsettled invoice item', async () => {
    const tx: any = {
      invoiceItem: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };
    const service = createInvoiceService({} as any);
    await service.settleInvoiceItemIfPresent(tx, 'item-1');
    expect(tx.invoiceItem.updateMany).toHaveBeenCalledWith({
      where: { id: 'item-1', settled: false },
      data: { settled: true },
    });
  });

  it('findFirstConsumableConsultationItem returns null when no payable consultation item exists', async () => {
    const tx: any = {
      invoice: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const service = createInvoiceService({} as any);
    const result = await service.findFirstConsumableConsultationItem(tx, 'pat-1');
    expect(result).toBeNull();
  });
});
