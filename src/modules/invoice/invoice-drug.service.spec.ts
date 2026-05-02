import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InvoiceStatus, Prisma } from '@prisma/client';
import { InvoiceDrugService } from './invoice-drug.service';

describe('InvoiceDrugService', () => {
  it('returnDrugInvoiceItem rejects when return quantity exceeds line quantity', async () => {
    const prisma: any = {
      invoiceItem: { count: jest.fn().mockResolvedValue(1) },
      $transaction: jest.fn().mockImplementation(async (cb: (tx: any) => unknown) => {
        const tx = {
          invoice: {
            findUnique: jest.fn().mockResolvedValue({
              id: 'inv-1',
              status: InvoiceStatus.PENDING,
            }),
          },
          invoiceItem: {
            findFirst: jest.fn().mockResolvedValue({
              id: 'item-1',
              invoiceId: 'inv-1',
              drugId: 'drug-1',
              quantity: 2,
              settled: false,
              isRecurringDaily: false,
              amountPaid: new Prisma.Decimal(0),
              _count: { allocations: 0 },
            }),
          },
        };
        return cb(tx);
      }),
    };
    const service = new InvoiceDrugService(prisma);
    await expect(
      service.returnDrugInvoiceItem(
        'inv-1',
        'item-1',
        { quantity: 5 },
        'staff-1',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('returnDrugInvoiceItem rejects paid invoice', async () => {
    const prisma: any = {
      invoiceItem: { count: jest.fn().mockResolvedValue(1) },
      $transaction: jest.fn().mockImplementation(async (cb: (tx: any) => unknown) => {
        const tx = {
          invoice: {
            findUnique: jest.fn().mockResolvedValue({
              id: 'inv-1',
              status: InvoiceStatus.PAID,
            }),
          },
        };
        return cb(tx);
      }),
    };
    const service = new InvoiceDrugService(prisma);
    await expect(
      service.returnDrugInvoiceItem(
        'inv-1',
        'item-1',
        { quantity: 1 },
        'staff-1',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('returnDrugInvoiceItem partial return updates quantity and records return', async () => {
    const drugBatch = {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue({
        drugId: 'drug-1',
        batchNumber: 'B1',
        manufacturingDate: new Date(),
        expiryDate: new Date('2030-01-01'),
        supplierId: null,
        costPrice: new Prisma.Decimal(10),
        sellingPrice: new Prisma.Decimal(20),
        quantityReceived: 100,
        quantityRemaining: 50,
      }),
      update: jest.fn(),
      create: jest.fn(),
    };

    let capturedTx: any;
    const prisma: any = {
      invoiceItem: { count: jest.fn().mockResolvedValue(1) },
      $transaction: jest.fn().mockImplementation(async (cb: (tx: any) => unknown) => {
        capturedTx = {
          invoice: {
            findUnique: jest.fn().mockImplementation((args: { include?: unknown }) => {
              if (args?.include) {
                return Promise.resolve({
                  id: 'inv-1',
                  amountPaid: new Prisma.Decimal(0),
                  invoiceItems: [
                    {
                      id: 'item-1',
                      quantity: 3,
                      unitPrice: new Prisma.Decimal(10),
                      isRecurringDaily: false,
                      usageSegments: [],
                    },
                  ],
                });
              }
              return Promise.resolve({
                id: 'inv-1',
                status: InvoiceStatus.PENDING,
              });
            }),
            update: jest.fn().mockResolvedValue({}),
            findUniqueOrThrow: jest.fn().mockResolvedValue({
              id: 'inv-1',
              invoiceItems: [],
            }),
          },
          invoiceItem: {
            findFirst: jest.fn().mockResolvedValue({
              id: 'item-1',
              invoiceId: 'inv-1',
              drugId: 'drug-1',
              quantity: 5,
              settled: true,
              isRecurringDaily: false,
              amountPaid: new Prisma.Decimal(0),
              _count: { allocations: 0 },
            }),
            update: jest.fn().mockResolvedValue({}),
          },
          pharmacyLocation: {
            findFirst: jest.fn().mockResolvedValue({ id: 'loc-disp' }),
          },
          drugBatch,
          invoiceDrugReturn: {
            create: jest.fn().mockResolvedValue({ id: 'ret-1' }),
          },
          invoiceAuditLog: { create: jest.fn().mockResolvedValue({}) },
        };
        return cb(capturedTx);
      }),
    };

    const service = new InvoiceDrugService(prisma);
    const result = await service.returnDrugInvoiceItem(
      'inv-1',
      'item-1',
      { quantity: 2, reason: 'unused' },
      'staff-1',
    );

    expect(result.fullLineRemoved).toBe(false);
    expect(result.returnId).toBe('ret-1');
    expect(drugBatch.create).toHaveBeenCalled();
    expect(capturedTx.invoiceItem.update).toHaveBeenCalledWith({
      where: { id: 'item-1' },
      data: { quantity: 3 },
    });
  });

  it('returnDrugInvoiceItem throws when no dispensary location matches', async () => {
    const prisma: any = {
      invoiceItem: { count: jest.fn().mockResolvedValue(1) },
      $transaction: jest.fn().mockImplementation(async (cb: (tx: any) => unknown) => {
        const tx = {
          invoice: {
            findUnique: jest.fn().mockResolvedValue({
              id: 'inv-1',
              status: InvoiceStatus.PENDING,
            }),
          },
          invoiceItem: {
            findFirst: jest.fn().mockResolvedValue({
              id: 'item-1',
              invoiceId: 'inv-1',
              drugId: 'drug-1',
              quantity: 1,
              settled: true,
              isRecurringDaily: false,
              amountPaid: new Prisma.Decimal(0),
              _count: { allocations: 0 },
            }),
          },
          pharmacyLocation: {
            findFirst: jest.fn().mockResolvedValue(null),
          },
        };
        return cb(tx);
      }),
    };
    const service = new InvoiceDrugService(prisma);
    await expect(
      service.returnDrugInvoiceItem(
        'inv-1',
        'item-1',
        { quantity: 1 },
        'staff-1',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('returnDrugInvoiceItem throws NotFound when invoice has no drug items', async () => {
    const prisma: any = {
      invoiceItem: { count: jest.fn().mockResolvedValue(0) },
    };
    const service = new InvoiceDrugService(prisma);
    await expect(
      service.returnDrugInvoiceItem(
        'inv-1',
        'item-1',
        { quantity: 1 },
        'staff-1',
      ),
    ).rejects.toThrow(NotFoundException);
  });
});
