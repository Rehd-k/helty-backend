import { BadRequestException } from '@nestjs/common';
import {
  CoverageRemittancePayerType,
  InvoiceCoverageStatus,
  Prisma,
} from '@prisma/client';
import { ReceivablesService } from './receivables.service';

describe('ReceivablesService', () => {
  it('creates a remittance and settles coverage lines', async () => {
    const tx: any = {
      invoiceCoverage: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'cov-1',
            invoiceId: 'inv-1',
            amount: new Prisma.Decimal(500),
            status: InvoiceCoverageStatus.APPLIED,
            hmoId: 'hmo-1',
            payerStaffId: null,
          },
        ]),
        update: jest.fn(),
      },
      coverageRemittance: {
        create: jest.fn().mockResolvedValue({ id: 'rem-1' }),
      },
      coverageRemittanceLine: {
        create: jest.fn(),
      },
      invoiceAuditLog: {
        create: jest.fn(),
      },
    };

    const prisma: any = {
      $transaction: (cb: any) => cb(tx),
      coverageRemittance: {
        findUnique: jest.fn().mockResolvedValue({ id: 'rem-1' }),
      },
    };

    const service = new ReceivablesService(prisma);
    // Spy the final read helper.
    jest.spyOn(service as any, 'getRemittance').mockResolvedValue({ id: 'rem-1' });

    const res = await service.createRemittance(
      {
        payerType: CoverageRemittancePayerType.HMO,
        hmoId: 'hmo-1',
        amount: 500,
        lines: [{ coverageId: 'cov-1', amount: 500 }],
      },
      'staff-1',
    );

    expect(tx.coverageRemittance.create).toHaveBeenCalled();
    expect(tx.coverageRemittanceLine.create).toHaveBeenCalled();
    expect(tx.invoiceCoverage.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'cov-1' },
        data: { status: InvoiceCoverageStatus.SETTLED },
      }),
    );
    expect(res).toEqual({ id: 'rem-1' });
  });

  it('rejects when sum(lines) != amount', async () => {
    const tx: any = {};
    const prisma: any = { $transaction: (cb: any) => cb(tx) };
    const service = new ReceivablesService(prisma);

    await expect(
      service.createRemittance(
        {
          payerType: CoverageRemittancePayerType.HMO,
          hmoId: 'hmo-1',
          amount: 500,
          lines: [{ coverageId: 'cov-1', amount: 200 }],
        },
        'staff-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

