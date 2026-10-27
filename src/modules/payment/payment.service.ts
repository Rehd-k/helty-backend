import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  InvoicePaymentMethod,
  InvoicePaymentSource,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { InvoiceService } from '../invoice/invoice.service';
import { CreatePaymentDto, UpdatePaymentDto } from './dto/create-payment.dto';
import { DateRangeSkipTakeDto } from '../../common/dto/date-range.dto';
import { parseDateRange } from '../../common/utils/date-range';
import { RecordInvoicePaymentDto } from '../invoice/dto/invoice.dto';
import { UpdateInvoicePaymentDto } from './dto/invoice-payment.dto';
import { staffBriefSelect } from '../../common/constants/staff-select.constants';

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
          createdBy: { select: staffBriefSelect },
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
        createdBy: { select: staffBriefSelect },
        updatedBy: { select: staffBriefSelect },
      },
    });
  }

  async findByPatientId(patientId: string) {
    return this.prisma.payment.findMany({
      where: { patientId },
      orderBy: { date: 'desc' },
      include: {
        patient: true,
        createdBy: { select: staffBriefSelect },
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

  async update(
    id: string,
    updatePaymentDto: UpdatePaymentDto,
    staffId?: string,
  ) {
    return this.prisma.payment.update({
      where: { id },
      data: {
        ...updatePaymentDto,
        ...(staffId ? { updatedById: staffId } : {}),
      },
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
    const existing = await this.findInvoicePaymentById(id);

    const data: Prisma.InvoicePaymentUpdateInput = {};
    const accountNumber = dto.bankAccountNumber?.trim() || undefined;
    const classification = this.resolveReclassification(dto.source, dto.method);

    if (
      classification &&
      (this.isLockedSource(existing.source) ||
        (existing.method != null && this.isLockedMethod(existing.method)))
    ) {
      throw new BadRequestException(
        `Cannot change the method of a ${existing.source} payment. Void it and record a new payment instead.`,
      );
    }

    const hasPatch =
      dto.reference !== undefined ||
      dto.notes !== undefined ||
      dto.paidAt !== undefined ||
      dto.receivedById !== undefined ||
      dto.bankId !== undefined ||
      classification != null ||
      accountNumber !== undefined;
    if (!hasPatch) {
      return existing;
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
          throw new NotFoundException(`Staff "${dto.receivedById}" not found.`);
        }
        data.receivedBy = { connect: { id: dto.receivedById } };
      } else {
        data.receivedBy = { disconnect: true };
      }
    }

    if (classification) {
      data.source = classification.source;
      data.method = classification.method;
    }

    const effectiveSource = classification?.source ?? existing.source;
    const reclassifyingToBank =
      classification != null &&
      (effectiveSource === InvoicePaymentSource.CARD ||
        effectiveSource === InvoicePaymentSource.TRANSFER);

    if (classification?.source === InvoicePaymentSource.CASH) {
      if (existing.bankId) {
        data.bank = { disconnect: true };
      }
    } else if (
      (effectiveSource === InvoicePaymentSource.CARD ||
        effectiveSource === InvoicePaymentSource.TRANSFER) &&
      (reclassifyingToBank || accountNumber !== undefined || dto.bankId !== undefined)
    ) {
      if (accountNumber) {
        const bankId = await this.findBankIdByAccountNumber(accountNumber);
        data.bank = { connect: { id: bankId } };
      } else if (dto.bankId) {
        await this.assertBankExists(dto.bankId);
        data.bank = { connect: { id: dto.bankId } };
      } else if (reclassifyingToBank && !existing.bankId) {
        throw new BadRequestException(
          'A registered bank is required for card and transfer payments.',
        );
      } else if (dto.bankId === null) {
        throw new BadRequestException(
          'A registered bank is required for card and transfer payments.',
        );
      }
    } else if (accountNumber) {
      throw new BadRequestException(
        'A bank account applies only to card and transfer payments.',
      );
    } else if (dto.bankId !== undefined) {
      if (dto.bankId) {
        await this.assertBankExists(dto.bankId);
        data.bank = { connect: { id: dto.bankId } };
      } else if (existing.bankId) {
        data.bank = { disconnect: true };
      }
    }

    return this.prisma.invoicePayment.update({
      where: { id },
      data,
      include: invoicePaymentDetailInclude,
    });
  }

  private isLockedSource(source: InvoicePaymentSource): boolean {
    return (
      source === InvoicePaymentSource.WALLET ||
      source === InvoicePaymentSource.INSURANCE ||
      source === InvoicePaymentSource.WAIVER
    );
  }

  private isLockedMethod(method: InvoicePaymentMethod): boolean {
    return (
      method === InvoicePaymentMethod.WALLET ||
      method === InvoicePaymentMethod.INSURANCE ||
      method === InvoicePaymentMethod.WAIVER
    );
  }

  /**
   * Cash, card, and transfer must be stored as a matching source/method pair.
   * Returns null when the caller is not reclassifying the payment.
   */
  private resolveReclassification(
    source?: InvoicePaymentSource,
    method?: InvoicePaymentMethod,
  ): { source: InvoicePaymentSource; method: InvoicePaymentMethod } | null {
    if (source === undefined && method === undefined) return null;

    if (source && this.isLockedSource(source)) {
      throw new BadRequestException(
        `Cannot change a payment to ${source}.`,
      );
    }
    if (method && this.isLockedMethod(method)) {
      throw new BadRequestException(
        `Cannot change a payment to ${method}.`,
      );
    }

    const methodForSource = (
      value: InvoicePaymentSource,
    ): InvoicePaymentMethod => {
      switch (value) {
        case InvoicePaymentSource.CASH:
          return InvoicePaymentMethod.CASH;
        case InvoicePaymentSource.CARD:
          return InvoicePaymentMethod.CARD;
        case InvoicePaymentSource.TRANSFER:
          return InvoicePaymentMethod.TRANSFER;
        default:
          throw new BadRequestException(
            `Cannot change a payment to ${value}.`,
          );
      }
    };

    const sourceForMethod = (
      value: InvoicePaymentMethod,
    ): InvoicePaymentSource => {
      switch (value) {
        case InvoicePaymentMethod.CASH:
          return InvoicePaymentSource.CASH;
        case InvoicePaymentMethod.CARD:
          return InvoicePaymentSource.CARD;
        case InvoicePaymentMethod.TRANSFER:
          return InvoicePaymentSource.TRANSFER;
        default:
          throw new BadRequestException(
            `Cannot change a payment to ${value}.`,
          );
      }
    };

    const resolvedSource = source ?? sourceForMethod(method!);
    const resolvedMethod = method ?? methodForSource(resolvedSource);
    if (resolvedMethod !== methodForSource(resolvedSource)) {
      throw new BadRequestException(
        `Payment method ${resolvedMethod} does not match source ${resolvedSource}.`,
      );
    }
    return { source: resolvedSource, method: resolvedMethod };
  }

  private async findBankIdByAccountNumber(
    accountNumber: string,
  ): Promise<string> {
    const bank = await this.prisma.bank.findUnique({
      where: { accountNumber },
      select: { id: true },
    });
    if (!bank) {
      throw new NotFoundException(
        `No bank found with account number "${accountNumber}".`,
      );
    }
    return bank.id;
  }

  private async assertBankExists(bankId: string): Promise<void> {
    const bank = await this.prisma.bank.findUnique({
      where: { id: bankId },
      select: { id: true },
    });
    if (!bank) {
      throw new NotFoundException(`Bank "${bankId}" not found.`);
    }
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
