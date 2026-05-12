import { NotFoundException } from '@nestjs/common';
import { InvoiceConsumableService } from './invoice-consumable.service';
import { InvoiceService } from './invoice.service';

describe('InvoiceConsumableService', () => {
  it('returnConsumableInvoiceItem rejects when invoice has no consumable lines', async () => {
    const prisma = {
      invoiceItem: { count: jest.fn().mockResolvedValue(0) },
    } as any;
    const stock = {} as any;
    const invoiceService = {} as InvoiceService;
    const svc = new InvoiceConsumableService(prisma, stock, invoiceService);
    await expect(
      svc.returnConsumableInvoiceItem('inv-1', 'item-1', { quantity: 1 }, 'staff-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
