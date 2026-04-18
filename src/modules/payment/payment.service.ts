import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { InvoiceService } from '../invoice/invoice.service';
import { CreatePaymentDto, UpdatePaymentDto } from './dto/create-payment.dto';
import { DateRangeSkipTakeDto } from '../../common/dto/date-range.dto';
import { parseDateRange } from '../../common/utils/date-range';
import { RecordInvoicePaymentDto } from '../invoice/dto/invoice.dto';
import { UpdateInvoicePaymentDto } from './dto/invoice-payment.dto';

const invoicePaymentDetailInclude = {
  walletTransaction: true,
  receivedBy: { select: { id: true, firstName: true, lastName: true } },
  bank: { select: { id: true, name: true, accountNumber: true } },
  createdBy: { select: { id: true, firstName: true, lastName: true } },
  itemAllocations: {
    include: {
      invoiceItem: {
        select: {
          id: true,
          quantity: true,
          unitPrice: true,
          amountPaid: true,
          customDescription: true,
          service: { select: { id: true, name: true } },
          drug: {
            select: { id: true, genericName: true, brandName: true },
          },
        },
      },
    },
  },
  invoice: {
    select: {
      id: true,
      invoiceID: true,
      patientId: true,
      status: true,
      totalAmount: true,
      amountPaid: true,
    },
  },
} satisfies Prisma.InvoicePaymentInclude;

@Injectable()
export class PaymentService {
  constructor(
    private prisma: PrismaService,
    private readonly invoiceService: InvoiceService,
  ) {}

  async create(createPaymentDto: CreatePaymentDto) {
    return this.prisma.payment.create({
      data: {
        patientId: createPaymentDto.patientId,
        amount: createPaymentDto.amount,
        method: createPaymentDto.method,
        description: createPaymentDto.description,
        createdById: '',
      },
    });
  }

  async findAll(query: DateRangeSkipTakeDto) {
    const { skip = 0, take = 20, fromDate, toDate } = query;
    const { from, to } = parseDateRange(fromDate, toDate);
    const [payments, total] = await Promise.all([
      this.prisma.payment.findMany({
        where: { date: { gte: from, lte: to } },
        skip,
        take,
        include: {
          patient: true,
        },
        orderBy: { date: 'desc' },
      }),
      this.prisma.payment.count({ where: { date: { gte: from, lte: to } } }),
    ]);

    return { payments, total, skip, take };
  }

  async findOne(id: string) {
    return this.prisma.payment.findUnique({
      where: { id },
      include: {
        patient: true,
      },
    });
  }

  async findByPatientId(patientId: string) {
    return this.prisma.payment.findMany({
      where: { patientId },
      orderBy: { date: 'desc' },
      include: {
        patient: true,
      },
    });
  }

  async getTotalPaymentsByPatient(patientId: string) {
    const result = await this.prisma.payment.aggregate({
      where: { patientId },
      _sum: { amount: true },
      _count: true,
    });

    return {
      totalAmount: result._sum.amount || 0,
      paymentCount: result._count,
      patientId,
    };
  }

  async update(id: string, updatePaymentDto: UpdatePaymentDto) {
    return this.prisma.payment.update({
      where: { id },
      data: updatePaymentDto,
    });
  }

  async remove(id: string) {
    return this.prisma.payment.delete({
      where: { id },
    });
  }

  // ─── InvoicePayment (billing) ─────────────────────────────────────────────

  async findInvoicePaymentById(id: string) {
    const row = await this.prisma.invoicePayment.findUnique({
      where: { id },
      include: invoicePaymentDetailInclude,
    });
    if (!row) {
      throw new NotFoundException(`Invoice payment "${id}" not found`);
    }
    return row;
  }

  async recordInvoicePayment(
    invoiceId: string,
    dto: RecordInvoicePaymentDto,
    createdByStaffId?: string,
  ) {
    return this.invoiceService.recordPayment(invoiceId, dto, createdByStaffId);
  }

  async updateInvoicePayment(id: string, dto: UpdateInvoicePaymentDto) {
    await this.findInvoicePaymentById(id);

    const data: Prisma.InvoicePaymentUpdateInput = {};

    const hasPatch =
      dto.reference !== undefined ||
      dto.notes !== undefined ||
      dto.paidAt !== undefined ||
      dto.receivedById !== undefined ||
      dto.bankId !== undefined;
    if (!hasPatch) {
      return this.prisma.invoicePayment.findUniqueOrThrow({
        where: { id },
        include: invoicePaymentDetailInclude,
      });
    }

    if (dto.reference !== undefined) {
      data.reference = dto.reference;
    }
    if (dto.notes !== undefined) {
      data.notes = dto.notes;
    }
    if (dto.paidAt !== undefined) {
      data.paidAt = new Date(dto.paidAt);
    }

    if (dto.receivedById !== undefined) {
      if (dto.receivedById) {
        const staff = await this.prisma.staff.findUnique({
          where: { id: dto.receivedById },
          select: { id: true },
        });
        if (!staff) {
          throw new NotFoundException(
            `Staff "${dto.receivedById}" not found.`,
          );
        }
        data.receivedBy = { connect: { id: dto.receivedById } };
      } else {
        data.receivedBy = { disconnect: true };
      }
    }

    if (dto.bankId !== undefined) {
      if (dto.bankId) {
        const bank = await this.prisma.bank.findUnique({
          where: { id: dto.bankId },
          select: { id: true },
        });
        if (!bank) {
          throw new NotFoundException(`Bank "${dto.bankId}" not found.`);
        }
        data.bank = { connect: { id: dto.bankId } };
      } else {
        data.bank = { disconnect: true };
      }
    }

    return this.prisma.invoicePayment.update({
      where: { id },
      data,
      include: invoicePaymentDetailInclude,
    });
  }

  async removeInvoicePayment(
    id: string,
    performedByStaffId?: string,
    reason?: string,
  ) {
    return this.invoiceService.voidInvoicePayment(
      id,
      performedByStaffId,
      reason,
    );
  }
}
