import { randomBytes } from 'crypto';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  InvoicePaymentSource,
  InvoiceStatus,
  PatientStatus,
  Prisma,
  TransactionAuditAction,
  TransactionStatus,
  WalletTransactionType,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AddInvoiceItemDto,
  AllocateInvoiceItemPaymentDto,
  CreateInvoiceDto,
  RecordInvoicePaymentDto,
  UpdateInvoiceDto,
  UpdateInvoiceItemDto,
  WalletDepositDto,
} from './dto/invoice.dto';
import { DateRangeSkipTakeDto } from '../../common/dto/date-range.dto';
import { parseDateRange } from '../../common/utils/date-range';

const TXN_ID_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function generateBillingTransactionId(): string {
  const buf = randomBytes(10);
  let s = '';
  for (let i = 0; i < 10; i++) {
    s += TXN_ID_ALPHABET[buf[i]! % TXN_ID_ALPHABET.length];
  }
  return s;
}

@Injectable()
export class InvoiceService {
  constructor(private readonly prisma: PrismaService) { }

  private readonly dayMs = 24 * 60 * 60 * 1000;

  /** At most one open bill per patient: PENDING or PARTIALLY_PAID (not PAID). */
  private async findOpenInvoiceForPatient(patientId: string) {
    return this.prisma.invoice.findFirst({
      where: {
        patientId,
        status: {
          in: [InvoiceStatus.PENDING, InvoiceStatus.PARTIALLY_PAID],
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  private assertInvoiceNotPaid(status: InvoiceStatus) {
    if (status === InvoiceStatus.PAID) {
      throw new BadRequestException(
        'This invoice is paid and cannot be modified.',
      );
    }
  }

  private asDecimal(value: number | string | Prisma.Decimal) {
    return value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value);
  }

  private async ensureWallet(
    patientId: string,
    tx: Prisma.TransactionClient = this.prisma,
  ) {
    return tx.patientWallet.upsert({
      where: { patientId },
      update: {},
      create: { patientId },
    });
  }

  /**
   * Billable day count per usage segment.
   * - Closed segments: ceil(partial 24h periods) so a same-day partial still counts as one day.
   * - Open (active) segments: floor only — avoids charging a full day the instant a segment
   *   starts (resume uses startAt ≈ now; ceil(milliseconds/24h) === 1). Full days accrue after
   *   each completed 24h; pausing closes the segment and ceil applies to that final stretch.
   */
  private computeRecurringDays(
    segments: Array<{ startAt: Date; endAt: Date | null }>,
    now: Date,
  ) {
    let totalDays = 0;
    for (const segment of segments) {
      const endAt = segment.endAt ?? now;
      const duration = endAt.getTime() - segment.startAt.getTime();
      if (duration <= 0) continue;
      const isOpen = segment.endAt === null;
      const days = isOpen
        ? Math.floor(duration / this.dayMs)
        : Math.ceil(duration / this.dayMs);
      totalDays += days;
    }
    return totalDays;
  }

  private invoiceLineTotal(
    item: {
      unitPrice: Prisma.Decimal;
      quantity: number;
      isRecurringDaily: boolean;
      usageSegments: Array<{ startAt: Date; endAt: Date | null }>;
    },
    now: Date,
  ) {
    const unitPrice = this.asDecimal(item.unitPrice);
    if (item.isRecurringDaily) {
      const totalDays = this.computeRecurringDays(item.usageSegments, now);
      return unitPrice.mul(totalDays);
    }
    return unitPrice.mul(item.quantity);
  }

  private billingTxnStatus(
    totalAmount: Prisma.Decimal,
    discountAmount: Prisma.Decimal,
    insuranceCovered: Prisma.Decimal,
    amountPaid: Prisma.Decimal,
    previousStatus: TransactionStatus,
  ): TransactionStatus {
    if (previousStatus === TransactionStatus.CANCELLED) {
      return TransactionStatus.CANCELLED;
    }
    const outstanding = totalAmount
      .sub(discountAmount)
      .sub(insuranceCovered)
      .sub(amountPaid);
    if (outstanding.lte(0) && totalAmount.gt(0)) {
      return TransactionStatus.PAID;
    }
    if (amountPaid.gt(0)) {
      return TransactionStatus.PARTIALLY_PAID;
    }
    if (totalAmount.gt(0)) {
      return TransactionStatus.ACTIVE;
    }
    return TransactionStatus.DRAFT;
  }

  async recalculateInvoiceTotals(
    invoiceId: string,
    tx: Prisma.TransactionClient = this.prisma,
    now: Date = new Date(),
  ) {
    const invoice = await tx.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        invoiceItems: {
          include: {
            usageSegments: {
              orderBy: { startAt: 'asc' },
            },
          },
        },
      },
    });
    if (!invoice) throw new NotFoundException(`Invoice ${invoiceId} not found`);

    const totalAmount = invoice.invoiceItems.reduce((sum, item) => {
      const unitPrice = this.asDecimal(item.unitPrice);
      if (item.isRecurringDaily) {
        const totalDays = this.computeRecurringDays(item.usageSegments, now);
        return sum.add(unitPrice.mul(totalDays));
      }
      return sum.add(unitPrice.mul(item.quantity));
    }, new Prisma.Decimal(0));

    const amountPaid = this.asDecimal(invoice.amountPaid);
    let status: InvoiceStatus = InvoiceStatus.PENDING;
    if (totalAmount.gt(0) && amountPaid.gte(totalAmount)) {
      status = InvoiceStatus.PAID;
    } else if (amountPaid.gt(0)) {
      status = InvoiceStatus.PARTIALLY_PAID;
    }

    return tx.invoice.update({
      where: { id: invoiceId },
      data: { totalAmount, status },
    });
  }

  // ─── Invoice CRUD ─────────────────────────────────────────────────────────────

  private static readonly invoiceCreateInclude = {
    patient: {
      select: { id: true, patientId: true, firstName: true, surname: true },
    },
    createdBy: { select: { id: true, firstName: true, lastName: true } },
    invoiceItems: {
      include: {
        service: { select: { id: true, name: true, cost: true } },
      },
    },
  } satisfies Prisma.InvoiceInclude;

  /**
   * Create a new invoice for a patient.
   * If the patient already has a PENDING or PARTIALLY_PAID invoice, that invoice
   * is returned and updated (staff/encounter) instead of creating another.
   * After the bill is PAID, a new invoice must be created for new charges.
   * The authenticated staff member is recorded as `createdBy` on new invoices,
   * or `updatedBy` when reusing an open invoice.
   */
  async create(dto: CreateInvoiceDto, req: any) {
    const existing = await this.findOpenInvoiceForPatient(dto.patientId);
    if (existing) {
      await this.prisma.invoice.update({
        where: { id: existing.id },
        data: {
          ...(dto.staffId !== undefined && { staffId: dto.staffId }),
          ...(dto.encounterId !== undefined && { encounterId: dto.encounterId }),
          updatedById: req.user.sub,
        },
      });
      await this.recalculateInvoiceTotals(existing.id);
      return this.prisma.invoice.findUniqueOrThrow({
        where: { id: existing.id },
        include: InvoiceService.invoiceCreateInclude,
      });
    }

    return this.prisma.invoice.create({
      data: {
        patientId: dto.patientId,
        status: dto.status ?? InvoiceStatus.PENDING,
        createdById: req.user.sub,
        staffId: dto.staffId ?? '',
        encounterId: dto.encounterId ?? undefined,
      },
      include: InvoiceService.invoiceCreateInclude,
    });
  }

  /** Query params may send booleans as strings (`?allowIP=true`). */
  private parseAllowInpatient(value: unknown): boolean {
    if (value === true) return true;
    if (value === false || value === undefined || value === null) return false;
    if (typeof value === 'string') return value.toLowerCase() === 'true';
    return Boolean(value);
  }

  private invoiceListWhere(
    from: Date,
    to: Date,
    allowInpatient: boolean,
    rawQuery?: string,
    category?: string,
  ): Prisma.InvoiceWhereInput {
    const patientStatus = allowInpatient
      ? PatientStatus.ADMITED
      : PatientStatus.OUTPATIENT;
    const createdAt: Prisma.DateTimeFilter = { gte: from, lte: to };
    const q = rawQuery?.trim();
    if (!q) {
      return { createdAt, patient: { status: patientStatus } };
    }

    const needle = { contains: q, mode: 'insensitive' as const };

    if (category === 'patientId') {
      return {
        createdAt,
        patient: { status: patientStatus, patientId: needle },
      };
    }
    if (category === 'fullName') {
      return {
        createdAt,
        patient: {
          status: patientStatus,
          OR: [{ firstName: needle }, { surname: needle }],
        },
      };
    }
    if (category === 'service') {
      return {
        createdAt,
        patient: { status: patientStatus },
        invoiceItems: {
          some: { service: { name: needle } },
        },
      };
    }
    if (category) {
      return { createdAt, patient: { status: patientStatus } };
    }

    return {
      createdAt,
      AND: [
        { patient: { status: patientStatus } },
        {
          OR: [
            {
              patient: {
                OR: [
                  { firstName: needle },
                  { surname: needle },
                  { patientId: needle },
                ],
              },
            },
            {
              invoiceItems: {
                some: { service: { name: needle } },
              },
            },
          ],
        },
      ],
    };
  }

  private static readonly invoiceFindAllInclude = {
    staff: {
      select: { id: true, firstName: true, lastName: true },
    },
    invoiceItems: {
      include: {
        service: {
          select: { id: true, name: true, cost: true },
        },
        drug: {
          select: {
            id: true,
            genericName: true,
            brandName: true,
            strength: true,
            dosageForm: true,
          },
        },
      },
    },
    patient: {
      select: {
        id: true,
        patientId: true,
        firstName: true,
        surname: true,
      },
    },
    createdBy: { select: { id: true, firstName: true, lastName: true } },
    _count: { select: { invoiceItems: true } },
  } satisfies Prisma.InvoiceInclude;

  /**
   * Paginated list of all invoices, most-recent first.
   * Inpatient vs outpatient is enforced via the related patient's `status`
   * (`ADMITED` when allowIP is true, otherwise `OUTPATIENT`).
   */
  async findAll(
    params: DateRangeSkipTakeDto & {
      search?: string;
      category?: string;
      query?: string;
      allowIP: boolean;
    },
  ) {
    const { skip = 0, take = 20, fromDate, toDate, query, category } = params;
    const { from, to } = parseDateRange(fromDate, toDate);
    const allowInpatient = this.parseAllowInpatient(params.allowIP);
    const where = this.invoiceListWhere(from, to, allowInpatient, query, category);

    const [invoices, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: InvoiceService.invoiceFindAllInclude,
      }),
      this.prisma.invoice.count({ where }),
    ]);

    return { invoices, total, skip, take };
  }


  async findByPatient(patientId: string) {
    const invoices = await this.prisma.invoice.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        invoiceItems: {
          include: {
            service: { select: { id: true, name: true, cost: true } },
          },
        },
      },
    });
    return Promise.all(invoices.map((invoice) => this.findOne(invoice.id)));
  }

  /**
   * Full invoice detail with computed `totalAmount`.
   */
  async findOne(id: string) {
    await this.recalculateInvoiceTotals(id);
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: {
        patient: {
          select: {
            id: true,
            patientId: true,
            firstName: true,
            surname: true,
            phoneNumber: true,
          },
        },
        createdBy: {
          select: { id: true, firstName: true, lastName: true, role: true },
        },
        updatedBy: {
          select: { id: true, firstName: true, lastName: true, role: true },
        },
        staff: {
          select: { id: true, firstName: true, lastName: true, role: true },
        },
        invoiceItems: {
          include: {
            service: {
              select: {
                id: true,
                name: true,
                description: true,
                cost: true,
                category: { select: { id: true, name: true } },
                department: { select: { id: true, name: true } },
              },
            },
            usageSegments: true,
          },
        },
        payments: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!invoice) throw new NotFoundException(`Invoice ${id} not found`);
    const amountDue = this.asDecimal(invoice.totalAmount).sub(invoice.amountPaid);
    const now = new Date();
    const invoiceItems = invoice.invoiceItems.map((item) => {
      const lineTotal = this.invoiceLineTotal(item, now);
      const paid = this.asDecimal(item.amountPaid);
      return {
        ...item,
        lineTotal,
        lineAmountDue: lineTotal.sub(paid),
      };
    });
    return { ...invoice, invoiceItems, amountDue };
  }

  /**
   * Update invoice status or associated staff.
   * Authenticated staff member is recorded as `updatedBy`.
   */
  async update(id: string, dto: UpdateInvoiceDto, req: any) {
    await this.findOne(id);
    return this.prisma.invoice.update({
      where: { id },
      data: {
        status: dto.status,
        staffId: dto.staffId,
        updatedById: req.user.sub,
      },
      include: {
        patient: {
          select: { id: true, patientId: true, firstName: true, surname: true },
        },
        updatedBy: { select: { id: true, firstName: true, lastName: true } },
        invoiceItems: {
          include: {
            service: { select: { id: true, name: true, cost: true } },
          },
        },
      },
    });
  }

  /**
   * Delete an invoice. Fails if it still has line items.
   */
  async remove(id: string) {
    await this.findOne(id);
    const itemCount = await this.prisma.invoiceItem.count({
      where: { invoiceId: id },
    });
    if (itemCount > 0) {
      throw new BadRequestException(
        `Cannot delete invoice: it has ${itemCount} line item(s). Remove them first.`,
      );
    }
    return this.prisma.invoice.delete({ where: { id } });
  }

  // ─── InvoiceItem CRUD ──────────────────────────────────────────────────────────

  /**
   * Add a service as a line item to an invoice.
   * Both invoice and service are validated to exist.
   */
  async addItem(invoiceId: string, dto: AddInvoiceItemDto) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
    });
    if (!invoice) throw new NotFoundException(`Invoice ${invoiceId} not found`);
    this.assertInvoiceNotPaid(invoice.status);

    const service = await this.prisma.service.findUnique({
      where: { id: dto.serviceId },
    });
    if (!service)
      throw new NotFoundException(`Service ${dto.serviceId} not found`);

    const item = await this.prisma.invoiceItem.create({
      data: {
        invoiceId,
        serviceId: dto.serviceId,
        quantity: dto.quantity ?? 1,
        unitPrice: this.asDecimal(dto.unitPrice ?? service.cost),
        isRecurringDaily: dto.isRecurringDaily ?? false,
      },
      include: {
        service: {
          select: { id: true, name: true, description: true, cost: true },
        },
        invoice: { select: { id: true, status: true, patientId: true } },
      },
    })
    if (item.isRecurringDaily) {
      console.log("dto.recurringSegmentStartAt", dto.recurringSegmentStartAt);
      const startAt = dto.recurringSegmentStartAt
        ? new Date(dto.recurringSegmentStartAt)
        : new Date();
      if (Number.isNaN(startAt.getTime())) {
        throw new BadRequestException(
          'recurringSegmentStartAt must be a valid ISO 8601 date string',
        );
      }
      await this.prisma.invoiceItemUsageSegment.create({
        data: { invoiceItemId: item.id, startAt },
      });
    }

    await this.recalculateInvoiceTotals(invoiceId);
    return item;
  }

  /**
   * Update a line item's quantity or price snapshot.
   */
  async updateItem(
    invoiceId: string,
    itemId: string,
    dto: UpdateInvoiceItemDto,
  ) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
    });
    if (!invoice) throw new NotFoundException(`Invoice ${invoiceId} not found`);
    this.assertInvoiceNotPaid(invoice.status);

    const existing = await this.prisma.invoiceItem.findFirst({
      where: { id: itemId, invoiceId },
    });
    if (!existing) {
      throw new NotFoundException(
        `Invoice item ${itemId} not found on invoice ${invoiceId}`,
      );
    }

    const updated = await this.prisma.invoiceItem.update({
      where: { id: itemId },
      data: {
        quantity: dto.quantity ?? existing.quantity,
        unitPrice:
          dto.unitPrice !== undefined
            ? this.asDecimal(dto.unitPrice)
            : existing.unitPrice,
      },
      include: {
        service: { select: { id: true, name: true, cost: true } },
      },
    });
    await this.recalculateInvoiceTotals(invoiceId);
    return updated;
  }

  /**
   * Remove a line item from an invoice.
   */
  async removeItem(invoiceId: string, itemId: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
    });
    if (!invoice) throw new NotFoundException(`Invoice ${invoiceId} not found`);
    this.assertInvoiceNotPaid(invoice.status);

    const existing = await this.prisma.invoiceItem.findFirst({
      where: { id: itemId, invoiceId },
    });
    if (!existing) {
      throw new NotFoundException(
        `Invoice item ${itemId} not found on invoice ${invoiceId}`,
      );
    }
    const deleted = await this.prisma.invoiceItem.delete({ where: { id: itemId } });
    await this.recalculateInvoiceTotals(invoiceId);
    return deleted;
  }

  async pauseRecurringItem(invoiceId: string, itemId: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
    });
    if (!invoice) throw new NotFoundException(`Invoice ${invoiceId} not found`);
    this.assertInvoiceNotPaid(invoice.status);

    const item = await this.prisma.invoiceItem.findFirst({
      where: { id: itemId, invoiceId },
    });
    if (!item) {
      throw new NotFoundException(
        `Invoice item ${itemId} not found on invoice ${invoiceId}`,
      );
    }
    if (!item.isRecurringDaily) {
      throw new BadRequestException('Only recurring daily items can be paused');
    }

    const openSegment = await this.prisma.invoiceItemUsageSegment.findFirst({
      where: { invoiceItemId: itemId, endAt: null },
      orderBy: { startAt: 'desc' },
    });
    if (!openSegment) {
      throw new BadRequestException('Recurring item is already paused');
    }

    await this.prisma.invoiceItemUsageSegment.update({
      where: { id: openSegment.id },
      data: { endAt: new Date() },
    });
    await this.recalculateInvoiceTotals(invoiceId);
    return { message: 'Recurring item paused' };
  }

  async resumeRecurringItem(invoiceId: string, itemId: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
    });
    if (!invoice) throw new NotFoundException(`Invoice ${invoiceId} not found`);
    this.assertInvoiceNotPaid(invoice.status);

    const item = await this.prisma.invoiceItem.findFirst({
      where: { id: itemId, invoiceId },
    });
    if (!item) {
      throw new NotFoundException(
        `Invoice item ${itemId} not found on invoice ${invoiceId}`,
      );
    }
    if (!item.isRecurringDaily) {
      throw new BadRequestException('Only recurring daily items can be resumed');
    }

    const openSegment = await this.prisma.invoiceItemUsageSegment.findFirst({
      where: { invoiceItemId: itemId, endAt: null },
    });
    if (openSegment) {
      throw new BadRequestException('Recurring item is already active');
    }

    await this.prisma.invoiceItemUsageSegment.create({
      data: { invoiceItemId: itemId, startAt: new Date() },
    });
    await this.recalculateInvoiceTotals(invoiceId);
    return { message: 'Recurring item resumed' };
  }

  async recordPayment(invoiceId: string, dto: RecordInvoicePaymentDto) {
    await this.recalculateInvoiceTotals(invoiceId);
    return this.prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findUnique({ where: { id: invoiceId } });
      if (!invoice) throw new NotFoundException(`Invoice ${invoiceId} not found`);

      const paymentAmount = this.asDecimal(dto.amount);
      if (paymentAmount.lte(0)) {
        throw new BadRequestException('Payment amount must be greater than zero');
      }

      const outstanding = this.asDecimal(invoice.totalAmount).sub(invoice.amountPaid);
      if (paymentAmount.gt(outstanding)) {
        throw new BadRequestException(
          `Payment amount exceeds outstanding invoice balance ${outstanding.toFixed(2)}`,
        );
      }

      let walletTransactionId: string | undefined;
      if (dto.source === InvoicePaymentSource.WALLET) {
        const wallet = await this.ensureWallet(invoice.patientId, tx);
        if (wallet.balance.lt(paymentAmount)) {
          throw new BadRequestException('Insufficient wallet balance');
        }

        const walletTxn = await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            type: WalletTransactionType.DEBIT,
            amount: paymentAmount,
            reference: dto.reference ?? 'invoice_payment',
            invoiceId,
          },
        });
        walletTransactionId = walletTxn.id;

        await tx.patientWallet.update({
          where: { id: wallet.id },
          data: { balance: wallet.balance.sub(paymentAmount) },
        });
      }

      const payment = await tx.invoicePayment.create({
        data: {
          invoiceId,
          amount: paymentAmount,
          source: dto.source,
          walletTransactionId,
        },
      });

      await tx.invoice.update({
        where: { id: invoiceId },
        data: { amountPaid: this.asDecimal(invoice.amountPaid).add(paymentAmount) },
      });
      const updated = await this.recalculateInvoiceTotals(invoiceId, tx);
      return { payment, invoice: updated };
    });
  }

  /**
   * Record a payment on the billing Transaction ledger and allocate it across
   * invoice line items (partial or full per line). Atomic: all writes succeed or none.
   */
  async allocatePaymentToInvoiceItems(
    invoiceId: string,
    dto: AllocateInvoiceItemPaymentDto,
  ) {
    const staff = await this.prisma.staff.findUnique({
      where: { id: dto.staffId },
    });
    if (!staff) {
      throw new NotFoundException(`Staff "${dto.staffId}" not found.`);
    }

    let bankId: string | undefined;
    if (dto.bankAccountNumber) {
      const bank = await this.prisma.bank.findUnique({
        where: { accountNumber: dto.bankAccountNumber },
      });
      if (!bank) {
        throw new NotFoundException(
          `No bank found with account number "${dto.bankAccountNumber}".`,
        );
      }
      bankId = bank.id;
    }

    await this.recalculateInvoiceTotals(invoiceId);

    return this.prisma.$transaction(async (tx) => {
      await this.recalculateInvoiceTotals(invoiceId, tx);
      const now = new Date();
      const invoice = await tx.invoice.findUnique({
        where: { id: invoiceId },
        include: {
          invoiceItems: {
            include: { usageSegments: { orderBy: { startAt: 'asc' } } },
          },
        },
      });
      if (!invoice) {
        throw new NotFoundException(`Invoice ${invoiceId} not found`);
      }

      const paymentAmount = this.asDecimal(dto.amount);
      if (paymentAmount.lte(0)) {
        throw new BadRequestException('Payment amount must be greater than zero');
      }

      const merged = new Map<string, Prisma.Decimal>();
      for (const a of dto.allocations) {
        const add = this.asDecimal(a.amount);
        if (add.lte(0)) {
          throw new BadRequestException(
            'Each allocation amount must be greater than zero',
          );
        }
        const cur = merged.get(a.invoiceItemId) ?? new Prisma.Decimal(0);
        merged.set(a.invoiceItemId, cur.add(add));
      }

      let allocSum = new Prisma.Decimal(0);
      for (const v of merged.values()) {
        allocSum = allocSum.add(v);
      }
      if (allocSum.comparedTo(paymentAmount) !== 0) {
        throw new BadRequestException(
          `Sum of allocations (${allocSum.toFixed(2)}) must equal payment amount (${paymentAmount.toFixed(2)})`,
        );
      }

      const itemsById = new Map(invoice.invoiceItems.map((it) => [it.id, it]));
      for (const [itemId, allocAmt] of merged) {
        const item = itemsById.get(itemId);
        if (!item) {
          throw new BadRequestException(
            `Invoice item "${itemId}" is not on invoice ${invoiceId}`,
          );
        }
        const lineTotal = this.invoiceLineTotal(item, now);
        const itemPaid = this.asDecimal(item.amountPaid);
        if (itemPaid.add(allocAmt).gt(lineTotal)) {
          throw new BadRequestException(
            `Allocation for item "${itemId}" would exceed line total (max ${lineTotal.toFixed(2)}, already paid ${itemPaid.toFixed(2)})`,
          );
        }
      }

      const invoiceOutstanding = this.asDecimal(invoice.totalAmount).sub(
        invoice.amountPaid,
      );
      if (paymentAmount.gt(invoiceOutstanding)) {
        throw new BadRequestException(
          `Payment amount exceeds outstanding invoice balance ${invoiceOutstanding.toFixed(2)}`,
        );
      }

      let billingTransaction = dto.billingTransactionId
        ? await tx.transaction.findUnique({
          where: { id: dto.billingTransactionId },
        })
        : await tx.transaction.findFirst({
          where: {
            invoiceId,
            patientId: invoice.patientId,
            status: { not: TransactionStatus.CANCELLED },
          },
          orderBy: { createdAt: 'desc' },
        });

      if (dto.billingTransactionId && !billingTransaction) {
        throw new NotFoundException(
          `Billing transaction "${dto.billingTransactionId}" not found`,
        );
      }

      if (billingTransaction) {
        if (billingTransaction.patientId !== invoice.patientId) {
          throw new BadRequestException(
            'Billing transaction belongs to a different patient than this invoice',
          );
        }
        if (billingTransaction.invoiceId !== invoiceId) {
          throw new BadRequestException(
            'Billing transaction is not linked to this invoice',
          );
        }
        if (billingTransaction.status === TransactionStatus.CANCELLED) {
          throw new BadRequestException(
            'Billing transaction is cancelled and cannot accept payments',
          );
        }
      } else {
        billingTransaction = await tx.transaction.create({
          data: {
            transactionID: generateBillingTransactionId(),
            patientId: invoice.patientId,
            createdById: dto.staffId,
            updatedById: dto.staffId,
            invoiceId,
            totalAmount: this.asDecimal(invoice.totalAmount),
            amountPaid: this.asDecimal(invoice.amountPaid),
            discountAmount: new Prisma.Decimal(0),
            insuranceCovered: new Prisma.Decimal(0),
            status: this.billingTxnStatus(
              this.asDecimal(invoice.totalAmount),
              new Prisma.Decimal(0),
              new Prisma.Decimal(0),
              this.asDecimal(invoice.amountPaid),
              TransactionStatus.DRAFT,
            ),
          },
        });
      }

      const txnOutstanding = this.asDecimal(billingTransaction.totalAmount)
        .sub(billingTransaction.discountAmount)
        .sub(billingTransaction.insuranceCovered)
        .sub(billingTransaction.amountPaid);
      if (paymentAmount.gt(txnOutstanding)) {
        throw new BadRequestException(
          `Payment amount exceeds outstanding balance on billing transaction (${txnOutstanding.toFixed(2)})`,
        );
      }

      const payment = await tx.transactionPayment.create({
        data: {
          transactionId: billingTransaction.id,
          amount: paymentAmount,
          method: dto.method,
          reference: dto.reference,
          notes: dto.notes,
          receivedById: dto.staffId,
          createdById: dto.staffId,
          ...(bankId ? { bankId } : {}),
        },
        include: {
          receivedBy: {
            select: { id: true, firstName: true, lastName: true },
          },
          bank: {
            select: { id: true, name: true, accountNumber: true },
          },
        },
      });

      const newTxnAmountPaid = this.asDecimal(billingTransaction.amountPaid).add(
        paymentAmount,
      );
      const newTxnStatus = this.billingTxnStatus(
        this.asDecimal(billingTransaction.totalAmount),
        billingTransaction.discountAmount,
        billingTransaction.insuranceCovered,
        newTxnAmountPaid,
        billingTransaction.status,
      );

      await tx.transaction.update({
        where: { id: billingTransaction.id },
        data: {
          amountPaid: newTxnAmountPaid,
          status: newTxnStatus,
          updatedById: dto.staffId,
        },
      });

      const allocationRows: Awaited<
        ReturnType<typeof tx.invoiceItemPayment.create>
      >[] = [];
      for (const [itemId, allocAmt] of merged) {
        const row = await tx.invoiceItemPayment.create({
          data: {
            invoiceItemId: itemId,
            transactionId: billingTransaction.id,
            amount: allocAmt,
          },
        });
        await tx.invoiceItem.update({
          where: { id: itemId },
          data: { amountPaid: { increment: allocAmt } },
        });
        allocationRows.push(row);
      }

      await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          amountPaid: this.asDecimal(invoice.amountPaid).add(paymentAmount),
        },
      });

      const updatedInvoice = await this.recalculateInvoiceTotals(invoiceId, tx);

      const newTxnOutstanding = this.asDecimal(billingTransaction.totalAmount)
        .sub(billingTransaction.discountAmount)
        .sub(billingTransaction.insuranceCovered)
        .sub(newTxnAmountPaid);

      await tx.transactionAuditLog.create({
        data: {
          transactionId: billingTransaction.id,
          action: TransactionAuditAction.PAYMENT_RECEIVED,
          description: `Invoice item allocation: ₦${paymentAmount.toFixed(2)} across ${merged.size} line(s) (invoice ${invoiceId})`,
          performedById: dto.staffId,
          createdById: dto.staffId,
          metadata: {
            invoiceId,
            paymentId: payment.id,
            allocationIds: allocationRows.map((r) => r.id),
          },
        },
      });

      return {
        payment,
        billingTransactionId: billingTransaction.id,
        allocations: allocationRows,
        invoice: updatedInvoice,
        transactionOutstanding: newTxnOutstanding,
        transactionStatus: newTxnStatus,
      };
    });
  }

  async listPayments(invoiceId: string) {
    await this.findOne(invoiceId);
    return this.prisma.invoicePayment.findMany({
      where: { invoiceId },
      orderBy: { createdAt: 'desc' },
      include: { walletTransaction: true },
    });
  }

  async getWallet(patientId: string) {
    const patient = await this.prisma.patient.findUnique({ where: { id: patientId } });
    if (!patient) throw new NotFoundException(`Patient ${patientId} not found`);
    return this.ensureWallet(patientId);
  }

  async depositToWallet(patientId: string, dto: WalletDepositDto) {
    const patient = await this.prisma.patient.findUnique({ where: { id: patientId } });
    if (!patient) throw new NotFoundException(`Patient ${patientId} not found`);

    return this.prisma.$transaction(async (tx) => {
      const wallet = await this.ensureWallet(patientId, tx);
      const amount = this.asDecimal(dto.amount);

      const transaction = await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: WalletTransactionType.CREDIT,
          amount,
          reference: dto.reference ?? 'deposit',
        },
      });

      const updatedWallet = await tx.patientWallet.update({
        where: { id: wallet.id },
        data: { balance: wallet.balance.add(amount) },
      });

      return { wallet: updatedWallet, transaction };
    });
  }

  async getWalletTransactions(patientId: string) {
    const wallet = await this.getWallet(patientId);
    return this.prisma.walletTransaction.findMany({
      where: { walletId: wallet.id },
      orderBy: { createdAt: 'desc' },
      include: { invoice: { select: { id: true, status: true } } },
    });
  }

  // ─── Auto-invoice from requests (lab, imaging, radiology, procedure, medication) ─

  /**
   * Find an invoice by encounter ID (used for medication: same encounter = same invoice).
   */
  async findByEncounterId(encounterId: string) {
    return this.prisma.invoice.findFirst({
      where: { encounterId },
      orderBy: { createdAt: 'desc' },
      include: {
        patient: {
          select: { id: true, patientId: true, firstName: true, surname: true },
        },
        invoiceItems: {
          include: {
            service: { select: { id: true, name: true, cost: true } },
            drug: { select: { id: true, genericName: true } },
          },
        },
      },
    });
  }

  /**
   * Get an open invoice for the encounter, or the patient's single open invoice, or create.
   * Open = PENDING or PARTIALLY_PAID. PAID encounter invoices are not reused.
   */
  async ensureInvoiceForEncounter(params: {
    encounterId: string;
    patientId: string;
    staffId: string;
  }) {
    const encounterInclude = {
      patient: {
        select: { id: true, patientId: true, firstName: true, surname: true },
      },
      invoiceItems: true,
    } satisfies Prisma.InvoiceInclude;

    const forEncounterOpen = await this.prisma.invoice.findFirst({
      where: {
        encounterId: params.encounterId,
        status: {
          in: [InvoiceStatus.PENDING, InvoiceStatus.PARTIALLY_PAID],
        },
      },
      orderBy: { createdAt: 'desc' },
      include: encounterInclude,
    });
    if (forEncounterOpen) return forEncounterOpen;

    const patientOpen = await this.findOpenInvoiceForPatient(params.patientId);
    if (patientOpen) {
      return this.prisma.invoice.update({
        where: { id: patientOpen.id },
        data: {
          encounterId: params.encounterId,
          staffId: params.staffId,
        },
        include: encounterInclude,
      });
    }

    return this.prisma.invoice.create({
      data: {
        patientId: params.patientId,
        encounterId: params.encounterId,
        status: InvoiceStatus.PENDING,
        createdById: params.staffId,
        staffId: params.staffId,
      },
      include: encounterInclude,
    });
  }

  /**
   * Create an invoice with one service line, or append the line to the patient's
   * existing PENDING / PARTIALLY_PAID invoice when present.
   */
  async createWithServiceItem(params: {
    patientId: string;
    encounterId: string;
    staffId: string;
    serviceId: string;
    quantity?: number;
  }) {
    const service = await this.prisma.service.findUnique({
      where: { id: params.serviceId },
    });
    if (!service) {
      throw new NotFoundException(`Service ${params.serviceId} not found`);
    }
    const quantity = params.quantity ?? 1;

    const include = {
      patient: {
        select: { id: true, patientId: true, firstName: true, surname: true },
      },
      invoiceItems: {
        include: {
          service: { select: { id: true, name: true, cost: true } },
        },
      },
    } satisfies Prisma.InvoiceInclude;

    const open = await this.findOpenInvoiceForPatient(params.patientId);
    if (open) {
      await this.prisma.invoice.update({
        where: { id: open.id },
        data: {
          encounterId: params.encounterId,
          staffId: params.staffId,
        },
      });
      await this.addItem(open.id, {
        serviceId: params.serviceId,
        quantity,
        unitPrice: service.cost,
      });
      return this.prisma.invoice.findUniqueOrThrow({
        where: { id: open.id },
        include,
      });
    }

    return this.prisma.invoice.create({
      data: {
        patientId: params.patientId,
        encounterId: params.encounterId,
        status: InvoiceStatus.PENDING,
        createdById: params.staffId,
        staffId: params.staffId,
        invoiceItems: {
          create: {
            serviceId: params.serviceId,
            quantity,
            unitPrice: this.asDecimal(service.cost),
          },
        },
      },
      include,
    });
  }

  /**
   * Add a drug as a line item to an invoice. Uses selling price from an available batch.
   */
  async addDrugItem(params: {
    invoiceId: string;
    drugId: string;
    quantity?: number;
  }) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: params.invoiceId },
    });
    if (!invoice) {
      throw new NotFoundException(`Invoice ${params.invoiceId} not found`);
    }
    this.assertInvoiceNotPaid(invoice.status);

    const drug = await this.prisma.drug.findUnique({
      where: { id: params.drugId },
      include: {
        batches: {
          where: { quantityRemaining: { gt: 0 } },
          orderBy: { expiryDate: 'asc' },
          take: 1,
        },
      },
    });
    if (!drug) throw new NotFoundException(`Drug ${params.drugId} not found`);
    const batch = drug.batches?.[0];
    const unitPrice = batch ? new Prisma.Decimal(batch.sellingPrice) : new Prisma.Decimal(0);
    const quantity = params.quantity ?? 1;
    const item = await this.prisma.invoiceItem.create({
      data: {
        invoiceId: params.invoiceId,
        drugId: params.drugId,
        quantity,
        unitPrice,
      },
      include: {
        drug: { select: { id: true, genericName: true } },
        invoice: { select: { id: true, status: true, patientId: true } },
      },
    });
    await this.recalculateInvoiceTotals(params.invoiceId);
    return item;
  }
}
