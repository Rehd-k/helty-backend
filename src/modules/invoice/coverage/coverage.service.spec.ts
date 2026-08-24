import { BadRequestException } from '@nestjs/common';
import {
  DiscountReason,
  InvoiceCoverageKind,
  InvoiceCoverageMode,
  InvoiceCoverageScope,
  InvoiceCoverageStatus,
  InvoiceStatus,
  Prisma,
} from '@prisma/client';
import { InvoiceCoverageService } from './coverage.service';

jest.mock('nanoid', () => ({
  customAlphabet: () => () => 'TESTID0001',
}));

function createService(prisma: any, invoiceService: any) {
  return new InvoiceCoverageService(prisma, invoiceService);
}

describe('InvoiceCoverageService', () => {
  it('applies 100% HMO invoice-level coverage and caps to outstanding', async () => {
    const tx: any = {
      invoice: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'inv-1',
          status: InvoiceStatus.PENDING,
          totalAmount: new Prisma.Decimal(100),
          amountPaid: new Prisma.Decimal(0),
          patientId: 'pat-1',
        }),
      },
      patient: {
        findUnique: jest.fn().mockResolvedValue({ id: 'pat-1', hmoId: 'hmo-1' }),
      },
      hmo: {
        findUnique: jest.fn().mockResolvedValue({ defaultCoveragePercent: new Prisma.Decimal(100) }),
      },
      invoiceCoverage: {
        findFirst: jest.fn().mockResolvedValue(null),
        aggregate: jest.fn().mockResolvedValue({ _sum: { amount: null } }),
        create: jest.fn().mockResolvedValue({ id: 'cov-1' }),
      },
      invoiceAuditLog: { create: jest.fn() },
    };

    const prisma: any = {
      $transaction: (cb: any) => cb(tx),
    };
    const invoiceService: any = {
      recalculateInvoiceTotals: jest.fn().mockResolvedValue({ status: InvoiceStatus.PAID }),
      handleInvoiceFullyPaid: jest.fn().mockResolvedValue(undefined),
      findOne: jest.fn().mockResolvedValue({ id: 'inv-1' }),
    };

    const service = createService(prisma, invoiceService);
    const result = await service.applyHmoCoverage(
      'inv-1',
      { scope: InvoiceCoverageScope.INVOICE },
      'staff-1',
    );

    expect(tx.invoiceCoverage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          invoiceId: 'inv-1',
          kind: InvoiceCoverageKind.HMO,
          scope: InvoiceCoverageScope.INVOICE,
          hmoId: 'hmo-1',
          mode: InvoiceCoverageMode.PERCENT,
          value: new Prisma.Decimal(100),
          amount: new Prisma.Decimal(100),
          status: InvoiceCoverageStatus.APPLIED,
          appliedById: 'staff-1',
        }),
      }),
    );
    expect(invoiceService.recalculateInvoiceTotals).toHaveBeenCalled();
    expect(invoiceService.handleInvoiceFullyPaid).toHaveBeenCalledWith(
      tx,
      'inv-1',
      expect.any(Date),
    );
    expect(result).toEqual({ id: 'inv-1' });
  });

  it('does not run full-pay handler when HMO coverage is partial', async () => {
    const tx: any = {
      invoice: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'inv-1',
          status: InvoiceStatus.PENDING,
          totalAmount: new Prisma.Decimal(100),
          amountPaid: new Prisma.Decimal(0),
          patientId: 'pat-1',
        }),
      },
      patient: {
        findUnique: jest.fn().mockResolvedValue({ id: 'pat-1', hmoId: 'hmo-1' }),
      },
      hmo: {
        findUnique: jest.fn().mockResolvedValue({ defaultCoveragePercent: new Prisma.Decimal(50) }),
      },
      invoiceCoverage: {
        findFirst: jest.fn().mockResolvedValue(null),
        aggregate: jest.fn().mockResolvedValue({ _sum: { amount: null } }),
        create: jest.fn().mockResolvedValue({ id: 'cov-1' }),
      },
      invoiceAuditLog: { create: jest.fn() },
    };

    const prisma: any = {
      $transaction: (cb: any) => cb(tx),
    };
    const invoiceService: any = {
      recalculateInvoiceTotals: jest
        .fn()
        .mockResolvedValue({ status: InvoiceStatus.PARTIALLY_PAID }),
      handleInvoiceFullyPaid: jest.fn().mockResolvedValue(undefined),
      findOne: jest.fn().mockResolvedValue({ id: 'inv-1' }),
    };

    const service = createService(prisma, invoiceService);
    await service.applyHmoCoverage(
      'inv-1',
      { scope: InvoiceCoverageScope.INVOICE },
      'staff-1',
    );

    expect(invoiceService.handleInvoiceFullyPaid).not.toHaveBeenCalled();
  });

  it('applies 100% invoice-level discount and runs full-pay handler', async () => {
    const tx: any = {
      invoice: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'inv-1',
          status: InvoiceStatus.PENDING,
          totalAmount: new Prisma.Decimal(100),
          amountPaid: new Prisma.Decimal(0),
          patientId: 'pat-1',
        }),
      },
      discountPolicy: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'pol-1',
          name: 'CMD 100%',
          active: true,
          mode: InvoiceCoverageMode.PERCENT,
          value: new Prisma.Decimal(100),
          reason: DiscountReason.CMD,
          ownerId: 'staff-owner',
        }),
      },
      invoiceCoverage: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { amount: null } }),
        create: jest.fn().mockResolvedValue({ id: 'cov-disc-1' }),
      },
      invoiceAuditLog: { create: jest.fn() },
    };

    const prisma: any = {
      $transaction: (cb: any) => cb(tx),
    };
    const invoiceService: any = {
      recalculateInvoiceTotals: jest.fn().mockResolvedValue({ status: InvoiceStatus.PAID }),
      handleInvoiceFullyPaid: jest.fn().mockResolvedValue(undefined),
      findOne: jest.fn().mockResolvedValue({ id: 'inv-1', status: InvoiceStatus.PAID }),
    };

    const service = createService(prisma, invoiceService);
    const result = await service.applyDiscount(
      'inv-1',
      { policyId: 'pol-1', scope: InvoiceCoverageScope.INVOICE },
      'staff-1',
    );

    expect(tx.invoiceCoverage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          invoiceId: 'inv-1',
          kind: InvoiceCoverageKind.DISCOUNT,
          scope: InvoiceCoverageScope.INVOICE,
          policyId: 'pol-1',
          mode: InvoiceCoverageMode.PERCENT,
          value: new Prisma.Decimal(100),
          amount: new Prisma.Decimal(100),
          status: InvoiceCoverageStatus.APPLIED,
          appliedById: 'staff-1',
        }),
      }),
    );
    expect(invoiceService.recalculateInvoiceTotals).toHaveBeenCalled();
    expect(invoiceService.handleInvoiceFullyPaid).toHaveBeenCalledWith(
      tx,
      'inv-1',
      expect.any(Date),
    );
    expect(result).toEqual({ id: 'inv-1', status: InvoiceStatus.PAID });
  });

  it('does not run full-pay handler when discount is partial', async () => {
    const tx: any = {
      invoice: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'inv-1',
          status: InvoiceStatus.PENDING,
          totalAmount: new Prisma.Decimal(100),
          amountPaid: new Prisma.Decimal(0),
          patientId: 'pat-1',
        }),
      },
      discountPolicy: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'pol-1',
          name: 'CMD 50%',
          active: true,
          mode: InvoiceCoverageMode.PERCENT,
          value: new Prisma.Decimal(50),
          reason: DiscountReason.CMD,
          ownerId: 'staff-owner',
        }),
      },
      invoiceCoverage: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { amount: null } }),
        create: jest.fn().mockResolvedValue({ id: 'cov-disc-1' }),
      },
      invoiceAuditLog: { create: jest.fn() },
    };

    const prisma: any = {
      $transaction: (cb: any) => cb(tx),
    };
    const invoiceService: any = {
      recalculateInvoiceTotals: jest
        .fn()
        .mockResolvedValue({ status: InvoiceStatus.PARTIALLY_PAID }),
      handleInvoiceFullyPaid: jest.fn().mockResolvedValue(undefined),
      findOne: jest.fn().mockResolvedValue({ id: 'inv-1' }),
    };

    const service = createService(prisma, invoiceService);
    await service.applyDiscount(
      'inv-1',
      { policyId: 'pol-1', scope: InvoiceCoverageScope.INVOICE },
      'staff-1',
    );

    expect(invoiceService.handleInvoiceFullyPaid).not.toHaveBeenCalled();
  });

  it('re-applies HMO after a reversed row and uses percentOverride', async () => {
    const tx: any = {
      invoice: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'inv-1',
          status: InvoiceStatus.PENDING,
          totalAmount: new Prisma.Decimal(200),
          amountPaid: new Prisma.Decimal(0),
          patientId: 'pat-1',
        }),
      },
      patient: {
        findUnique: jest.fn().mockResolvedValue({ id: 'pat-1', hmoId: 'hmo-1' }),
      },
      invoiceCoverage: {
        findFirst: jest.fn().mockResolvedValue(null),
        aggregate: jest.fn().mockResolvedValue({ _sum: { amount: null } }),
        create: jest.fn().mockResolvedValue({ id: 'cov-2' }),
      },
      invoiceAuditLog: { create: jest.fn() },
    };

    const prisma: any = { $transaction: (cb: any) => cb(tx) };
    const invoiceService: any = {
      recalculateInvoiceTotals: jest
        .fn()
        .mockResolvedValue({ status: InvoiceStatus.PARTIALLY_PAID }),
      handleInvoiceFullyPaid: jest.fn().mockResolvedValue(undefined),
      findOne: jest.fn().mockResolvedValue({ id: 'inv-1' }),
    };

    const service = createService(prisma, invoiceService);
    await service.applyHmoCoverage(
      'inv-1',
      { scope: InvoiceCoverageScope.INVOICE, percentOverride: 40 },
      'staff-1',
    );

    expect(tx.invoiceCoverage.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          invoiceId: 'inv-1',
          kind: InvoiceCoverageKind.HMO,
          status: {
            in: [InvoiceCoverageStatus.APPLIED, InvoiceCoverageStatus.SETTLED],
          },
        }),
      }),
    );
    expect(tx.invoiceCoverage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          value: new Prisma.Decimal(40),
          amount: new Prisma.Decimal(80),
          status: InvoiceCoverageStatus.APPLIED,
        }),
      }),
    );
  });

  it('rejects a second active HMO coverage on the same invoice', async () => {
    const tx: any = {
      invoice: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'inv-1',
          status: InvoiceStatus.PENDING,
          totalAmount: new Prisma.Decimal(100),
          amountPaid: new Prisma.Decimal(0),
          patientId: 'pat-1',
        }),
      },
      invoiceCoverage: {
        findFirst: jest.fn().mockResolvedValue({ id: 'cov-active' }),
      },
    };
    const prisma: any = { $transaction: (cb: any) => cb(tx) };
    const invoiceService: any = { findOne: jest.fn() };
    const service = createService(prisma, invoiceService);

    await expect(
      service.applyHmoCoverage(
        'inv-1',
        { scope: InvoiceCoverageScope.INVOICE },
        'staff-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('reverses HMO coverage within 24h even when the invoice is PAID', async () => {
    const tx: any = {
      invoice: {
        findUnique: jest.fn().mockResolvedValue({ id: 'inv-1' }),
      },
      invoiceCoverage: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'cov-1',
          kind: InvoiceCoverageKind.HMO,
          status: InvoiceCoverageStatus.APPLIED,
          createdAt: new Date(),
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      invoiceAuditLog: { create: jest.fn() },
    };
    const prisma: any = { $transaction: (cb: any) => cb(tx) };
    const invoiceService: any = {
      recalculateInvoiceTotals: jest
        .fn()
        .mockResolvedValue({ status: InvoiceStatus.PENDING }),
      clearUnusedConsultationCredit: jest.fn().mockResolvedValue(undefined),
      findOne: jest.fn().mockResolvedValue({ id: 'inv-1', status: InvoiceStatus.PENDING }),
    };
    const service = createService(prisma, invoiceService);

    await service.reverseCoverage('inv-1', 'cov-1', 'staff-1', 'wrong percent');

    expect(tx.invoiceCoverage.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: InvoiceCoverageStatus.REVERSED,
          reversedById: 'staff-1',
          reversalReason: 'wrong percent',
        }),
      }),
    );
    expect(invoiceService.clearUnusedConsultationCredit).toHaveBeenCalledWith(tx, 'inv-1');
  });

  it('rejects HMO reverse after 24 hours', async () => {
    const tx: any = {
      invoiceCoverage: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'cov-1',
          kind: InvoiceCoverageKind.HMO,
          status: InvoiceCoverageStatus.APPLIED,
          createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
        }),
      },
    };
    const prisma: any = { $transaction: (cb: any) => cb(tx) };
    const invoiceService: any = { findOne: jest.fn() };
    const service = createService(prisma, invoiceService);

    await expect(
      service.reverseCoverage('inv-1', 'cov-1', 'staff-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.reverseCoverage('inv-1', 'cov-1', 'staff-1'),
    ).rejects.toThrow('HMO coverage can only be reversed within 24 hours of apply.');
  });

  it('rejects reverse of SETTLED HMO coverage even within 24 hours', async () => {
    const tx: any = {
      invoiceCoverage: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'cov-1',
          kind: InvoiceCoverageKind.HMO,
          status: InvoiceCoverageStatus.SETTLED,
          createdAt: new Date(),
        }),
      },
    };
    const prisma: any = { $transaction: (cb: any) => cb(tx) };
    const invoiceService: any = { findOne: jest.fn() };
    const service = createService(prisma, invoiceService);

    await expect(
      service.reverseCoverage('inv-1', 'cov-1', 'staff-1'),
    ).rejects.toThrow('Cannot reverse a settled coverage.');
  });

  it('rejects discount apply when invoice is already paid', async () => {
    const tx: any = {
      invoice: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'inv-1',
          status: InvoiceStatus.PAID,
          totalAmount: new Prisma.Decimal(100),
          amountPaid: new Prisma.Decimal(0),
          patientId: 'pat-1',
        }),
      },
    };
    const prisma: any = { $transaction: (cb: any) => cb(tx) };
    const invoiceService: any = { findOne: jest.fn() };
    const service = createService(prisma, invoiceService);

    await expect(
      service.applyDiscount(
        'inv-1',
        { policyId: 'pol-1', scope: InvoiceCoverageScope.INVOICE, notes: 'x' },
        'staff-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
