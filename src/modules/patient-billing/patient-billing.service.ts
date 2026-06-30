import { Injectable, NotFoundException } from '@nestjs/common';
import { InvoiceStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PatientJwtPayload } from '../patient-auth/patient-auth.service';
import { ListInvoicesQueryDto } from './dto/list-invoices-query.dto';
import { ListPaymentsQueryDto } from './dto/list-payments-query.dto';
import {
  buildBillingSummary,
  toInvoiceDetailDto,
  toInvoiceSummaryDto,
  toPaymentHistoryItemDto,
  toReceiptResponseDto,
} from './patient-billing.util';

const INVOICE_LIST_INCLUDE = {
  encounter: {
    include: {
      admission: {
        include: {
          wardEntity: { select: { name: true } },
        },
      },
    },
  },
  invoiceItems: {
    orderBy: { createdAt: 'asc' as const },
    include: {
      service: { include: { category: { select: { name: true } } } },
      drug: { select: { brandName: true, genericName: true, strength: true } },
      consumable: { select: { name: true } },
      purchaseItem: { select: { itemName: true } },
      usageSegments: { orderBy: { startAt: 'asc' as const } },
    },
  },
} satisfies Prisma.InvoiceInclude;

const INVOICE_DETAIL_INCLUDE = {
  ...INVOICE_LIST_INCLUDE,
  payments: { orderBy: { paidAt: 'desc' as const } },
} satisfies Prisma.InvoiceInclude;

const PAYMENT_LIST_INCLUDE = {
  invoice: {
    include: INVOICE_LIST_INCLUDE,
  },
} satisfies Prisma.InvoicePaymentInclude;

type InvoiceListPayload = Prisma.InvoiceGetPayload<{
  include: typeof INVOICE_LIST_INCLUDE;
}>;

type InvoiceDetailPayload = Prisma.InvoiceGetPayload<{
  include: typeof INVOICE_DETAIL_INCLUDE;
}>;

type PaymentListPayload = Prisma.InvoicePaymentGetPayload<{
  include: typeof PAYMENT_LIST_INCLUDE;
}>;

@Injectable()
export class PatientBillingService {
  constructor(private readonly prisma: PrismaService) {}

  async getBillingSummary(user: PatientJwtPayload) {
    const unpaidInvoices = await this.prisma.invoice.findMany({
      where: {
        patientId: user.sub,
        status: { in: [InvoiceStatus.PENDING, InvoiceStatus.PARTIALLY_PAID] },
      },
      select: {
        totalAmount: true,
        amountPaid: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    return buildBillingSummary(unpaidInvoices);
  }

  async listInvoices(user: PatientJwtPayload, query: ListInvoicesQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.InvoiceWhereInput = { patientId: user.sub };
    if (query.status === 'UNPAID') {
      where.status = { in: [InvoiceStatus.PENDING, InvoiceStatus.PARTIALLY_PAID] };
    } else if (query.status) {
      where.status = query.status;
    }

    const [invoices, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: INVOICE_LIST_INCLUDE,
      }),
      this.prisma.invoice.count({ where }),
    ]);

    return {
      data: invoices.map((invoice) =>
        toInvoiceSummaryDto(invoice as InvoiceListPayload),
      ),
      total,
      page,
      limit,
    };
  }

  async getInvoice(user: PatientJwtPayload, id: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, patientId: user.sub },
      include: INVOICE_DETAIL_INCLUDE,
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    return toInvoiceDetailDto(invoice as InvoiceDetailPayload);
  }

  async listPayments(user: PatientJwtPayload, query: ListPaymentsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.InvoicePaymentWhereInput = {
      invoice: { patientId: user.sub },
    };

    const [payments, total] = await Promise.all([
      this.prisma.invoicePayment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { paidAt: 'desc' },
        include: PAYMENT_LIST_INCLUDE,
      }),
      this.prisma.invoicePayment.count({ where }),
    ]);

    return {
      data: payments.map((payment) =>
        toPaymentHistoryItemDto(payment as PaymentListPayload),
      ),
      total,
      page,
      limit,
    };
  }

  async getReceipt(user: PatientJwtPayload, paymentId: string) {
    const payment = await this.prisma.invoicePayment.findFirst({
      where: {
        id: paymentId,
        invoice: { patientId: user.sub },
      },
      include: {
        invoice: { select: { invoiceID: true } },
      },
    });

    if (!payment) {
      throw new NotFoundException('Receipt not found');
    }

    return toReceiptResponseDto(payment);
  }
}
