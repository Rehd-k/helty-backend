import { randomBytes } from 'crypto';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  InvoiceAuditAction,
  InvoicePaymentMethod,
  InvoicePaymentSource,
  InvoiceStatus,
  PatientStatus,
  Prisma,
  WalletTransactionType,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AddInvoiceItemDto,
  AllocateInvoiceItemPaymentDto,
  CreateInvoiceInsuranceClaimDto,
  CreateInvoiceDto,
  RecordInvoicePaymentDto,
  UpdateInvoiceInsuranceClaimDto,
  UpdateInvoiceDto,
  UpdateInvoiceItemDto,
  WalletDepositDto,
  ListInvoicesByCategoryQueryDto,
} from './dto/invoice.dto';
import { DateRangeSkipTakeDto } from '../../common/dto/date-range.dto';
import { parseDateRange } from '../../common/utils/date-range';
import { invoiceLinkException } from '../../common/exceptions/invoice-link.exception';
import {
  LAB_BILLING_CATEGORIES,
  RADIOLOGY_BILLING_CATEGORY,
  CONSULTATION_BILLING_CATEGORY,
} from './invoice-link.constants';

const INVOICE_ID_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function generateInvoiceHumanId(): string {
  const buf = randomBytes(10);
  let s = '';
  for (let i = 0; i < 10; i++) {
    s += INVOICE_ID_ALPHABET[buf[i] % INVOICE_ID_ALPHABET.length];
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

  private async assertConsultingRoomExists(consultingRoomId: string) {
    const room = await this.prisma.consultingRoom.findUnique({
      where: { id: consultingRoomId },
      select: { id: true },
    });
    if (!room) {
      throw new NotFoundException(
        `Consulting room "${consultingRoomId}" not found.`,
      );
    }
  }

  private async assertVitalsLinkValid(params: {
    vitalsId: string;
    patientId: string;
    invoiceIdToIgnore?: string;
  }) {
    const vitals = await this.prisma.patientVitals.findUnique({
      where: { id: params.vitalsId },
      select: {
        id: true,
        patientId: true,
        invoice: { select: { id: true } },
      },
    });
    if (!vitals) {
      throw new NotFoundException(`Patient vitals "${params.vitalsId}" not found.`);
    }
    if (vitals.patientId && vitals.patientId !== params.patientId) {
      throw new BadRequestException(
        'Selected vitals does not belong to the invoice patient.',
      );
    }
    if (
      vitals.invoice &&
      vitals.invoice.id !== params.invoiceIdToIgnore
    ) {
      throw new BadRequestException(
        'This vitals record is already linked to another invoice.',
      );
    }
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

  private static readonly uuidRe =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  private isUuid(s: string): boolean {
    return InvoiceService.uuidRe.test(s);
  }

  private buildBroadInvoiceSearchOr(q: string): Prisma.InvoiceWhereInput[] {
    const or: Prisma.InvoiceWhereInput[] = [
      { invoiceID: { contains: q, mode: 'insensitive' } },
      {
        patient: {
          OR: [
            { firstName: { contains: q, mode: 'insensitive' } },
            { surname: { contains: q, mode: 'insensitive' } },
            { patientId: { contains: q, mode: 'insensitive' } },
          ],
        },
      },
      {
        payments: {
          some: { reference: { contains: q, mode: 'insensitive' } },
        },
      },
    ];
    if (this.isUuid(q)) {
      or.push({ id: q });
    }
    return or;
  }

  /**
   * Validates a paid invoice line for radiology/lab consumption inside a transaction.
   * Call immediately before creating the request/order that sets `invoiceItemId`.
   */
  async assertPaidInvoiceItemConsumable(
    tx: Prisma.TransactionClient,
    params: {
      invoiceId: string;
      invoiceItemId: string;
      serviceId: string;
      patientId: string;
      mode: 'radiology' | 'lab';
    },
  ): Promise<void> {
    const invoice = await tx.invoice.findUnique({
      where: { id: params.invoiceId },
      select: { id: true, patientId: true, status: true },
    });
    if (!invoice) {
      throw invoiceLinkException(
        'INVOICE_ITEM_NOT_FOUND',
        'Invoice not found.',
      );
    }
    if (invoice.patientId !== params.patientId) {
      throw invoiceLinkException(
        'INVOICE_PATIENT_MISMATCH',
        'This invoice does not belong to the selected patient.',
      );
    }
    if (invoice.status !== InvoiceStatus.PAID) {
      throw invoiceLinkException(
        'INVOICE_NOT_PAID',
        'This invoice is not paid. Only paid invoices can be used for this flow.',
      );
    }

    const item = await tx.invoiceItem.findFirst({
      where: {
        id: params.invoiceItemId,
        invoiceId: params.invoiceId,
      },
      include: {
        service: {
          include: { category: { select: { name: true } } },
        },
      },
    });

    if (!item) {
      throw invoiceLinkException(
        'INVOICE_ITEM_NOT_FOUND',
        'Invoice line item not found on this invoice.',
      );
    }

    if (item.serviceId !== params.serviceId) {
      throw invoiceLinkException(
        'INVOICE_ITEM_SERVICE_MISMATCH',
        'The selected service does not match this invoice line.',
      );
    }
    if (item.settled) {
      throw invoiceLinkException(
        'INVOICE_ITEM_ALREADY_CONSUMED',
        'This paid invoice item has already been settled and cannot be reused.',
      );
    }

    const categoryName = item.service?.category?.name ?? null;

    if (params.mode === 'radiology') {
      if (
        !categoryName ||
        categoryName.trim().toLowerCase() !==
          RADIOLOGY_BILLING_CATEGORY.trim().toLowerCase()
      ) {
        throw invoiceLinkException(
          'INVOICE_ITEM_CATEGORY_MISMATCH',
          'This invoice line is not a Radiology & Imaging service.',
        );
      }
      const existing = await tx.radiologyRequest.findFirst({
        where: { invoiceItemId: params.invoiceItemId },
      });
      if (existing) {
        throw invoiceLinkException(
          'INVOICE_ITEM_ALREADY_CONSUMED',
          'This paid invoice item has already been used for a radiology request.',
        );
      }
    } else {
      const okCat = LAB_BILLING_CATEGORIES.some(
        (c) =>
          !!categoryName &&
          categoryName.trim().toLowerCase() === c.trim().toLowerCase(),
      );
      if (!okCat) {
        throw invoiceLinkException(
          'INVOICE_ITEM_CATEGORY_MISMATCH',
          'This invoice line is not a laboratory service.',
        );
      }
      const existing = await tx.labOrder.findFirst({
        where: { invoiceItemId: params.invoiceItemId },
      });
      if (existing) {
        throw invoiceLinkException(
          'INVOICE_ITEM_ALREADY_CONSUMED',
          'This paid invoice item has already been used for a lab order.',
        );
      }
    }
  }

  /**
   * Idempotently marks an invoice item as settled.
   * No-op when `invoiceItemId` is empty or already settled.
   */
  async settleInvoiceItemIfPresent(
    tx: Prisma.TransactionClient,
    invoiceItemId?: string | null,
  ): Promise<void> {
    if (!invoiceItemId) return;
    await tx.invoiceItem.updateMany({
      where: { id: invoiceItemId, settled: false },
      data: { settled: true },
    });
  }

  /**
   * Picks the first paid, unsettled consultation invoice line for a patient.
   * Selection is deterministic: oldest invoice first, then oldest item first.
   */
  async findFirstConsumableConsultationItem(
    tx: Prisma.TransactionClient,
    patientId: string,
  ): Promise<{ invoiceId: string; invoiceItemId: string } | null> {
    const invoice = await tx.invoice.findFirst({
      where: {
        patientId,
        status: InvoiceStatus.PAID,
        encounterId: null,
        invoiceItems: {
          some: {
            settled: false,
            service: {
              category: {
                name: {
                  equals: CONSULTATION_BILLING_CATEGORY,
                  mode: 'insensitive',
                },
              },
            },
          },
        },
      },
      include: {
        invoiceItems: {
          where: {
            settled: false,
            service: {
              category: {
                name: {
                  equals: CONSULTATION_BILLING_CATEGORY,
                  mode: 'insensitive',
                },
              },
            },
          },
          select: { id: true },
          orderBy: { id: 'asc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    const invoiceItemId = invoice?.invoiceItems?.[0]?.id;
    if (!invoice || !invoiceItemId) return null;
    return { invoiceId: invoice.id, invoiceItemId };
  }

  /** When auto-adding a service line from an encounter, enforce Radiology vs Lab category rules. */
  async assertServiceCategoryForEncounterBilling(
    serviceId: string,
    mode: 'radiology' | 'lab',
  ): Promise<void> {
    const svc = await this.prisma.service.findUnique({
      where: { id: serviceId },
      include: { category: { select: { name: true } } },
    });
    if (!svc) {
      throw new NotFoundException(`Service "${serviceId}" not found.`);
    }
    const name = svc.category?.name ?? null;
    if (mode === 'radiology') {
      if (
        !name ||
        name.trim().toLowerCase() !==
          RADIOLOGY_BILLING_CATEGORY.trim().toLowerCase()
      ) {
        throw invoiceLinkException(
          'INVOICE_ITEM_CATEGORY_MISMATCH',
          'Encounter billing for imaging/radiology must use a Radiology & Imaging service.',
        );
      }
    } else {
      const okCat = LAB_BILLING_CATEGORIES.some(
        (c) =>
          !!name && name.trim().toLowerCase() === c.trim().toLowerCase(),
      );
      if (!okCat) {
        throw invoiceLinkException(
          'INVOICE_ITEM_CATEGORY_MISMATCH',
          'Encounter billing for laboratory orders must use a Laboratory service category.',
        );
      }
    }
  }

  private patientAgeYears(dob: Date | null | undefined): number | null {
    if (!dob) return null;
    const birth = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
      age -= 1;
    }
    return age;
  }

  /** Maps billing payment method to invoice payment source enum. */
  paymentMethodToInvoiceSource(
    method: InvoicePaymentMethod,
  ): InvoicePaymentSource {
    switch (method) {
      case InvoicePaymentMethod.CASH:
        return InvoicePaymentSource.CASH;
      case InvoicePaymentMethod.CARD:
        return InvoicePaymentSource.CARD;
      case InvoicePaymentMethod.TRANSFER:
        return InvoicePaymentSource.TRANSFER;
      case InvoicePaymentMethod.INSURANCE:
        return InvoicePaymentSource.INSURANCE;
      case InvoicePaymentMethod.WAIVER:
        return InvoicePaymentSource.WAIVER;
      default:
        return InvoicePaymentSource.CASH;
    }
  }

  private sourceToDefaultMethod(
    source: InvoicePaymentSource,
  ): InvoicePaymentMethod | undefined {
    switch (source) {
      case InvoicePaymentSource.CASH:
        return InvoicePaymentMethod.CASH;
      case InvoicePaymentSource.TRANSFER:
        return InvoicePaymentMethod.TRANSFER;
      case InvoicePaymentSource.CARD:
        return InvoicePaymentMethod.CARD;
      case InvoicePaymentSource.INSURANCE:
        return InvoicePaymentMethod.INSURANCE;
      case InvoicePaymentSource.WAIVER:
        return InvoicePaymentMethod.WAIVER;
      case InvoicePaymentSource.WALLET:
      default:
        return undefined;
    }
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
    consultingRoom: { select: { id: true, name: true } },
    vitals: true,
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
    if (dto.consultingRoomId) {
      await this.assertConsultingRoomExists(dto.consultingRoomId);
    }
    if (dto.vitalsId) {
      await this.assertVitalsLinkValid({
        vitalsId: dto.vitalsId,
        patientId: dto.patientId,
      });
    }

    const existing = await this.findOpenInvoiceForPatient(dto.patientId);
    if (existing) {
      await this.prisma.invoice.update({
        where: { id: existing.id },
        data: {
          ...(dto.staffId !== undefined && { staffId: dto.staffId }),
          ...(dto.encounterId !== undefined && {
            encounterId: dto.encounterId,
          }),
          ...(dto.consultingRoomId !== undefined && {
            consultingRoomId: dto.consultingRoomId,
          }),
          ...(dto.vitalsId !== undefined && { vitalsId: dto.vitalsId }),
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
        invoiceID: generateInvoiceHumanId(),
        patientId: dto.patientId,
        status: dto.status ?? InvoiceStatus.PENDING,
        createdById: req.user.sub,
        staffId: dto.staffId ?? '',
        encounterId: dto.encounterId ?? undefined,
        consultingRoomId: dto.consultingRoomId ?? undefined,
        vitalsId: dto.vitalsId ?? undefined,
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

  /** Optional `?status=` query (case-insensitive); invalid values throw. */
  private parseInvoiceListStatus(value: unknown): InvoiceStatus | undefined {
    if (value === undefined || value === null || value === '') return undefined;
    const normalized = String(value)
      .trim()
      .toUpperCase()
      .replace(/-/g, '_');
    const allowed = Object.values(InvoiceStatus) as string[];
    if (!allowed.includes(normalized)) {
      throw new BadRequestException(
        `Invalid invoice status filter. Use one of: ${allowed.join(', ')}.`,
      );
    }
    return normalized as InvoiceStatus;
  }

  private invoiceListWhere(
    from: Date,
    to: Date,
    allowInpatient: boolean,
    rawQuery?: string,
    category?: string,
    invoiceStatus?: InvoiceStatus,
  ): Prisma.InvoiceWhereInput {
    const patientStatus = allowInpatient
      ? PatientStatus.ADMITED
      : PatientStatus.OUTPATIENT;
    const updatedAt: Prisma.DateTimeFilter = { gte: from, lte: to };
    const statusWhere: Prisma.InvoiceWhereInput = invoiceStatus
      ? { status: invoiceStatus }
      : {};
    const q = rawQuery?.trim();
    if (!q) {
      return {
        ...statusWhere,
        updatedAt,
        patient: { status: patientStatus },
      };
    }

    const needle = { contains: q, mode: 'insensitive' as const };

    if (category === 'patientId') {
      return {
        ...statusWhere,
        updatedAt,
        patient: { status: patientStatus, patientId: needle },
      };
    }
    if (category === 'fullName') {
      return {
        ...statusWhere,
        updatedAt,
        patient: {
          status: patientStatus,
          OR: [{ firstName: needle }, { surname: needle }],
        },
      };
    }
    if (category === 'service') {
      return {
        ...statusWhere,
        updatedAt,
        patient: { status: patientStatus },
        invoiceItems: {
          some: { service: { name: needle } },
        },
      };
    }
    if (category) {
      return {
        ...statusWhere,
        updatedAt,
        patient: { status: patientStatus },
      };
    }

    return {
      ...statusWhere,
      updatedAt,
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
    consultingRoom: { select: { id: true, name: true } },
    vitals: true,
    _count: { select: { invoiceItems: true } },
  } satisfies Prisma.InvoiceInclude;

  /**
   * Paginated list of all invoices, most-recent first.
   * Inpatient vs outpatient is enforced via the related patient's `status`
   * (`ADMITED` when allowIP is true, otherwise `OUTPATIENT`).
   * Optional `status` filters by invoice payment status (PENDING, PARTIALLY_PAID, PAID).
   */
  async findAll(
    params: DateRangeSkipTakeDto & {
      search?: string;
      category?: string;
      query?: string;
      allowIP: boolean;
      status?: string;
    },
  ) {
    const { skip = 0, take = 20, fromDate, toDate, query, category } = params;
    const { from, to } = parseDateRange(fromDate, toDate);
    const allowInpatient = this.parseAllowInpatient(params.allowIP);
    const invoiceStatus = this.parseInvoiceListStatus(params.status);
    const where = this.invoiceListWhere(
      from,
      to,
      allowInpatient,
      query,
      category,
      invoiceStatus,
    );

    const [invoices, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        skip,
        take,
        orderBy: { updatedAt: 'desc' },
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
          select: {
            id: true,
            firstName: true,
            lastName: true,
            staffRole: true,
            accountType: true,
          },
        },
        updatedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            staffRole: true,
            accountType: true,
          },
        },
        staff: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            staffRole: true,
            accountType: true,
          },
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
        refunds: {
          orderBy: { refundedAt: 'desc' },
          include: {
            processedBy: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
        },
        consultingRoom: { select: { id: true, name: true } },
        vitals: true,
      },
    });

    if (!invoice) throw new NotFoundException(`Invoice ${id} not found`);
    const amountDue = this.asDecimal(invoice.totalAmount).sub(
      invoice.amountPaid,
    );
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

    // Invoice is authoritative for client-facing due amount.
    // Do not override with linked transaction financial fields.
    const netAmountDue = amountDue;
    return {
      ...invoice,
      invoiceItems,
      amountDue,
      netAmountDue,
    };
  }

  /**
   * Update invoice status or associated staff.
   * Authenticated staff member is recorded as `updatedBy`.
   */
  async update(id: string, dto: UpdateInvoiceDto, req: any) {
    const existing = await this.findOne(id);
    if (dto.consultingRoomId) {
      await this.assertConsultingRoomExists(dto.consultingRoomId);
    }
    if (dto.vitalsId) {
      await this.assertVitalsLinkValid({
        vitalsId: dto.vitalsId,
        patientId: existing.patientId,
        invoiceIdToIgnore: id,
      });
    }
    return this.prisma.invoice.update({
      where: { id },
      data: {
        status: dto.status,
        staffId: dto.staffId,
        encounterId: dto.encounterId,
        consultingRoomId: dto.consultingRoomId,
        vitalsId: dto.vitalsId,
        updatedById: req.user.sub,
      },
      include: {
        patient: {
          select: { id: true, patientId: true, firstName: true, surname: true },
        },
        updatedBy: { select: { id: true, firstName: true, lastName: true } },
        consultingRoom: { select: { id: true, name: true } },
        vitals: true,
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

    if (dto.serviceId) {
      const service = await this.prisma.service.findUnique({
        where: { id: dto.serviceId },
      });
      if (!service)
        throw new NotFoundException(`Service ${dto.serviceId} not found`);
    }
    if (dto.drugId) {
      const drug = await this.prisma.drug.findUnique({
        where: { id: dto.drugId },
      });
      if (!drug)
        throw new NotFoundException(`Drug ${dto.drugId} not found`);
    }

    const item = await this.prisma.invoiceItem.create({
      data: {
        invoiceId,
        serviceId: dto.serviceId,
        drugId: dto.drugId,
        quantity: dto.quantity ?? 1,
        unitPrice: this.asDecimal(dto.unitPrice ?? 0),
        isRecurringDaily: dto.isRecurringDaily ?? false,
      },
      include: {
        service: {
          select: { id: true, name: true, description: true, cost: true },
        },
        invoice: { select: { id: true, status: true, patientId: true } },
      },
    });
    if (item.isRecurringDaily) {
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
    const deleted = await this.prisma.invoiceItem.delete({
      where: { id: itemId },
    });
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
      throw new BadRequestException(
        'Only recurring daily items can be resumed',
      );
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

  private async logInvoiceAudit(
    tx: Prisma.TransactionClient,
    params: {
      invoiceId: string;
      action: InvoiceAuditAction;
      description: string;
      performedById?: string;
      metadata?: Prisma.InputJsonValue;
    },
  ) {
    await tx.invoiceAuditLog.create({
      data: {
        invoiceId: params.invoiceId,
        action: params.action,
        description: params.description,
        performedById: params.performedById,
        metadata: params.metadata,
      },
    });
  }

  /**
   * Record a payment inside an existing interactive transaction (invoice + wallet + payment + audit).
   */
  async recordPaymentWithTx(
    tx: Prisma.TransactionClient,
    invoiceId: string,
    dto: RecordInvoicePaymentDto,
    createdByStaffId?: string,
  ) {
    await this.recalculateInvoiceTotals(invoiceId, tx);

    let bankId: string | undefined;
    if (dto.bankAccountNumber) {
      const bank = await tx.bank.findUnique({
        where: { accountNumber: dto.bankAccountNumber },
      });
      if (!bank) {
        throw new NotFoundException(
          `No bank found with account number "${dto.bankAccountNumber}".`,
        );
      }
      bankId = bank.id;
    }

    const invoice = await tx.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice)
      throw new NotFoundException(`Invoice ${invoiceId} not found`);

    const paymentAmount = this.asDecimal(dto.amount);
    if (paymentAmount.lte(0)) {
      throw new BadRequestException(
        'Payment amount must be greater than zero',
      );
    }

    const maxPayable = this.asDecimal(invoice.totalAmount).sub(
      this.asDecimal(invoice.amountPaid),
    );

    if (paymentAmount.gt(maxPayable)) {
      throw new BadRequestException(
        `Payment amount exceeds outstanding balance ${maxPayable.toFixed(2)}`,
      );
    }

    const method = dto.method ?? this.sourceToDefaultMethod(dto.source);

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
          ...(createdByStaffId ? { createdById: createdByStaffId } : {}),
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
        ...(method !== undefined ? { method } : {}),
        reference: dto.reference,
        notes: dto.notes,
        ...(createdByStaffId
          ? {
            receivedById: createdByStaffId,
            createdById: createdByStaffId,
          }
          : {}),
        ...(bankId ? { bankId } : {}),
        walletTransactionId,
      },
    });

    await tx.invoice.update({
      where: { id: invoiceId },
      data: {
        amountPaid: this.asDecimal(invoice.amountPaid).add(paymentAmount),
      },
    });
    const updated = await this.recalculateInvoiceTotals(invoiceId, tx);
    await this.logInvoiceAudit(tx, {
      invoiceId,
      action: InvoiceAuditAction.PAYMENT_RECEIVED,
      description: `Payment of ₦${paymentAmount.toFixed(2)} recorded via ${dto.source}.`,
      performedById: createdByStaffId,
      metadata: {
        invoicePaymentId: payment.id,
        amount: paymentAmount.toFixed(2),
        source: dto.source,
        reference: dto.reference,
      } as Prisma.InputJsonValue,
    });

    return { payment, invoice: updated };
  }

  async recordPayment(
    invoiceId: string,
    dto: RecordInvoicePaymentDto,
    createdByStaffId?: string,
  ) {
    await this.recalculateInvoiceTotals(invoiceId);
    return this.prisma.$transaction((tx) =>
      this.recordPaymentWithTx(tx, invoiceId, dto, createdByStaffId),
    );
  }

  /** Record a payment and allocate it across invoice line items. */
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
        throw new BadRequestException(
          'Payment amount must be greater than zero',
        );
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

      const invoicePaymentRow = await tx.invoicePayment.create({
        data: {
          invoiceId,
          amount: paymentAmount,
          source: this.paymentMethodToInvoiceSource(dto.method),
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

      const allocationRows: Awaited<
        ReturnType<typeof tx.invoiceItemPayment.create>
      >[] = [];
      for (const [itemId, allocAmt] of merged) {
        const row = await tx.invoiceItemPayment.create({
          data: {
            invoiceItemId: itemId,
            invoicePaymentId: invoicePaymentRow.id,
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
      await this.logInvoiceAudit(tx, {
        invoiceId,
        action: InvoiceAuditAction.PAYMENT_RECEIVED,
        description: `Invoice item allocation: ₦${paymentAmount.toFixed(2)} across ${merged.size} line(s).`,
        performedById: dto.staffId,
        metadata: {
          invoicePaymentId: invoicePaymentRow.id,
          allocationIds: allocationRows.map((r) => r.id),
        } as Prisma.InputJsonValue,
      });

      return {
        invoicePayment: invoicePaymentRow,
        allocations: allocationRows,
        invoice: updatedInvoice,
      };
    });
  }

  async listPayments(invoiceId: string) {
    await this.findOne(invoiceId);
    return this.prisma.invoicePayment.findMany({
      where: { invoiceId },
      orderBy: { createdAt: 'desc' },
      include: {
        walletTransaction: true,
        receivedBy: { select: { id: true, firstName: true, lastName: true } },
        bank: { select: { id: true, name: true, accountNumber: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async listAllPayments(query: DateRangeSkipTakeDto & {
    source?: InvoicePaymentSource;
    method?: InvoicePaymentMethod;
    processedById?: string;
  }) {
    const { skip = 0, take = 20, fromDate, toDate, source, method, processedById } =
      query;
    const { from, to } = parseDateRange(fromDate, toDate);

    const where: Prisma.InvoicePaymentWhereInput = {
      createdAt: { gte: from, lte: to },
      ...(source ? { source } : {}),
      ...(method ? { method } : {}),
      ...(processedById ? { receivedById: processedById } : {}),
    };

    const [payments, total, grouped] = await Promise.all([
      this.prisma.invoicePayment.findMany({
        where,
        skip: Number(skip),
        take: Number(take),
        orderBy: { createdAt: 'desc' },
        include: {
          invoice: {
            select: {
              id: true,
              invoiceID: true,
              patientId: true,
              status: true,
              patient: {
                select: {
                  id: true,
                  patientId: true,
                  firstName: true,
                  surname: true,
                },
              },
              invoiceItems: {
                select: {
                  id: true,
                  customDescription: true,
                  quantity: true,
                  unitPrice: true,
                  amountPaid: true,
                  service: { select: { id: true, name: true } },
                  drug: {
                    select: { id: true, genericName: true, brandName: true },
                  },
                },
              },
            },
          },
          receivedBy: {
            select: { id: true, firstName: true, lastName: true, staffId: true },
          },
          createdBy: {
            select: { id: true, firstName: true, lastName: true, staffId: true },
          },
          bank: { select: { id: true, name: true, accountNumber: true } },
          walletTransaction: true,
        },
      }),
      this.prisma.invoicePayment.count({ where }),
      this.prisma.invoicePayment.groupBy({
        by: ['receivedById'],
        where,
        _sum: { amount: true },
        _count: { _all: true },
      }),
    ]);

    const staffIds = grouped
      .map((g) => g.receivedById)
      .filter((id): id is string => Boolean(id));

    const staffRows = staffIds.length
      ? await this.prisma.staff.findMany({
        where: { id: { in: staffIds } },
        select: { id: true, staffId: true, firstName: true, lastName: true },
      })
      : [];
    const staffById = new Map(staffRows.map((s) => [s.id, s]));

    const staffSummary = grouped.map((g) => ({
      receivedById: g.receivedById,
      staff: g.receivedById ? (staffById.get(g.receivedById) ?? null) : null,
      paymentCount: g._count._all,
      totalAmount: g._sum.amount ?? new Prisma.Decimal(0),
    }));
    return {
      payments,
      total,
      skip,
      take,
      staffSummary,
    };
  }

  /**
   * Invoices that include at least one line item whose linked Service belongs to
   * one of the given ServiceCategory names. Only matching line items are returned.
   */
  async listInvoicesByServiceCategories(query: ListInvoicesByCategoryQueryDto) {
    const {
      skip = 0,
      take = 20,
      fromDate,
      toDate,
      category,
      status,
      search,
      transactionId,
      invoiceId,
      invoiceID,
      patientName,
    } = query;
    const normalized = [
      ...new Set(
        category.map((c) => c.trim()).filter((c) => c.length > 0),
      ),
    ];
    if (!normalized.length) {
      throw new BadRequestException('At least one category is required');
    }

    const dateClause =
      fromDate || toDate
        ? (() => {
          const { from, to } = parseDateRange(fromDate, toDate);
          return { createdAt: { gte: from, lte: to } as const };
        })()
        : {};

    const itemMatchWhere: Prisma.InvoiceItemWhereInput = {
      serviceId: { not: null },
      service: {
        categoryId: { not: null },
        category: {
          name: { in: normalized, mode: 'insensitive' },
        },
      },
    };

    const andExtra: Prisma.InvoiceWhereInput[] = [];
    const humanInvoice = invoiceId?.trim() || invoiceID?.trim();
    if (humanInvoice) {
      const or: Prisma.InvoiceWhereInput[] = [
        { invoiceID: { contains: humanInvoice, mode: 'insensitive' } },
      ];
      if (this.isUuid(humanInvoice)) {
        or.push({ id: humanInvoice });
      }
      andExtra.push({ OR: or });
    }
    if (transactionId?.trim()) {
      andExtra.push({
        payments: {
          some: {
            reference: {
              contains: transactionId.trim(),
              mode: 'insensitive',
            },
          },
        },
      });
    }
    if (patientName?.trim()) {
      const pn = patientName.trim();
      andExtra.push({
        patient: {
          OR: [
            { firstName: { contains: pn, mode: 'insensitive' } },
            { surname: { contains: pn, mode: 'insensitive' } },
          ],
        },
      });
    }
    if (search?.trim()) {
      andExtra.push({ OR: this.buildBroadInvoiceSearchOr(search.trim()) });
    }

    const where: Prisma.InvoiceWhereInput = {
      ...dateClause,
      ...(status ? { status } : {}),
      invoiceItems: { some: itemMatchWhere },
      ...(andExtra.length ? { AND: andExtra } : {}),
    };

    const [invoices, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        skip: Number(skip),
        take: Number(take),
        orderBy: { createdAt: 'desc' },
        include: {
          patient: {
            select: {
              id: true,
              firstName: true,
              surname: true,
              phoneNumber: true,
              dob: true,
              patientId: true,
            },
          },
          invoiceItems: {
            where: itemMatchWhere,
            include: {
              service: {
                select: {
                  id: true,
                  name: true,
                  category: { select: { id: true, name: true } },
                },
              },
            },
          },
        },
      }),
      this.prisma.invoice.count({ where }),
    ]);

    const rows = invoices.map((inv) => {
      const p = inv.patient;
      const patientDisplayName =
        [p.firstName, p.surname].filter(Boolean).join(' ').trim() || null;
      return {
        patientName: patientDisplayName,
        phone: p.phoneNumber ?? null,
        age: this.patientAgeYears(p.dob),
        date: inv.createdAt.toISOString(),
        invoice: {
          id: inv.id,
          invoiceID: inv.invoiceID,
          invoiceId: inv.invoiceID,
          status: inv.status,
          patientId: inv.patientId,
          patient: { id: p.id, patientId: p.patientId ?? null },
          invoiceItems: inv.invoiceItems.map((it) => ({
            id: it.id,
            serviceId: it.serviceId,
            service: it.service
              ? {
                  id: it.service.id,
                  name: it.service.name,
                  category: it.service.category
                    ? {
                        id: it.service.category.id,
                        name: it.service.category.name,
                      }
                    : null,
                }
              : null,
            quantity: it.quantity,
            unitPrice: it.unitPrice.toFixed(2),
            amountPaid: it.amountPaid.toFixed(2),
            customDescription: it.customDescription,
          })),
        },
      };
    });

    return {
      total,
      skip: Number(skip),
      take: Number(take),
      categories: normalized,
      rows,
    };
  }

  /**
   * Invoices for patients who have no hospital `patientId` yet (null or empty string).
   */
  async listInvoicesForUnregisteredPatients(query: DateRangeSkipTakeDto) {
    const { skip = 0, take = 20, fromDate, toDate } = query;

    const dateClause =
      fromDate || toDate
        ? (() => {
          const { from, to } = parseDateRange(fromDate, toDate);
          return { createdAt: { gte: from, lte: to } as const };
        })()
        : {};

    const where: Prisma.InvoiceWhereInput = {
      ...dateClause,
      patient: {
        OR: [{ patientId: null }, { patientId: '' }],
      },
    };

    const [invoices, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        skip: Number(skip),
        take: Number(take),
        orderBy: { createdAt: 'desc' },
        include: {
          patient: {
            select: {
              id: true,
              firstName: true,
              surname: true,
              phoneNumber: true,
              dob: true,
            },
          },
          invoiceItems: {
            include: {
              service: {
                select: {
                  id: true,
                  name: true,
                  category: { select: { id: true, name: true } },
                },
              },
              drug: {
                select: { id: true, genericName: true, brandName: true },
              },
            },
          },
        },
      }),
      this.prisma.invoice.count({ where }),
    ]);

    const rows = invoices.map((inv) => {
      const p = inv.patient;
      const patientName =
        [p.firstName, p.surname].filter(Boolean).join(' ').trim() || null;
      return {
        patientId: p.id,
        patientName,
        invoiceId: inv.invoiceID,
        phone: p.phoneNumber ?? null,
        age: this.patientAgeYears(p.dob),
        date: inv.createdAt.toISOString(),
        services: inv.invoiceItems.map((it) => {
          const drugLabel =
            it.drug?.genericName ??
            it.drug?.brandName ??
            null;
          return {
            invoiceItemId: it.id,
            name:
              it.service?.name ??
              drugLabel ??
              it.customDescription ??
              null,
            category: it.service?.category?.name ?? null,
            quantity: it.quantity,
            unitPrice: it.unitPrice.toFixed(2),
            amountPaid: it.amountPaid.toFixed(2),
          };
        }),
      };
    });
    console.log({
      total,
      skip: Number(skip),
      take: Number(take),
      rows,
    });
    return {
      total,
      skip: Number(skip),
      take: Number(take),
      rows,
    };
  }

  async listInsuranceClaims(invoiceId: string) {
    await this.findOne(invoiceId);
    return this.prisma.insuranceClaim.findMany({
      where: { invoiceId },
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        updatedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async createInsuranceClaim(
    invoiceId: string,
    dto: CreateInvoiceInsuranceClaimDto,
    authStaffId?: string,
  ) {
    await this.findOne(invoiceId);
    const staffId = dto.staffId ?? authStaffId;

    if (staffId) {
      const staff = await this.prisma.staff.findUnique({ where: { id: staffId } });
      if (!staff) throw new NotFoundException(`Staff "${staffId}" not found.`);
    }

    return this.prisma.insuranceClaim.create({
      data: {
        invoiceId,
        provider: dto.provider,
        policyNumber: dto.policyNumber,
        coveredAmount: this.asDecimal(dto.coveredAmount),
        notes: dto.notes,
        ...(staffId ? { createdById: staffId, updatedById: staffId } : {}),
      },
    });
  }

  async updateInsuranceClaim(
    invoiceId: string,
    claimId: string,
    dto: UpdateInvoiceInsuranceClaimDto,
    authStaffId?: string,
  ) {
    await this.findOne(invoiceId);
    const claim = await this.prisma.insuranceClaim.findFirst({
      where: { id: claimId, invoiceId },
    });
    if (!claim) {
      throw new NotFoundException(
        `Insurance claim "${claimId}" not found on invoice "${invoiceId}".`,
      );
    }

    const staffId = dto.staffId ?? authStaffId;
    if (staffId) {
      const staff = await this.prisma.staff.findUnique({ where: { id: staffId } });
      if (!staff) throw new NotFoundException(`Staff "${staffId}" not found.`);
    }

    return this.prisma.insuranceClaim.update({
      where: { id: claim.id },
      data: {
        ...(dto.provider !== undefined ? { provider: dto.provider } : {}),
        ...(dto.policyNumber !== undefined
          ? { policyNumber: dto.policyNumber }
          : {}),
        ...(dto.coveredAmount !== undefined
          ? { coveredAmount: this.asDecimal(dto.coveredAmount) }
          : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
        ...(staffId ? { updatedById: staffId } : {}),
      },
    });
  }

  async getWallet(patientId: string) {
    const patient = await this.prisma.patient.findUnique({
      where: { id: patientId },
    });
    if (!patient) throw new NotFoundException(`Patient ${patientId} not found`);
    return this.ensureWallet(patientId);
  }

  async depositToWallet(
    patientId: string,
    dto: WalletDepositDto,
    createdByStaffId?: string,
  ) {
    const patient = await this.prisma.patient.findUnique({
      where: { id: patientId },
    });
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
          ...(createdByStaffId ? { createdById: createdByStaffId } : {}),
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
        invoiceID: generateInvoiceHumanId(),
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
    serviceId?: string;
    drugId?: string;
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
        drugId: params.drugId,
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
        invoiceID: generateInvoiceHumanId(),
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
    const unitPrice = batch
      ? new Prisma.Decimal(batch.sellingPrice)
      : new Prisma.Decimal(0);
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
