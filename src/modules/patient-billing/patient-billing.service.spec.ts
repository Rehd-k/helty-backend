import { NotFoundException } from '@nestjs/common';
import { InvoicePaymentMethod, InvoiceStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PatientJwtPayload } from '../patient-auth/patient-auth.service';
import { PatientBillType } from './patient-billing.constants';
import { PatientBillingService } from './patient-billing.service';

describe('PatientBillingService', () => {
  const prisma = {
    invoice: {
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
    },
    invoicePayment: {
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
    },
  } as unknown as PrismaService;

  const service = new PatientBillingService(prisma);

  const patientUser: PatientJwtPayload = {
    sub: 'patient-uuid-1',
    patientId: 'AB12CD34',
    accountType: 'PATIENT',
  };

  const listInvoice = {
    id: 'inv-1',
    invoiceID: 'ISH-44021',
    status: InvoiceStatus.PENDING,
    totalAmount: new Prisma.Decimal('15000.00'),
    amountPaid: new Prisma.Decimal('0.00'),
    createdAt: new Date('2024-10-12T00:00:00.000Z'),
    encounter: null,
    invoiceItems: [
      {
        id: 'item-1',
        customDescription: null,
        quantity: 1,
        unitPrice: new Prisma.Decimal('15000.00'),
        amountPaid: new Prisma.Decimal('0.00'),
        isRecurringDaily: false,
        drugId: null,
        consumableId: null,
        purchaseItemId: null,
        service: { name: 'Cardiology Follow-up', category: { name: 'Consultation' } },
        drug: null,
        consumable: null,
        purchaseItem: null,
        usageSegments: [],
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns billing summary for unpaid invoices', async () => {
    prisma.invoice.findMany = jest.fn().mockResolvedValue([
      {
        totalAmount: new Prisma.Decimal('15000.00'),
        amountPaid: new Prisma.Decimal('0.00'),
        createdAt: new Date('2024-10-12T00:00:00.000Z'),
      },
    ]);

    const result = await service.getBillingSummary(patientUser);

    expect(prisma.invoice.findMany).toHaveBeenCalledWith({
      where: {
        patientId: 'patient-uuid-1',
        status: {
          in: [InvoiceStatus.PENDING, InvoiceStatus.PARTIALLY_PAID],
        },
      },
      select: {
        totalAmount: true,
        amountPaid: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });
    expect(result.totalOutstanding).toBe('15000.00');
    expect(result.unpaidInvoiceCount).toBe(1);
    expect(result.currency).toBe('NGN');
  });

  it('lists patient invoices with pagination', async () => {
    prisma.invoice.findMany = jest.fn().mockResolvedValue([listInvoice]);
    prisma.invoice.count = jest.fn().mockResolvedValue(1);

    const result = await service.listInvoices(patientUser, {
      page: 1,
      limit: 20,
    });

    expect(prisma.invoice.findMany).toHaveBeenCalledWith({
      where: { patientId: 'patient-uuid-1' },
      skip: 0,
      take: 20,
      orderBy: { createdAt: 'desc' },
      include: expect.any(Object),
    });
    expect(result.data[0]).toEqual(
      expect.objectContaining({
        id: 'inv-1',
        invoiceNumber: 'ISH-44021',
        title: 'Cardiology Follow-up',
        billType: PatientBillType.OUTPATIENT,
        balance: '15000.00',
      }),
    );
    expect(result.total).toBe(1);
  });

  it('filters unpaid invoices when status=UNPAID', async () => {
    prisma.invoice.findMany = jest.fn().mockResolvedValue([]);
    prisma.invoice.count = jest.fn().mockResolvedValue(0);

    await service.listInvoices(patientUser, { status: 'UNPAID' });

    expect(prisma.invoice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          patientId: 'patient-uuid-1',
          status: {
            in: [InvoiceStatus.PENDING, InvoiceStatus.PARTIALLY_PAID],
          },
        },
      }),
    );
  });

  it('returns invoice detail with breakdown for owned invoice', async () => {
    prisma.invoice.findFirst = jest.fn().mockResolvedValue({
      ...listInvoice,
      payments: [],
    });

    const result = await service.getInvoice(patientUser, 'inv-1');

    expect(prisma.invoice.findFirst).toHaveBeenCalledWith({
      where: { id: 'inv-1', patientId: 'patient-uuid-1' },
      include: expect.any(Object),
    });
    expect(result.breakdown).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'OTHER',
          items: expect.arrayContaining([
            expect.objectContaining({ description: 'Cardiology Follow-up' }),
          ]),
        }),
      ]),
    );
  });

  it('throws NotFoundException when invoice is not owned by patient', async () => {
    prisma.invoice.findFirst = jest.fn().mockResolvedValue(null);

    await expect(service.getInvoice(patientUser, 'missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('lists payment history scoped to patient', async () => {
    prisma.invoicePayment.findMany = jest.fn().mockResolvedValue([
      {
        id: 'pay-1',
        amount: new Prisma.Decimal('12200.00'),
        method: InvoicePaymentMethod.CARD,
        reference: '4111111111119012',
        paidAt: new Date('2024-09-24T00:00:00.000Z'),
        invoice: listInvoice,
      },
    ]);
    prisma.invoicePayment.count = jest.fn().mockResolvedValue(1);

    const result = await service.listPayments(patientUser, { page: 1, limit: 20 });

    expect(prisma.invoicePayment.findMany).toHaveBeenCalledWith({
      where: { invoice: { patientId: 'patient-uuid-1' } },
      skip: 0,
      take: 20,
      orderBy: { paidAt: 'desc' },
      include: expect.any(Object),
    });
    expect(result.data[0]).toEqual(
      expect.objectContaining({
        id: 'pay-1',
        status: 'SUCCESS',
        methodDetail: 'Card ID: **** 9012',
      }),
    );
  });

  it('returns receipt metadata with null url', async () => {
    prisma.invoicePayment.findFirst = jest.fn().mockResolvedValue({
      id: 'pay-1',
      amount: new Prisma.Decimal('12200.00'),
      method: InvoicePaymentMethod.CARD,
      paidAt: new Date('2024-09-24T00:00:00.000Z'),
      invoice: { invoiceID: 'ISH-44021' },
    });

    const result = await service.getReceipt(patientUser, 'pay-1');

    expect(result).toEqual(
      expect.objectContaining({
        id: 'pay-1',
        invoiceNumber: 'ISH-44021',
        url: null,
      }),
    );
  });

  it('throws NotFoundException when receipt is not found', async () => {
    prisma.invoicePayment.findFirst = jest.fn().mockResolvedValue(null);

    await expect(service.getReceipt(patientUser, 'missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
