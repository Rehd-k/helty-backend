import { BadRequestException, NotFoundException } from '@nestjs/common';
import { InvoiceAuditAction, InvoiceStatus, Prisma } from '@prisma/client';
import { InvoicePurchaseService } from './invoice-purchase.service';
import { InvoiceService } from './invoice.service';
import { PurchaseItemStockService } from '../purchases/purchase-item-stock.service';

function createService(
  prisma: any,
  purchaseItemStock: Partial<PurchaseItemStockService> = {},
  invoiceService: Partial<InvoiceService> = {},
) {
  return new InvoicePurchaseService(
    prisma,
    purchaseItemStock as PurchaseItemStockService,
    invoiceService as InvoiceService,
  );
}

describe('InvoicePurchaseService', () => {
  it('returnPurchaseInvoiceItem rejects when return quantity exceeds line quantity', async () => {
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
                purchaseItemId: 'pi-1',
                purchasesLocationId: 'loc-1',
                quantity: 2,
                isRecurringDaily: false,
                amountPaid: new Prisma.Decimal(0),
                _count: { allocations: 0 },
              }),
            },
          };
          return cb(tx);
        }),
    };
    const service = createService(prisma);
    await expect(
      service.returnPurchaseInvoiceItem(
        'inv-1',
        'item-1',
        { quantity: 5 },
        'staff-1',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('returnPurchaseInvoiceItem rejects paid invoice', async () => {
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
    const service = createService(prisma);
    await expect(
      service.returnPurchaseInvoiceItem(
        'inv-1',
        'item-1',
        { quantity: 1 },
        'staff-1',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('returnPurchaseInvoiceItem rejects lines with payment allocations', async () => {
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
                purchaseItemId: 'pi-1',
                purchasesLocationId: 'loc-1',
                quantity: 2,
                isRecurringDaily: false,
                amountPaid: new Prisma.Decimal(0),
                _count: { allocations: 1 },
              }),
            },
          };
          return cb(tx);
        }),
    };
    const service = createService(prisma);
    await expect(
      service.returnPurchaseInvoiceItem(
        'inv-1',
        'item-1',
        { quantity: 1 },
        'staff-1',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('returnPurchaseInvoiceItem partial return updates quantity and records return', async () => {
    const releaseOutQuantityForInvoiceItem = jest.fn().mockResolvedValue(undefined);
    const recalculateInvoiceTotals = jest.fn().mockResolvedValue(undefined);
    const invoiceItemUpdate = jest.fn().mockResolvedValue({ id: 'item-1', quantity: 1 });
    const returnCreate = jest.fn().mockResolvedValue({ id: 'ret-1' });
    const auditCreate = jest.fn().mockResolvedValue(undefined);
    const findUniqueOrThrow = jest.fn().mockResolvedValue({
      id: 'inv-1',
      patient: {},
      invoiceItems: [],
    });

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
              findUniqueOrThrow,
            },
            invoiceItem: {
              findFirst: jest.fn().mockResolvedValue({
                id: 'item-1',
                invoiceId: 'inv-1',
                purchaseItemId: 'pi-1',
                purchasesLocationId: 'loc-1',
                quantity: 2,
                isRecurringDaily: false,
                amountPaid: new Prisma.Decimal(0),
                _count: { allocations: 0 },
              }),
              update: invoiceItemUpdate,
              delete: jest.fn(),
            },
            invoicePurchaseItemReturn: { create: returnCreate },
            invoiceAuditLog: { create: auditCreate },
          };
          return cb(tx);
        }),
    };

    const service = createService(
      prisma,
      { releaseOutQuantityForInvoiceItem },
      { recalculateInvoiceTotals },
    );

    const result = await service.returnPurchaseInvoiceItem(
      'inv-1',
      'item-1',
      { quantity: 1, reason: 'test' },
      'staff-1',
    );

    expect(releaseOutQuantityForInvoiceItem).toHaveBeenCalledWith(
      expect.anything(),
      'item-1',
      1,
      'staff-1',
    );
    expect(invoiceItemUpdate).toHaveBeenCalledWith({
      where: { id: 'item-1' },
      data: { quantity: 1 },
    });
    expect(returnCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          purchaseItemId: 'pi-1',
          quantity: 1,
          purchasesLocationId: 'loc-1',
        }),
      }),
    );
    expect(auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: InvoiceAuditAction.PURCHASE_ITEM_RETURNED,
        }),
      }),
    );
    expect(result.fullLineRemoved).toBe(false);
    expect(result.returnId).toBe('ret-1');
  });

  it('returnPurchaseInvoiceItem rejects invoice without purchase lines', async () => {
    const prisma: any = {
      invoiceItem: { count: jest.fn().mockResolvedValue(0) },
    };
    const service = createService(prisma);
    await expect(
      service.returnPurchaseInvoiceItem(
        'inv-1',
        'item-1',
        { quantity: 1 },
        'staff-1',
      ),
    ).rejects.toThrow(NotFoundException);
  });
});
