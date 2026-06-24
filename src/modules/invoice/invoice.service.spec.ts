import { BadRequestException } from '@nestjs/common';
import {
  InvoiceAuditAction,
  InvoicePaymentMethod,
  InvoicePaymentSource,
  InvoiceStatus,
  PatientStatus,
  Prisma,
  WalletTransactionType,
} from '@prisma/client';
import { InvoiceService } from './invoice.service';
import {
  CONSULTATION_CREDIT_MAX_VISITS,
  RADIOLOGY_BILLING_CATEGORY,
} from './invoice-link.constants';

jest.mock('nanoid', () => ({
  customAlphabet: () => () => 'TESTID0001',
}));

function createConsumableStockMock() {
  return {
    assertStoreLocation: jest.fn().mockResolvedValue(undefined),
    assertEnoughStock: jest.fn().mockResolvedValue(undefined),
    applyFifoOut: jest.fn().mockResolvedValue(undefined),
    releaseFifoOutForInvoiceItem: jest.fn().mockResolvedValue(undefined),
    releaseOutQuantityForInvoiceItem: jest.fn().mockResolvedValue(undefined),
  } as any;
}

function createInvoiceService(prisma: any) {
  return new InvoiceService(
    prisma,
    createConsumableStockMock(),
    {} as any,
    {} as any,
  );
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
          .mockResolvedValueOnce({
            id: 'inv-1',
            totalAmount: new Prisma.Decimal(500),
            amountPaid: new Prisma.Decimal(100),
            status: InvoiceStatus.PARTIALLY_PAID,
          })
          .mockResolvedValueOnce({ id: 'inv-1' })
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
        update: jest.fn().mockResolvedValue({
          id: 'inv-1',
          status: InvoiceStatus.PARTIALLY_PAID,
          totalAmount: new Prisma.Decimal(500),
        }),
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
    const result = await service.findFirstConsumableConsultationItem(
      tx,
      'pat-1',
    );
    expect(result).toBeNull();
  });

  describe('consultation credit reuse', () => {
    const futureExpiry = new Date('2026-04-15T12:00:00.000Z');
    const pastExpiry = new Date('2026-03-01T12:00:00.000Z');

    it('isConsultationCreditConsumable allows credit with visits remaining and valid expiry', () => {
      const service = createInvoiceService({} as any);
      expect(
        service.isConsultationCreditConsumable(
          {
            settled: false,
            consultationVisitsConsumed: 1,
            consultationCreditExpiresAt: futureExpiry,
          },
          now,
        ),
      ).toBe(true);
    });

    it('isConsultationCreditConsumable rejects expired, exhausted, or missing expiry', () => {
      const service = createInvoiceService({} as any);
      const base = {
        settled: false,
        consultationVisitsConsumed: 0,
        consultationCreditExpiresAt: futureExpiry,
      };
      expect(
        service.isConsultationCreditConsumable(
          { ...base, consultationCreditExpiresAt: pastExpiry },
          now,
        ),
      ).toBe(false);
      expect(
        service.isConsultationCreditConsumable(
          {
            ...base,
            consultationVisitsConsumed: CONSULTATION_CREDIT_MAX_VISITS,
          },
          now,
        ),
      ).toBe(false);
      expect(
        service.isConsultationCreditConsumable(
          { ...base, consultationCreditExpiresAt: null },
          now,
        ),
      ).toBe(false);
      expect(
        service.isConsultationCreditConsumable({ ...base, settled: true }, now),
      ).toBe(false);
    });

    it('settleConsultationItemsForEncounter increments visit and releases invoice after first visit', async () => {
      const tx: any = {
        invoiceItem: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: 'item-1',
              invoiceId: 'inv-1',
              consultationVisitsConsumed: 0,
            },
          ]),
          update: jest.fn().mockResolvedValue({}),
        },
        invoice: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      };
      const service = createInvoiceService({} as any);
      await service.settleConsultationItemsForEncounter(tx, 'enc-1');
      expect(tx.invoiceItem.update).toHaveBeenCalledWith({
        where: { id: 'item-1' },
        data: { consultationVisitsConsumed: 1, settled: false },
      });
      expect(tx.invoice.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['inv-1'] } },
        data: { encounterId: null },
      });
    });

    it('settleConsultationItemsForEncounter exhausts credit on second visit', async () => {
      const tx: any = {
        invoiceItem: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: 'item-1',
              invoiceId: 'inv-1',
              consultationVisitsConsumed: 1,
            },
          ]),
          update: jest.fn().mockResolvedValue({}),
        },
        invoice: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      };
      const service = createInvoiceService({} as any);
      await service.settleConsultationItemsForEncounter(tx, 'enc-1');
      expect(tx.invoiceItem.update).toHaveBeenCalledWith({
        where: { id: 'item-1' },
        data: {
          consultationVisitsConsumed: CONSULTATION_CREDIT_MAX_VISITS,
          settled: true,
        },
      });
      expect(tx.invoice.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('findPaidWithoutEncounter', () => {
    it('includes reusable consultation credit outside the date range', async () => {
      const findMany = jest.fn().mockResolvedValue([]);
      const count = jest.fn().mockResolvedValue(0);
      const prisma: any = { invoice: { findMany, count } };
      const service = createInvoiceService(prisma);

      await service.findPaidWithoutEncounter({
        fromDate: '2026-03-27',
        toDate: '2026-03-27',
      });

      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: InvoiceStatus.PAID,
            encounterId: null,
            patient: { status: PatientStatus.OUTPATIENT },
            OR: expect.arrayContaining([
              expect.objectContaining({
                invoiceItems: {
                  some: expect.objectContaining({
                    settled: false,
                    consultationVisitsConsumed: { lt: CONSULTATION_CREDIT_MAX_VISITS },
                    consultationCreditExpiresAt: { gt: now },
                  }),
                },
              }),
            ]),
          }),
        }),
      );
    });

    it('returns consumable consultation credits for a patient when patientId is set', async () => {
      const findMany = jest.fn().mockResolvedValue([]);
      const count = jest.fn().mockResolvedValue(0);
      const prisma: any = {
        patient: {
          findFirst: jest.fn().mockResolvedValue({ id: 'pat-1' }),
        },
        invoice: { findMany, count },
      };
      const service = createInvoiceService(prisma);

      await service.findPaidWithoutEncounter({
        patientId: 'pat-1',
        allowIP: true,
        fromDate: '2026-03-27',
        toDate: '2026-03-27',
      });

      expect(prisma.patient.findFirst).toHaveBeenCalledWith({
        where: { OR: [{ id: 'pat-1' }, { patientId: 'pat-1' }] },
        select: { id: true },
      });
      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            patientId: 'pat-1',
            status: InvoiceStatus.PAID,
            encounterId: null,
            patient: { status: PatientStatus.ADMITED },
            invoiceItems: {
              some: expect.objectContaining({
                settled: false,
                consultationVisitsConsumed: {
                  lt: CONSULTATION_CREDIT_MAX_VISITS,
                },
                consultationCreditExpiresAt: { gt: now },
              }),
            },
          },
          orderBy: [{ updatedAt: 'asc' }],
        }),
      );
      expect(findMany.mock.calls[0][0].where.OR).toBeUndefined();
    });

    it('resolves hospital chart number to patient UUID when patientId is set', async () => {
      const findMany = jest.fn().mockResolvedValue([{ id: 'inv-1' }]);
      const count = jest.fn().mockResolvedValue(1);
      const prisma: any = {
        patient: {
          findFirst: jest
            .fn()
            .mockResolvedValue({ id: 'dc08bc32-24ed-42a0-b4a7-6062ec40e2b3' }),
        },
        invoice: { findMany, count },
      };
      const service = createInvoiceService(prisma);

      const result = await service.findPaidWithoutEncounter({
        patientId: 'BVNLI0T7',
      });

      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            patientId: 'dc08bc32-24ed-42a0-b4a7-6062ec40e2b3',
          }),
        }),
      );
      expect(result.total).toBe(1);
    });

    it('returns empty when patientId does not resolve to a patient', async () => {
      const findMany = jest.fn();
      const count = jest.fn();
      const prisma: any = {
        patient: { findFirst: jest.fn().mockResolvedValue(null) },
        invoice: { findMany, count },
      };
      const service = createInvoiceService(prisma);

      const result = await service.findPaidWithoutEncounter({
        patientId: 'UNKNOWN99',
      });

      expect(result).toEqual({ invoices: [], total: 0, skip: 0, take: 20 });
      expect(findMany).not.toHaveBeenCalled();
      expect(count).not.toHaveBeenCalled();
    });
  });

  const lineForRecalc = {
    unitPrice: new Prisma.Decimal(500),
    quantity: 1,
    isRecurringDaily: false,
    usageSegments: [] as { startAt: Date; endAt: Date | null }[],
  };

  it('voids a cash invoice payment without line allocations', async () => {
    const tx: any = {
      invoicePayment: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'pay-1',
          amount: new Prisma.Decimal(100),
          source: InvoicePaymentSource.CASH,
          invoiceId: 'inv-1',
          itemAllocations: [],
          invoice: {
            id: 'inv-1',
            amountPaid: new Prisma.Decimal(300),
            patientId: 'pat-1',
          },
          walletTransactionId: null,
          walletTransaction: null,
        }),
        delete: jest.fn().mockResolvedValue({}),
      },
      invoiceItem: { update: jest.fn().mockResolvedValue({}) },
      invoice: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'inv-1',
          amountPaid: new Prisma.Decimal(200),
          invoiceItems: [lineForRecalc],
        }),
        update: jest.fn().mockResolvedValue({
          id: 'inv-1',
          status: InvoiceStatus.PARTIALLY_PAID,
        }),
      },
      invoiceAuditLog: { create: jest.fn().mockResolvedValue({}) },
      patientWallet: { update: jest.fn() },
      walletTransaction: { delete: jest.fn() },
    };

    const prisma: any = {
      $transaction: jest.fn().mockImplementation(async (cb) => cb(tx)),
    };

    const service = createInvoiceService(prisma);
    await service.voidInvoicePayment('pay-1', 'staff-1', 'duplicate entry');

    expect(tx.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'inv-1' },
        data: { amountPaid: new Prisma.Decimal(200) },
      }),
    );
    expect(tx.invoicePayment.delete).toHaveBeenCalledWith({
      where: { id: 'pay-1' },
    });
    expect(tx.invoiceAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: InvoiceAuditAction.PAYMENT_VOIDED,
          invoiceId: 'inv-1',
        }),
      }),
    );
    expect(tx.patientWallet.update).not.toHaveBeenCalled();
    expect(tx.walletTransaction.delete).not.toHaveBeenCalled();
  });

  it('voids an invoice payment with line allocations (decrements items)', async () => {
    const tx: any = {
      invoicePayment: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'pay-2',
          amount: new Prisma.Decimal(80),
          source: InvoicePaymentSource.CASH,
          invoiceId: 'inv-1',
          itemAllocations: [
            {
              invoiceItemId: 'line-1',
              amount: new Prisma.Decimal(80),
            },
          ],
          invoice: {
            id: 'inv-1',
            amountPaid: new Prisma.Decimal(80),
            patientId: 'pat-1',
          },
          walletTransactionId: null,
          walletTransaction: null,
        }),
        delete: jest.fn().mockResolvedValue({}),
      },
      invoiceItem: { update: jest.fn().mockResolvedValue({}) },
      invoice: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'inv-1',
          amountPaid: new Prisma.Decimal(0),
          invoiceItems: [lineForRecalc],
        }),
        update: jest.fn().mockResolvedValue({
          id: 'inv-1',
          status: InvoiceStatus.PENDING,
        }),
      },
      invoiceAuditLog: { create: jest.fn().mockResolvedValue({}) },
      patientWallet: { update: jest.fn() },
      walletTransaction: { delete: jest.fn() },
    };

    const prisma: any = {
      $transaction: jest.fn().mockImplementation(async (cb) => cb(tx)),
    };

    const service = createInvoiceService(prisma);
    await service.voidInvoicePayment('pay-2');

    expect(tx.invoiceItem.update).toHaveBeenCalledWith({
      where: { id: 'line-1' },
      data: { amountPaid: { decrement: new Prisma.Decimal(80) } },
    });
    expect(tx.invoicePayment.delete).toHaveBeenCalled();
  });

  it('voids a wallet invoice payment (credits wallet and deletes debit txn)', async () => {
    const tx: any = {
      invoicePayment: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'pay-3',
          amount: new Prisma.Decimal(150),
          source: InvoicePaymentSource.WALLET,
          invoiceId: 'inv-1',
          itemAllocations: [],
          invoice: {
            id: 'inv-1',
            amountPaid: new Prisma.Decimal(150),
            patientId: 'pat-1',
          },
          walletTransactionId: 'wtx-1',
          walletTransaction: {
            id: 'wtx-1',
            walletId: 'wal-1',
            type: WalletTransactionType.DEBIT,
            amount: new Prisma.Decimal(150),
            wallet: { id: 'wal-1', balance: new Prisma.Decimal(100) },
          },
        }),
        delete: jest.fn().mockResolvedValue({}),
      },
      invoiceItem: { update: jest.fn().mockResolvedValue({}) },
      invoice: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'inv-1',
          amountPaid: new Prisma.Decimal(0),
          invoiceItems: [lineForRecalc],
        }),
        update: jest.fn().mockResolvedValue({
          id: 'inv-1',
          status: InvoiceStatus.PENDING,
        }),
      },
      invoiceAuditLog: { create: jest.fn().mockResolvedValue({}) },
      patientWallet: {
        update: jest.fn().mockResolvedValue({}),
      },
      walletTransaction: {
        delete: jest.fn().mockResolvedValue({}),
      },
    };

    const prisma: any = {
      $transaction: jest.fn().mockImplementation(async (cb) => cb(tx)),
    };

    const service = createInvoiceService(prisma);
    await service.voidInvoicePayment('pay-3', 'staff-1');

    expect(tx.patientWallet.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'wal-1' },
        data: { balance: { increment: new Prisma.Decimal(150) } },
      }),
    );
    expect(tx.walletTransaction.delete).toHaveBeenCalledWith({
      where: { id: 'wtx-1' },
    });
    expect(tx.invoicePayment.delete).toHaveBeenCalledWith({
      where: { id: 'pay-3' },
    });
  });

  it('rebuilds line payment allocations when recordPayment fully pays the invoice', async () => {
    const line1 = {
      id: 'l1',
      quantity: 1,
      unitPrice: new Prisma.Decimal(300),
      isRecurringDaily: false,
      usageSegments: [] as { startAt: Date; endAt: Date | null }[],
      amountPaid: new Prisma.Decimal(0),
    };
    const line2 = {
      id: 'l2',
      quantity: 1,
      unitPrice: new Prisma.Decimal(200),
      isRecurringDaily: false,
      usageSegments: [] as { startAt: Date; endAt: Date | null }[],
      amountPaid: new Prisma.Decimal(0),
    };
    const items = [line1, line2];
    const fullInv = (amountPaid: Prisma.Decimal) => ({
      id: 'inv-1',
      patientId: 'pat-1',
      amountPaid,
      totalAmount: new Prisma.Decimal(500),
      invoiceItems: items.map((i) => ({
        id: i.id,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        isRecurringDaily: i.isRecurringDaily,
        usageSegments: i.usageSegments,
      })),
    });

    let findIdx = 0;
    const tx: any = {
      invoice: {
        findUnique: jest.fn().mockImplementation(() => {
          findIdx += 1;
          if (findIdx === 1) return fullInv(new Prisma.Decimal(0));
          if (findIdx === 2) {
            return {
              id: 'inv-1',
              patientId: 'pat-1',
              totalAmount: new Prisma.Decimal(500),
              amountPaid: new Prisma.Decimal(0),
            };
          }
          if (findIdx === 3) return fullInv(new Prisma.Decimal(500));
          return null;
        }),
        update: jest
          .fn()
          .mockResolvedValueOnce({
            id: 'inv-1',
            status: InvoiceStatus.PENDING,
            totalAmount: new Prisma.Decimal(500),
          })
          .mockResolvedValueOnce({ id: 'inv-1' })
          .mockResolvedValueOnce({
            id: 'inv-1',
            status: InvoiceStatus.PAID,
            totalAmount: new Prisma.Decimal(500),
          }),
      },
      invoicePayment: {
        create: jest.fn().mockResolvedValue({ id: 'pay-final' }),
        findMany: jest
          .fn()
          .mockResolvedValue([
            { id: 'pay-final', amount: new Prisma.Decimal(500) },
          ]),
      },
      invoiceAuditLog: { create: jest.fn().mockResolvedValue({}) },
      bank: { findUnique: jest.fn() },
      invoiceItem: {
        findMany: jest.fn().mockResolvedValue(
          items.map((i) => ({
            ...i,
            usageSegments: [],
          })),
        ),
        updateMany: jest.fn().mockResolvedValue({ count: 2 }),
        update: jest.fn().mockResolvedValue({}),
      },
      invoiceItemPayment: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        create: jest.fn().mockResolvedValue({ id: 'alloc-1' }),
      },
    };

    const prisma: any = {
      invoice: {
        findUnique: jest.fn().mockResolvedValue(fullInv(new Prisma.Decimal(0))),
        update: jest.fn().mockResolvedValue({}),
      },
      bank: { findUnique: jest.fn() },
      $transaction: jest.fn().mockImplementation(async (cb) => cb(tx)),
    };

    const service = createInvoiceService(prisma);
    await service.recordPayment(
      'inv-1',
      {
        amount: 500,
        source: InvoicePaymentSource.CASH,
      },
      'staff-1',
    );

    expect(tx.invoiceItemPayment.deleteMany).toHaveBeenCalled();
    expect(tx.invoicePayment.findMany).toHaveBeenCalled();
    expect(tx.invoiceItemPayment.create).toHaveBeenCalled();
    expect(tx.invoiceItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'l1' },
        data: { amountPaid: new Prisma.Decimal(300) },
      }),
    );
    expect(tx.invoiceItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'l2' },
        data: { amountPaid: new Prisma.Decimal(200) },
      }),
    );
  });

  describe('assertPaidInvoiceItemConsumable', () => {
    const baseParams = {
      invoiceId: 'inv-1',
      invoiceItemId: 'item-1',
      serviceId: 'svc-1',
      patientId: 'pat-1',
      mode: 'lab' as const,
    };

    function labConsumableTx(overrides: {
      invoiceStatus?: InvoiceStatus;
      admissionCount?: number;
      categoryName?: string;
      labOrderExists?: boolean;
    }) {
      return {
        invoice: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'inv-1',
            patientId: 'pat-1',
            status: overrides.invoiceStatus ?? InvoiceStatus.PENDING,
          }),
        },
        admission: {
          count: jest
            .fn()
            .mockResolvedValue(overrides.admissionCount ?? 1),
        },
        invoiceItem: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'item-1',
            serviceId: 'svc-1',
            settled: false,
            service: {
              category: { name: overrides.categoryName ?? 'Laboratory' },
            },
          }),
        },
        labOrder: {
          findFirst: jest
            .fn()
            .mockResolvedValue(overrides.labOrderExists ? { id: 'ord-1' } : null),
        },
        radiologyOrderItem: { findFirst: jest.fn() },
        dialysisSession: { findFirst: jest.fn() },
      };
    }

    it('allows unpaid invoice when patient has active admission', async () => {
      const tx = labConsumableTx({
        invoiceStatus: InvoiceStatus.PENDING,
        admissionCount: 1,
      });
      const service = createInvoiceService({} as any);
      await expect(
        service.assertPaidInvoiceItemConsumable(tx as any, baseParams),
      ).resolves.toBeUndefined();
    });

    it('throws INVOICE_NOT_PAID when unpaid and no active admission', async () => {
      const tx = labConsumableTx({
        invoiceStatus: InvoiceStatus.PENDING,
        admissionCount: 0,
      });
      const service = createInvoiceService({} as any);
      await expect(
        service.assertPaidInvoiceItemConsumable(tx as any, baseParams),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'INVOICE_NOT_PAID' }),
      });
    });

    it('still validates category for inpatient credit', async () => {
      const tx = labConsumableTx({
        invoiceStatus: InvoiceStatus.PENDING,
        admissionCount: 1,
        categoryName: 'Consultations & Reviews',
      });
      const service = createInvoiceService({} as any);
      await expect(
        service.assertPaidInvoiceItemConsumable(tx as any, baseParams),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          code: 'INVOICE_ITEM_CATEGORY_MISMATCH',
        }),
      });
    });

    it('allows paid invoice without checking admission', async () => {
      const tx = labConsumableTx({
        invoiceStatus: InvoiceStatus.PAID,
        admissionCount: 0,
      });
      const service = createInvoiceService({} as any);
      await expect(
        service.assertPaidInvoiceItemConsumable(tx as any, baseParams),
      ).resolves.toBeUndefined();
      expect(tx.admission.count).not.toHaveBeenCalled();
    });

    it('validates radiology category on inpatient credit', async () => {
      const tx = {
        invoice: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'inv-1',
            patientId: 'pat-1',
            status: InvoiceStatus.PENDING,
          }),
        },
        admission: { count: jest.fn().mockResolvedValue(1) },
        invoiceItem: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'item-1',
            serviceId: 'svc-1',
            settled: false,
            service: { category: { name: RADIOLOGY_BILLING_CATEGORY } },
          }),
        },
        radiologyOrderItem: { findFirst: jest.fn().mockResolvedValue(null) },
        labOrder: { findFirst: jest.fn() },
        dialysisSession: { findFirst: jest.fn() },
      };
      const service = createInvoiceService({} as any);
      await expect(
        service.assertPaidInvoiceItemConsumable(tx as any, {
          ...baseParams,
          mode: 'radiology',
        }),
      ).resolves.toBeUndefined();
    });

    it('validates dialysis category and rejects duplicate session', async () => {
      const tx = {
        invoice: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'inv-1',
            patientId: 'pat-1',
            status: InvoiceStatus.PAID,
          }),
        },
        admission: { count: jest.fn() },
        invoiceItem: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'item-1',
            serviceId: 'svc-1',
            settled: false,
            service: { category: { name: 'Dialysis' } },
          }),
        },
        radiologyOrderItem: { findFirst: jest.fn() },
        labOrder: { findFirst: jest.fn() },
        dialysisSession: {
          findFirst: jest.fn().mockResolvedValue({ id: 'sess-1' }),
        },
      };
      const service = createInvoiceService({} as any);
      await expect(
        service.assertPaidInvoiceItemConsumable(tx as any, {
          ...baseParams,
          mode: 'dialysis',
        }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          code: 'INVOICE_ITEM_ALREADY_CONSUMED',
        }),
      });
    });

    it('allows dialysis category when no duplicate session exists', async () => {
      const tx = {
        invoice: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'inv-1',
            patientId: 'pat-1',
            status: InvoiceStatus.PAID,
          }),
        },
        admission: { count: jest.fn() },
        invoiceItem: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'item-1',
            serviceId: 'svc-1',
            settled: false,
            service: { category: { name: 'Dialysis Services' } },
          }),
        },
        radiologyOrderItem: { findFirst: jest.fn() },
        labOrder: { findFirst: jest.fn() },
        dialysisSession: { findFirst: jest.fn().mockResolvedValue(null) },
      };
      const service = createInvoiceService({} as any);
      await expect(
        service.assertPaidInvoiceItemConsumable(tx as any, {
          ...baseParams,
          mode: 'dialysis',
        }),
      ).resolves.toBeUndefined();
    });
  });

  describe('assertInpatientCreditAllowed', () => {
    it('throws when patient has no active admission', async () => {
      const tx = { admission: { count: jest.fn().mockResolvedValue(0) } };
      const service = createInvoiceService({} as any);
      await expect(
        service.assertInpatientCreditAllowed(tx as any, 'pat-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('passes when patient has active admission', async () => {
      const tx = { admission: { count: jest.fn().mockResolvedValue(1) } };
      const service = createInvoiceService({} as any);
      await expect(
        service.assertInpatientCreditAllowed(tx as any, 'pat-1'),
      ).resolves.toBeUndefined();
    });
  });

  describe('assertInvoiceItemPaidOrInpatientCredit', () => {
    function deliveryTx(overrides: {
      invoiceStatus?: InvoiceStatus;
      admissionCount?: number;
      patientId?: string;
      itemMissing?: boolean;
    }) {
      return {
        invoiceItem: {
          findUnique: jest.fn().mockResolvedValue(
            overrides.itemMissing
              ? null
              : {
                  id: 'item-1',
                  invoice: {
                    id: 'inv-1',
                    patientId: overrides.patientId ?? 'pat-1',
                    status:
                      overrides.invoiceStatus ?? InvoiceStatus.PENDING,
                  },
                },
          ),
        },
        admission: {
          count: jest
            .fn()
            .mockResolvedValue(overrides.admissionCount ?? 0),
        },
      };
    }

    it('allows paid invoice without checking admission', async () => {
      const tx = deliveryTx({
        invoiceStatus: InvoiceStatus.PAID,
        admissionCount: 0,
      });
      const service = createInvoiceService({} as any);
      await expect(
        service.assertInvoiceItemPaidOrInpatientCredit(tx as any, {
          invoiceItemId: 'item-1',
          patientId: 'pat-1',
        }),
      ).resolves.toBeUndefined();
      expect(tx.admission.count).not.toHaveBeenCalled();
    });

    it('allows unpaid invoice when patient has active admission', async () => {
      const tx = deliveryTx({
        invoiceStatus: InvoiceStatus.PENDING,
        admissionCount: 1,
      });
      const service = createInvoiceService({} as any);
      await expect(
        service.assertInvoiceItemPaidOrInpatientCredit(tx as any, {
          invoiceItemId: 'item-1',
          patientId: 'pat-1',
        }),
      ).resolves.toBeUndefined();
    });

    it('throws when unpaid and no active admission', async () => {
      const tx = deliveryTx({
        invoiceStatus: InvoiceStatus.PENDING,
        admissionCount: 0,
      });
      const service = createInvoiceService({} as any);
      await expect(
        service.assertInvoiceItemPaidOrInpatientCredit(tx as any, {
          invoiceItemId: 'item-1',
          patientId: 'pat-1',
        }),
      ).rejects.toThrow(
        'Payment is required before entering results for this patient.',
      );
    });

    it('throws when invoice item not found', async () => {
      const tx = deliveryTx({ itemMissing: true });
      const service = createInvoiceService({} as any);
      await expect(
        service.assertInvoiceItemPaidOrInpatientCredit(tx as any, {
          invoiceItemId: 'item-1',
          patientId: 'pat-1',
        }),
      ).rejects.toThrow('Invoice line item not found.');
    });

    it('throws when patient does not match invoice', async () => {
      const tx = deliveryTx({ patientId: 'other-pat' });
      const service = createInvoiceService({} as any);
      await expect(
        service.assertInvoiceItemPaidOrInpatientCredit(tx as any, {
          invoiceItemId: 'item-1',
          patientId: 'pat-1',
        }),
      ).rejects.toThrow(
        'This invoice does not belong to the selected patient.',
      );
    });
  });

  describe('assertPaidInvoiceItemConsumable requirePayment', () => {
    const baseParams = {
      invoiceId: 'inv-1',
      invoiceItemId: 'item-1',
      serviceId: 'svc-1',
      patientId: 'pat-1',
      mode: 'lab' as const,
    };

    it('allows unpaid outpatient when requirePayment is false', async () => {
      const tx = {
        invoice: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'inv-1',
            patientId: 'pat-1',
            status: InvoiceStatus.PENDING,
          }),
        },
        admission: { count: jest.fn() },
        invoiceItem: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'item-1',
            serviceId: 'svc-1',
            settled: false,
            service: { category: { name: 'Laboratory' } },
          }),
        },
        labOrder: { findFirst: jest.fn().mockResolvedValue(null) },
        radiologyOrderItem: { findFirst: jest.fn() },
        dialysisSession: { findFirst: jest.fn() },
      };
      const service = createInvoiceService({} as any);
      await expect(
        service.assertPaidInvoiceItemConsumable(
          tx as any,
          baseParams,
          { requirePayment: false },
        ),
      ).resolves.toBeUndefined();
      expect(tx.admission.count).not.toHaveBeenCalled();
    });
  });

  describe('resolveServiceUnitPrice', () => {
    it('uses HMO fullCost when patient is registered and price row exists', async () => {
      const prisma: any = {
        service: {
          findUnique: jest.fn().mockResolvedValue({ id: 'svc-1', cost: 5000 }),
        },
        patient: {
          findUnique: jest.fn().mockResolvedValue({ hmoId: 'hmo-1' }),
        },
        hmoServicePrice: {
          findUnique: jest.fn().mockResolvedValue({
            fullCost: new Prisma.Decimal(3500),
          }),
        },
      };
      const service = createInvoiceService(prisma);
      const result = await service.resolveServiceUnitPrice('pat-1', 'svc-1');
      expect(result.source).toBe('hmo');
      expect(result.unitPrice.toString()).toBe('3500');
    });

    it('falls back to standard Service.cost when patient has HMO but no price row', async () => {
      const prisma: any = {
        service: {
          findUnique: jest.fn().mockResolvedValue({ id: 'svc-1', cost: 5000 }),
        },
        patient: {
          findUnique: jest.fn().mockResolvedValue({ hmoId: 'hmo-1' }),
        },
        hmoServicePrice: {
          findUnique: jest.fn().mockResolvedValue(null),
        },
      };
      const service = createInvoiceService(prisma);
      const result = await service.resolveServiceUnitPrice('pat-1', 'svc-1');
      expect(result.source).toBe('standard');
      expect(result.unitPrice.toString()).toBe('5000');
    });

    it('uses standard Service.cost when patient has no hmoId', async () => {
      const prisma: any = {
        service: {
          findUnique: jest.fn().mockResolvedValue({ id: 'svc-1', cost: 5000 }),
        },
        patient: {
          findUnique: jest.fn().mockResolvedValue({ hmoId: null }),
        },
      };
      const service = createInvoiceService(prisma);
      const result = await service.resolveServiceUnitPrice('pat-1', 'svc-1');
      expect(result.source).toBe('standard');
      expect(result.unitPrice.toString()).toBe('5000');
    });
  });

  describe('addItem service price resolution', () => {
    it('auto-resolves unitPrice from patient HMO when omitted', async () => {
      const createdItem = {
        id: 'item-1',
        invoiceId: 'inv-1',
        serviceId: 'svc-1',
        quantity: 1,
        unitPrice: new Prisma.Decimal(3500),
        isRecurringDaily: false,
        service: { id: 'svc-1', name: 'Lab Test', description: null, cost: 5000 },
        invoice: { id: 'inv-1', status: InvoiceStatus.PENDING, patientId: 'pat-1' },
        createdBy: null,
      };
      const prisma: any = {
        invoice: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'inv-1',
            status: InvoiceStatus.PENDING,
            patientId: 'pat-1',
            createdById: 'staff-1',
            staffId: 'staff-1',
          }),
        },
        service: {
          findUnique: jest.fn().mockResolvedValue({ id: 'svc-1', cost: 5000 }),
        },
        patient: {
          findUnique: jest.fn().mockResolvedValue({ hmoId: 'hmo-1' }),
        },
        hmoServicePrice: {
          findUnique: jest.fn().mockResolvedValue({
            fullCost: new Prisma.Decimal(3500),
          }),
        },
        staff: {
          findUnique: jest.fn().mockResolvedValue({ id: 'staff-1' }),
        },
        invoiceItem: {
          create: jest.fn().mockResolvedValue(createdItem),
        },
      };
      prisma.invoice.update = jest.fn().mockResolvedValue({});
      const service = createInvoiceService({
        ...prisma,
        invoice: {
          ...prisma.invoice,
          update: jest.fn().mockImplementation(({ data }) => ({ ...data })),
        },
      });
      (service as any).recalculateInvoiceTotals = jest.fn().mockResolvedValue({});

      await service.addItem('inv-1', { serviceId: 'svc-1' }, 'staff-1');

      const createCall = prisma.invoiceItem.create.mock.calls[0][0];
      expect(createCall.data.unitPrice.toString()).toBe('3500');
    });

    it('honors explicit unitPrice override', async () => {
      const prisma: any = {
        invoice: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'inv-1',
            status: InvoiceStatus.PENDING,
            patientId: 'pat-1',
            createdById: 'staff-1',
            staffId: 'staff-1',
          }),
        },
        service: {
          findUnique: jest.fn().mockResolvedValue({ id: 'svc-1', cost: 5000 }),
        },
        staff: {
          findUnique: jest.fn().mockResolvedValue({ id: 'staff-1' }),
        },
        invoiceItem: {
          create: jest.fn().mockResolvedValue({
            id: 'item-1',
            isRecurringDaily: false,
          }),
        },
      };
      const service = createInvoiceService(prisma);
      (service as any).recalculateInvoiceTotals = jest.fn().mockResolvedValue({});

      await service.addItem('inv-1', { serviceId: 'svc-1', unitPrice: 999 }, 'staff-1');

      const createCall = prisma.invoiceItem.create.mock.calls[0][0];
      expect(createCall.data.unitPrice.toString()).toBe('999');
    });
  });

  describe('addDrugItem ward-based pricing', () => {
    const invoiceId = 'inv-1';
    const drugId = 'drug-1';
    const wardId = 'ward-opd';
    const costPrice = new Prisma.Decimal(1200);

    const preloadedDrug = {
      id: drugId,
      genericName: 'Test Drug',
      latestCost: costPrice,
    };

    function createAddDrugItemPrisma(options: {
      wardId?: string | null;
      hmoId?: string | null;
      ward?: { name: string; drugPricePercentage: Prisma.Decimal } | null;
      inpatientWard?: { drugPricePercentage: Prisma.Decimal } | null;
      activeAdmissions?: number;
    }) {
      const patientId = 'pat-1';
      const invoiceFindUnique = jest.fn().mockResolvedValue({
        id: invoiceId,
        status: InvoiceStatus.PENDING,
        patientId,
        patient: {
          hmoId: options.hmoId ?? null,
          wardId: options.wardId ?? null,
        },
      });

      const wardFindUnique = jest.fn().mockImplementation(({ where }) => {
        if (options.wardId && where.id === options.wardId) {
          return Promise.resolve(options.ward ?? null);
        }
        return Promise.resolve(null);
      });

      const wardFindFirst = jest.fn().mockResolvedValue(options.inpatientWard ?? null);

      const invoiceItemCreate = jest.fn().mockImplementation(({ data }) => ({
        id: 'item-1',
        ...data,
        drug: { id: drugId, genericName: 'Test Drug' },
        invoice: { id: invoiceId, status: InvoiceStatus.PENDING, patientId: 'pat-1' },
        createdBy: null,
      }));

      const prisma: any = {
        invoice: {
          findUnique: invoiceFindUnique,
          update: jest.fn().mockResolvedValue({}),
        },
        ward: {
          findUnique: wardFindUnique,
          findFirst: wardFindFirst,
        },
        admission: {
          count: jest.fn().mockResolvedValue(options.activeAdmissions ?? 0),
        },
        invoiceItem: {
          create: invoiceItemCreate,
        },
      };

      return { prisma, invoiceItemCreate, wardFindUnique, wardFindFirst };
    }

    async function addDrugWithPricing(prisma: any) {
      const service = createInvoiceService(prisma);
      (service as any).recalculateInvoiceTotals = jest.fn().mockResolvedValue({});
      await service.addDrugItem(
        {
          invoiceId,
          drugId,
          quantity: 1,
          preloadedDrug: preloadedDrug as any,
        },
        prisma,
      );
      return prisma.invoiceItem.create.mock.calls[0][0].data.unitPrice;
    }

    it('applies ward drugPricePercentage multiplier to latest batch costPrice', async () => {
      const { prisma } = createAddDrugItemPrisma({
        wardId: 'ward-inpatient',
        ward: {
          name: 'Inpatient Ward',
          drugPricePercentage: new Prisma.Decimal(2),
        },
      });
      const unitPrice = await addDrugWithPricing(prisma);
      expect(unitPrice.toString()).toBe('2400');
    });

    it('uses multiplier 1 when patient has no wardId', async () => {
      const { prisma } = createAddDrugItemPrisma({ wardId: null });
      const unitPrice = await addDrugWithPricing(prisma);
      expect(unitPrice.toString()).toBe('1200');
      expect(prisma.ward.findUnique).not.toHaveBeenCalled();
    });

    it('uses Inpatient Ward multiplier for HMO patient on OPD ward', async () => {
      const { prisma } = createAddDrugItemPrisma({
        wardId,
        hmoId: 'hmo-1',
        ward: { name: 'OPD', drugPricePercentage: new Prisma.Decimal(1) },
        inpatientWard: { drugPricePercentage: new Prisma.Decimal(2) },
      });
      const unitPrice = await addDrugWithPricing(prisma);
      expect(unitPrice.toString()).toBe('2400');
      expect(prisma.ward.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { name: { equals: 'Inpatient Ward', mode: 'insensitive' } },
        }),
      );
    });

    it('detects OPD ward with trim and case-insensitive name for HMO override', async () => {
      const { prisma } = createAddDrugItemPrisma({
        wardId,
        hmoId: 'hmo-1',
        ward: { name: ' opd ', drugPricePercentage: new Prisma.Decimal(1) },
        inpatientWard: { drugPricePercentage: new Prisma.Decimal(2) },
      });
      const unitPrice = await addDrugWithPricing(prisma);
      expect(unitPrice.toString()).toBe('2400');
    });

    it('uses OPD ward multiplier only for non-HMO patient on OPD', async () => {
      const { prisma } = createAddDrugItemPrisma({
        wardId,
        hmoId: null,
        ward: { name: 'OPD', drugPricePercentage: new Prisma.Decimal(1.5) },
        inpatientWard: { drugPricePercentage: new Prisma.Decimal(2) },
      });
      const unitPrice = await addDrugWithPricing(prisma);
      expect(unitPrice.toString()).toBe('1800');
      expect(prisma.ward.findFirst).not.toHaveBeenCalled();
    });

    it('uses Inpatient Ward multiplier for HMO outpatient without wardId', async () => {
      const { prisma } = createAddDrugItemPrisma({
        wardId: null,
        hmoId: 'hmo-1',
        inpatientWard: { drugPricePercentage: new Prisma.Decimal(2) },
      });
      const unitPrice = await addDrugWithPricing(prisma);
      expect(unitPrice.toString()).toBe('2400');
      expect(prisma.admission.count).toHaveBeenCalled();
    });

    it('uses patient ward multiplier for admitted HMO patient', async () => {
      const { prisma } = createAddDrugItemPrisma({
        wardId: 'ward-icu',
        hmoId: 'hmo-1',
        ward: { name: 'ICU', drugPricePercentage: new Prisma.Decimal(3) },
        inpatientWard: { drugPricePercentage: new Prisma.Decimal(2) },
        activeAdmissions: 1,
      });
      const unitPrice = await addDrugWithPricing(prisma);
      expect(unitPrice.toString()).toBe('3600');
      expect(prisma.ward.findFirst).not.toHaveBeenCalled();
    });

    it('bills at 0 when drug has no cost history', async () => {
      const { prisma } = createAddDrugItemPrisma({});
      const service = createInvoiceService(prisma);
      (service as any).recalculateInvoiceTotals = jest.fn().mockResolvedValue({});
      await service.addDrugItem(
        {
          invoiceId,
          drugId,
          quantity: 1,
          preloadedDrug: {
            id: drugId,
            genericName: 'Test Drug',
            latestCost: null,
          } as any,
        },
        prisma,
      );
      const unitPrice =
        prisma.invoiceItem.create.mock.calls[0][0].data.unitPrice;
      expect(unitPrice.toString()).toBe('0');
    });

    it('bills at 0 when latest batch cost price is zero', async () => {
      const { prisma } = createAddDrugItemPrisma({});
      const service = createInvoiceService(prisma);
      (service as any).recalculateInvoiceTotals = jest.fn().mockResolvedValue({});
      await service.addDrugItem(
        {
          invoiceId,
          drugId,
          quantity: 1,
          preloadedDrug: {
            id: drugId,
            genericName: 'Test Drug',
            latestCost: new Prisma.Decimal(0),
          } as any,
        },
        prisma,
      );
      const unitPrice =
        prisma.invoiceItem.create.mock.calls[0][0].data.unitPrice;
      expect(unitPrice.toString()).toBe('0');
    });
  });

  describe('consolidatePendingInvoicesForPatient', () => {
    const patientId = 'pat-1';

    function movableItem(id: string) {
      return {
        id,
        settled: false,
        amountPaid: new Prisma.Decimal(0),
        _count: { allocations: 0 },
      };
    }

    function createConsolidationTx(options: {
      invoices: Array<{
        id: string;
        invoiceID: string;
        createdAt: Date;
        vitalsId?: string | null;
        encounterId?: string | null;
        consultingRoomId?: string | null;
      }>;
      itemsByInvoice: Record<string, ReturnType<typeof movableItem>[]>;
      remainingItemsByInvoice?: Record<string, number>;
    }) {
      const auditCreate = jest.fn().mockResolvedValue({});
      const tx: any = {
        invoice: {
          findMany: jest.fn().mockResolvedValue(
            options.invoices.map((inv) => ({
              ...inv,
              patientId,
              status: InvoiceStatus.PENDING,
              vitalsId: inv.vitalsId ?? null,
              encounterId: inv.encounterId ?? null,
              consultingRoomId: inv.consultingRoomId ?? null,
            })),
          ),
          findUniqueOrThrow: jest.fn().mockImplementation(({ where }) => {
            const inv = options.invoices.find((row) => row.id === where.id);
            return Promise.resolve({
              id: inv?.id,
              vitalsId: inv?.vitalsId ?? null,
              encounterId: inv?.encounterId ?? null,
              consultingRoomId: inv?.consultingRoomId ?? null,
            });
          }),
          update: jest.fn().mockResolvedValue({}),
          delete: jest.fn().mockResolvedValue({}),
        },
        invoiceItem: {
          findMany: jest.fn().mockImplementation(({ where }) =>
            Promise.resolve(options.itemsByInvoice[where.invoiceId] ?? []),
          ),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          count: jest.fn().mockImplementation(({ where }) =>
            Promise.resolve(options.remainingItemsByInvoice?.[where.invoiceId] ?? 0),
          ),
        },
        labRequest: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
        dialysisSession: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
        dialysisSessionConsumable: {
          updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        },
        surgeryRequest: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
        theatreCaseConsumable: {
          updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        },
        invoiceDrugReturn: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
        invoicePurchaseItemReturn: {
          updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        },
        outpatientNurseAssignment: {
          findUnique: jest.fn().mockResolvedValue(null),
        },
        invoiceAuditLog: { create: auditCreate },
      };
      return { tx, auditCreate };
    }

    it('merges three PENDING invoices into the oldest', async () => {
      const { tx, auditCreate } = createConsolidationTx({
        invoices: [
          { id: 'inv-old', invoiceID: 'OLD0000001', createdAt: new Date('2026-01-01') },
          { id: 'inv-mid', invoiceID: 'MID0000002', createdAt: new Date('2026-01-02') },
          { id: 'inv-new', invoiceID: 'NEW0000003', createdAt: new Date('2026-01-03') },
        ],
        itemsByInvoice: {
          'inv-mid': [movableItem('item-mid')],
          'inv-new': [movableItem('item-new')],
        },
      });
      const service = createInvoiceService({} as any);
      jest.spyOn(service, 'recalculateInvoiceTotals').mockResolvedValue({} as any);

      const result = await service.consolidatePendingInvoicesForPatient(patientId, tx);

      expect(result).toEqual({
        targetInvoiceId: 'inv-old',
        mergedCount: 2,
        deletedCount: 2,
        skippedSourceIds: [],
      });
      expect(tx.invoice.delete).toHaveBeenCalledTimes(2);
      expect(tx.invoiceItem.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: { in: ['item-mid'] } },
          data: { invoiceId: 'inv-old' },
        }),
      );
      expect(auditCreate).toHaveBeenCalledTimes(2);
    });

    it('is a no-op when the patient has only one PENDING invoice', async () => {
      const { tx } = createConsolidationTx({
        invoices: [
          { id: 'inv-only', invoiceID: 'ONLY000001', createdAt: new Date('2026-01-01') },
        ],
        itemsByInvoice: {
          'inv-only': [movableItem('item-only')],
        },
      });
      const service = createInvoiceService({} as any);

      const result = await service.consolidatePendingInvoicesForPatient(patientId, tx);

      expect(result).toEqual({
        targetInvoiceId: 'inv-only',
        mergedCount: 0,
        deletedCount: 0,
        skippedSourceIds: [],
      });
      expect(tx.invoice.delete).not.toHaveBeenCalled();
    });

    it('ignores PARTIALLY_PAID invoices because only PENDING rows are loaded', async () => {
      const { tx } = createConsolidationTx({
        invoices: [
          { id: 'inv-pending', invoiceID: 'PEND000001', createdAt: new Date('2026-01-01') },
        ],
        itemsByInvoice: {
          'inv-pending': [movableItem('item-pending')],
        },
      });
      const service = createInvoiceService({} as any);

      const result = await service.consolidatePendingInvoicesForPatient(patientId, tx);

      expect(result.mergedCount).toBe(0);
      expect(tx.invoice.findMany).toHaveBeenCalledWith({
        where: { patientId, status: InvoiceStatus.PENDING },
        orderBy: { createdAt: 'asc' },
      });
    });

    it('skips a source with unmovable lines but still merges other sources', async () => {
      const { tx } = createConsolidationTx({
        invoices: [
          { id: 'inv-old', invoiceID: 'OLD0000001', createdAt: new Date('2026-01-01') },
          { id: 'inv-bad', invoiceID: 'BAD0000002', createdAt: new Date('2026-01-02') },
          { id: 'inv-new', invoiceID: 'NEW0000003', createdAt: new Date('2026-01-03') },
        ],
        itemsByInvoice: {
          'inv-bad': [
            {
              id: 'item-bad',
              settled: true,
              amountPaid: new Prisma.Decimal(0),
              _count: { allocations: 0 },
            },
          ],
          'inv-new': [movableItem('item-new')],
        },
      });
      const service = createInvoiceService({} as any);
      jest.spyOn(service, 'recalculateInvoiceTotals').mockResolvedValue({} as any);

      const result = await service.consolidatePendingInvoicesForPatient(patientId, tx);

      expect(result.mergedCount).toBe(1);
      expect(result.deletedCount).toBe(1);
      expect(result.skippedSourceIds).toEqual(['inv-bad']);
      expect(tx.invoice.delete).toHaveBeenCalledTimes(1);
      expect(tx.invoice.delete).toHaveBeenCalledWith({ where: { id: 'inv-new' } });
    });

    it('repoints lab requests when line items are moved', async () => {
      const { tx } = createConsolidationTx({
        invoices: [
          { id: 'inv-old', invoiceID: 'OLD0000001', createdAt: new Date('2026-01-01') },
          { id: 'inv-new', invoiceID: 'NEW0000002', createdAt: new Date('2026-01-02') },
        ],
        itemsByInvoice: {
          'inv-new': [movableItem('item-lab')],
        },
      });
      const service = createInvoiceService({} as any);
      jest.spyOn(service, 'recalculateInvoiceTotals').mockResolvedValue({} as any);

      await service.consolidatePendingInvoicesForPatient(patientId, tx);

      expect(tx.labRequest.updateMany).toHaveBeenCalledWith({
        where: { invoiceItemId: { in: ['item-lab'] } },
        data: { invoiceId: 'inv-old' },
      });
      expect(tx.labRequest.updateMany).toHaveBeenCalledWith({
        where: { invoiceId: 'inv-new' },
        data: { invoiceId: 'inv-old' },
      });
    });
  });
});
