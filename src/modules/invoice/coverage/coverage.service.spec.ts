import { BadRequestException } from '@nestjs/common';
import {
  InvoiceCoverageKind,
  InvoiceCoverageMode,
  InvoiceCoverageScope,
  InvoiceCoverageStatus,
  InvoiceStatus,
  Prisma,
} from '@prisma/client';
import { InvoiceCoverageService } from './coverage.service';

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
    expect(result).toEqual({ id: 'inv-1' });
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

