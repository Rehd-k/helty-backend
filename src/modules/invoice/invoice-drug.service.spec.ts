import {
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InvoiceStatus, Prisma } from '@prisma/client';
import { InvoiceDrugService } from './invoice-drug.service';
import { InvoiceService } from './invoice.service';
import { DrugStockService } from '../pharmacy/drug-stock.service';

function createDrugService(
  prisma: any,
  invoiceService: Partial<InvoiceService> = {},
  drugStockService: Partial<DrugStockService> = {},
) {
  return new InvoiceDrugService(
    prisma,
    invoiceService as InvoiceService,
    {
      deductDrugStockFifo: jest.fn().mockResolvedValue(undefined),
      getAvailableQuantity: jest.fn().mockResolvedValue(10),
      ...drugStockService,
    } as DrugStockService,
  );
}

describe('InvoiceDrugService', () => {
  it('returnDrugInvoiceItem rejects when return quantity exceeds line quantity', async () => {
    const prisma: any = {
      invoiceItem: { count: jest.fn().mockResolvedValue(1) },
      $transaction: jest
        .fn()
        .mockImplementation(async (cb: (tx: any) => unknown) => {
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
    const service = createDrugService(prisma);
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
      $transaction: jest
        .fn()
        .mockImplementation(async (cb: (tx: any) => unknown) => {
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
    const service = createDrugService(prisma);
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
      $transaction: jest
        .fn()
        .mockImplementation(async (cb: (tx: any) => unknown) => {
          capturedTx = {
            invoice: {
              findUnique: jest
                .fn()
                .mockImplementation((args: { include?: unknown }) => {
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

    const service = createDrugService(prisma);
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
      $transaction: jest
        .fn()
        .mockImplementation(async (cb: (tx: any) => unknown) => {
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
    const service = createDrugService(prisma);
    await expect(
      service.returnDrugInvoiceItem(
        'inv-1',
        'item-1',
        { quantity: 1 },
        'staff-1',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('updateDrugInvoiceItem rejects settle without payment when not admitted', async () => {
    const invoiceService = {
      hasActiveAdmission: jest.fn().mockResolvedValue(false),
    };
    const prisma: any = {
      invoiceItem: { count: jest.fn().mockResolvedValue(1) },
      invoice: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'inv-1',
          patientId: 'pat-1',
          status: InvoiceStatus.PENDING,
          encounterId: null,
        }),
      },
      pharmacyLocation: {
        findUnique: jest.fn().mockResolvedValue({ id: 'loc-1' }),
      },
      invoiceItem_findFirst: {
        id: 'item-1',
        invoiceId: 'inv-1',
        drugId: 'drug-1',
        quantity: 1,
        settled: false,
        unitPrice: new Prisma.Decimal(10),
      },
      $transaction: jest
        .fn()
        .mockImplementation(async (cb: (tx: any) => unknown) => {
          const tx = {};
          return cb(tx);
        }),
    };
    prisma.invoiceItem = {
      count: jest.fn().mockResolvedValue(1),
      findFirst: jest.fn().mockResolvedValue(prisma.invoiceItem_findFirst),
    };
    const service = createDrugService(prisma, invoiceService);

    await expect(
      service.updateDrugInvoiceItem(
        'inv-1',
        'item-1',
        { settled: true },
        'loc-1',
        'staff-1',
      ),
    ).rejects.toThrow(
      'Drug lines can only be dispensed without payment for actively admitted patients.',
    );
    expect(invoiceService.hasActiveAdmission).toHaveBeenCalled();
  });

  it('updateDrugInvoiceItem rejects settle without locationId', async () => {
    const prisma: any = {
      invoiceItem: {
        count: jest.fn().mockResolvedValue(1),
        findFirst: jest.fn().mockResolvedValue({
          id: 'item-1',
          invoiceId: 'inv-1',
          drugId: 'drug-1',
          quantity: 1,
          settled: false,
          unitPrice: new Prisma.Decimal(10),
        }),
      },
      invoice: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'inv-1',
          patientId: 'pat-1',
          status: InvoiceStatus.PAID,
          encounterId: null,
        }),
      },
    };
    const service = createDrugService(prisma);

    await expect(
      service.updateDrugInvoiceItem(
        'inv-1',
        'item-1',
        { settled: true },
        undefined,
        'staff-1',
      ),
    ).rejects.toThrow(
      'Dispensary location is required to dispense this drug.',
    );
  });

  it('updateDrugInvoiceItem rejects settle without staff id', async () => {
    const prisma: any = {
      invoiceItem: {
        count: jest.fn().mockResolvedValue(1),
        findFirst: jest.fn().mockResolvedValue({
          id: 'item-1',
          invoiceId: 'inv-1',
          drugId: 'drug-1',
          quantity: 1,
          settled: false,
          unitPrice: new Prisma.Decimal(10),
        }),
      },
      invoice: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'inv-1',
          patientId: 'pat-1',
          status: InvoiceStatus.PAID,
          encounterId: null,
        }),
      },
      pharmacyLocation: {
        findUnique: jest.fn().mockResolvedValue({ id: 'loc-1' }),
      },
    };
    const service = createDrugService(prisma);

    await expect(
      service.updateDrugInvoiceItem('inv-1', 'item-1', { settled: true }, 'loc-1'),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('updateDrugInvoiceItem persists dispense audit fields on settle', async () => {
    const batch = {
      id: 'batch-1',
      drugId: 'drug-1',
      quantityRemaining: 10,
      manufacturingDate: new Date('2024-01-01'),
      createdAt: new Date(),
    };
    let updateData: Record<string, unknown> = {};
    const prisma: any = {
      invoiceItem: {
        count: jest.fn().mockResolvedValue(1),
        findFirst: jest.fn().mockResolvedValue({
          id: 'item-1',
          invoiceId: 'inv-1',
          drugId: 'drug-1',
          quantity: 2,
          settled: false,
          unitPrice: new Prisma.Decimal(10),
        }),
      },
      invoice: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'inv-1',
          patientId: 'pat-1',
          status: InvoiceStatus.PAID,
          encounterId: null,
          amountPaid: new Prisma.Decimal(0),
        }),
      },
      pharmacyLocation: {
        findUnique: jest.fn().mockResolvedValue({ id: 'loc-1' }),
      },
      $transaction: jest
        .fn()
        .mockImplementation(async (cb: (tx: any) => unknown) => {
          const tx = {
            pharmacyLocation: {
              findMany: jest.fn().mockResolvedValue([]),
            },
            drugBatch: {
              findMany: jest.fn().mockResolvedValue([batch]),
              update: jest.fn().mockResolvedValue({}),
            },
            invoiceItem: {
              update: jest.fn().mockImplementation(({ data }) => {
                updateData = data;
                return Promise.resolve({
                  id: 'item-1',
                  settled: true,
                  dispensedAt: data.dispensedAt,
                  dispensedById: data.dispensedById,
                  dispensaryLocationId: data.dispensaryLocationId,
                });
              }),
            },
            medicationRequest: {
              findFirst: jest.fn().mockResolvedValue(null),
              update: jest.fn(),
              count: jest.fn(),
            },
            medicationOrder: {
              findFirst: jest.fn().mockResolvedValue(null),
              updateMany: jest.fn(),
            },
            invoice: {
              findUnique: jest.fn().mockResolvedValue({
                id: 'inv-1',
                amountPaid: new Prisma.Decimal(0),
                invoiceItems: [
                  {
                    id: 'item-1',
                    quantity: 2,
                    unitPrice: new Prisma.Decimal(10),
                    isRecurringDaily: false,
                    usageSegments: [],
                  },
                ],
              }),
              update: jest.fn().mockResolvedValue({}),
            },
          };
          return cb(tx);
        }),
    };
    const service = createDrugService(prisma);

    await service.updateDrugInvoiceItem(
      'inv-1',
      'item-1',
      { settled: true },
      'loc-1',
      'staff-1',
    );

    expect(updateData).toMatchObject({
      settled: true,
      dispensedById: 'staff-1',
      dispensaryLocationId: 'loc-1',
    });
    expect(updateData.dispensedAt).toBeInstanceOf(Date);
  });

  it('updateDrugInvoiceItem delegates stock deduction to DrugStockService on settle', async () => {
    const deductDrugStockFifo = jest.fn().mockResolvedValue(undefined);
    const prisma: any = {
      invoiceItem: {
        count: jest.fn().mockResolvedValue(1),
        findFirst: jest.fn().mockResolvedValue({
          id: 'item-1',
          invoiceId: 'inv-1',
          drugId: 'drug-1',
          quantity: 2,
          settled: false,
          unitPrice: new Prisma.Decimal(10),
        }),
      },
      invoice: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'inv-1',
          patientId: 'pat-1',
          status: InvoiceStatus.PAID,
          encounterId: null,
          amountPaid: new Prisma.Decimal(0),
        }),
      },
      pharmacyLocation: {
        findUnique: jest.fn().mockResolvedValue({ id: 'loc-1' }),
      },
      $transaction: jest
        .fn()
        .mockImplementation(async (cb: (tx: any) => unknown) => {
          const tx = {
            invoiceItem: {
              update: jest.fn().mockResolvedValue({ id: 'item-1', settled: true }),
            },
            medicationRequest: {
              findFirst: jest.fn().mockResolvedValue(null),
              update: jest.fn(),
              count: jest.fn(),
            },
            medicationOrder: {
              findFirst: jest.fn().mockResolvedValue(null),
              updateMany: jest.fn(),
            },
            invoice: {
              findUnique: jest.fn().mockResolvedValue({
                id: 'inv-1',
                amountPaid: new Prisma.Decimal(0),
                invoiceItems: [],
              }),
              update: jest.fn().mockResolvedValue({}),
            },
          };
          return cb(tx);
        }),
    };
    const service = createDrugService(prisma, {}, { deductDrugStockFifo });

    await service.updateDrugInvoiceItem(
      'inv-1',
      'item-1',
      { settled: true },
      'loc-1',
      'staff-1',
    );

    expect(deductDrugStockFifo).toHaveBeenCalledWith(
      expect.anything(),
      'drug-1',
      2,
      'loc-1',
    );
  });

  it('returnDrugInvoiceItem throws NotFound when invoice has no drug items', async () => {
    const prisma: any = {
      invoiceItem: { count: jest.fn().mockResolvedValue(0) },
    };
    const service = createDrugService(prisma);
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
