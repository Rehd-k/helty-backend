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
