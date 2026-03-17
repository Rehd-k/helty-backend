import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  TransactionAuditAction,
  TransactionStatus,
  Prisma,
} from '@prisma/client';
import { customAlphabet } from 'nanoid';
import {
  AddTransactionItemDto,
  ApplyDiscountDto,
  ApplyInsuranceDto,
  CancelTransactionDto,
  CreateQuickTransactionDto,
  CreateTransactionDto,
  CreateRefundDto,
  EditTransactionItemDto,
  QueryTransactionDto,
  RecordPaymentDto,
  UpdateInsuranceClaimDto,
  UpdateTransactionDto,
} from './dto/create-bill.dto';
import { parseDateRange } from '../../common/utils/date-range';

// UUID regex
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Short human-facing transaction IDs (10-char alphanumeric)
const nanoid10 = customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ', 10);

// ─── Allowed status transitions ───────────────────────────────────────────────
const VALID_TRANSITIONS: Partial<
  Record<TransactionStatus, TransactionStatus[]>
> = {
  [TransactionStatus.CANCELLED]: [TransactionStatus.DRAFT],
  [TransactionStatus.DRAFT]: [TransactionStatus.ACTIVE],
};

@Injectable()
export class TransactionService {
  private readonly logger = new Logger(TransactionService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private async generateTransactionNumber(): Promise<string> {
    return nanoid10();
  }

  /**
   * Fetch a transaction by internal UUID or the human-readable transactionID.
   * Uses findFirst with OR so it works for both.
   * Throws 404 with a helpful message if not found.
   */
  private async getTransactionOrThrow(
    idOrTransactionID: string,
    include?: Prisma.TransactionInclude,
  ) {
    const isUUID = UUID_RE.test(idOrTransactionID);

    const where: Prisma.TransactionWhereInput = isUUID
      ? { id: idOrTransactionID }
      : { transactionID: idOrTransactionID };

    const transaction = await this.prisma.transaction.findFirst({
      where,
      include: include ?? {
        items: true,
        payments: true,
        discounts: true,
        insuranceClaims: true,
        refunds: true,
      },
    });

    if (!transaction) {
      throw new NotFoundException(
        `Transaction "${idOrTransactionID}" was not found. ` +
          `Check that the ID or Transaction Number is correct.`,
      );
    }
    return transaction;
  }

  private assertNotCancelled(t: {
    status: TransactionStatus;
    id: string;
    transactionID: string;
  }) {
    if (t.status === TransactionStatus.CANCELLED) {
      throw new BadRequestException(
        `Transaction ${t.transactionID} is cancelled and cannot be modified. ` +
          `Reopen the transaction first if you need to make changes.`,
      );
    }
  }

  private assertNotPaid(t: {
    status: TransactionStatus;
    id: string;
    transactionID: string;
  }) {
    if (t.status === TransactionStatus.PAID) {
      throw new BadRequestException(
        `Transaction ${t.transactionID} is already fully paid.`,
      );
    }
  }

  /** Recalculate totalAmount from items and sync the transaction status */
  private async recalculateTotals(transactionId: string) {
    const items = await this.prisma.transactionItem.findMany({
      where: { transactionId },
    });

    const totalAmount = items.reduce(
      (sum, item) => sum.add(item.totalPrice),
      new Prisma.Decimal(0),
    );

    const transaction = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
    });
    if (!transaction) return;

    const outstanding = totalAmount
      .sub(transaction.discountAmount)
      .sub(transaction.insuranceCovered)
      .sub(transaction.amountPaid);

    let status: TransactionStatus = transaction.status;
    if (transaction.status !== TransactionStatus.CANCELLED) {
      if (outstanding.lte(0) && totalAmount.gt(0)) {
        status = TransactionStatus.PAID;
      } else if (transaction.amountPaid.gt(0)) {
        status = TransactionStatus.PARTIALLY_PAID;
      } else if (totalAmount.gt(0)) {
        status = TransactionStatus.ACTIVE;
      } else {
        status = TransactionStatus.DRAFT;
      }
    }

    await this.prisma.transaction.update({
      where: { id: transactionId },
      data: { totalAmount, status },
    });
  }

  /** Write an immutable audit log entry.
   *  Pass `tx` when calling from inside a `prisma.$transaction` block so the
   *  audit log is rolled back together with every other write if the transaction fails.
   */
  private async log(
    transactionId: string,
    action: TransactionAuditAction,
    description: string,
    performedById: string,
    metadata?: object,
    tx?: Prisma.TransactionClient,
  ) {
    const db = tx ?? this.prisma;
    await db.transactionAuditLog.create({
      data: {
        transactionId,
        action,
        description,
        performedById,
        createdById: performedById,
        metadata: metadata ? (metadata as Prisma.InputJsonValue) : undefined,
      },
    });
  }

  // ─── Create Transaction ───────────────────────────────────────────────────────────

  async createTransaction(dto: CreateTransactionDto) {
    // Validate patient exists
    const patient = await this.prisma.patient.findUnique({
      where: { id: dto.patientId },
      select: { id: true, firstName: true, surname: true, patientId: true },
    });
    if (!patient) {
      throw new NotFoundException(
        `Patient with ID "${dto.patientId}" does not exist.`,
      );
    }

    // Validate staff exists
    const staff = await this.prisma.staff.findUnique({
      where: { id: dto.staffId },
      select: { id: true, firstName: true, lastName: true },
    });
    if (!staff) {
      throw new NotFoundException(
        `Staff with ID "${dto.staffId}" does not exist.`,
      );
    }

    // Validate admission if provided
    if (dto.admissionId) {
      const admission = await this.prisma.admission.findUnique({
        where: { id: dto.admissionId },
      });
      if (!admission) {
        throw new NotFoundException(
          `Admission with ID "${dto.admissionId}" does not exist.`,
        );
      }
      if (admission.patientId !== dto.patientId) {
        throw new BadRequestException(
          `Admission "${dto.admissionId}" does not belong to patient "${dto.patientId}".`,
        );
      }
    }

    const transactionID = await this.generateTransactionNumber();

    const transaction = await this.prisma.transaction.create({
      data: {
        transactionID,
        patientId: dto.patientId,
        createdById: dto.staffId,
        updatedById: dto.staffId,
        admissionId: dto.admissionId,
        noIdPatientid: dto.noIdPatientId,
        notes: dto.notes,
        status: TransactionStatus.DRAFT,
      },
      include: {
        patient: {
          select: { id: true, patientId: true, firstName: true, surname: true },
        },
        createdBy: {
          select: { id: true, firstName: true, lastName: true, role: true },
        },
      },
    });

    await this.log(
      transaction.id,
      TransactionAuditAction.BILL_CREATED,
      `Transaction ${transactionID} created for patient ${patient.patientId} (${patient.firstName} ${patient.surname}) by ${staff.firstName} ${staff.lastName}`,
      dto.staffId,
      { transactionID, patientId: dto.patientId },
    );

    this.logger.log(
      `Transaction ${transactionID} created by staff ${dto.staffId}`,
    );
    return transaction;
  }

  // ─── List / Search Transactions ───────────────────────────────────────────────────

  async findAll(query: QueryTransactionDto) {
    const {
      search,
      transactionID,
      patientId,
      patientName,
      phoneNumber,
      createdById,
      status,
      fromDate,
      toDate,
      skip = 0,
      take = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;

    const andConditions: Prisma.TransactionWhereInput[] = [];

    // ── transactionID filter ──
    if (transactionID?.trim()) {
      andConditions.push({
        transactionID: { contains: transactionID.trim(), mode: 'insensitive' },
      });
    }

    // ── patientId filter ──
    if (patientId?.trim()) {
      andConditions.push({ patientId: patientId.trim() });
    }

    // ── status filter ──
    if (status) {
      andConditions.push({ status });
    }

    // ── createdBy (staff) filter ──
    if (createdById?.trim()) {
      andConditions.push({ createdById: createdById.trim() });
    }

    // ── date range filter (required) ──
    {
      const { from, to } = parseDateRange(fromDate, toDate);
      andConditions.push({ createdAt: { gte: from, lte: to } });
    }

    // ── patient name / phone filter ──
    if (patientName?.trim() || phoneNumber?.trim()) {
      const patientConditions: Prisma.PatientWhereInput[] = [];
      if (patientName?.trim()) {
        patientConditions.push(
          { firstName: { contains: patientName.trim(), mode: 'insensitive' } },
          { surname: { contains: patientName.trim(), mode: 'insensitive' } },
          { otherName: { contains: patientName.trim(), mode: 'insensitive' } },
        );
      }
      if (phoneNumber?.trim()) {
        patientConditions.push({
          phoneNumber: { contains: phoneNumber.trim(), mode: 'insensitive' },
        });
      }
      andConditions.push({ patient: { OR: patientConditions } });
    }

    // ── free-text search (cross-field) ──
    // search is treated as an OR across multiple fields
    // It is merged with AND conditions using a nested AND
    let searchCondition: Prisma.TransactionWhereInput | undefined;
    if (search?.trim()) {
      const term = search.trim();
      searchCondition = {
        OR: [
          { transactionID: { contains: term, mode: 'insensitive' } },
          {
            patient: {
              OR: [
                { firstName: { contains: term, mode: 'insensitive' } },
                { surname: { contains: term, mode: 'insensitive' } },
                { otherName: { contains: term, mode: 'insensitive' } },
                { phoneNumber: { contains: term, mode: 'insensitive' } },
                {
                  patientId: {
                    contains: term.toUpperCase(),
                    mode: 'insensitive',
                  },
                },
              ],
            },
          },
          {
            createdBy: {
              OR: [
                { firstName: { contains: term, mode: 'insensitive' } },
                { lastName: { contains: term, mode: 'insensitive' } },
                { staffId: { contains: term, mode: 'insensitive' } },
              ],
            },
          },
        ],
      };
    }

    const where: Prisma.TransactionWhereInput = {
      AND: [
        ...(andConditions.length ? andConditions : [{}]),
        ...(searchCondition ? [searchCondition] : []),
      ],
    };

    const allowedSortFields = new Set([
      'createdAt',
      'updatedAt',
      'totalAmount',
      'amountPaid',
      'status',
    ]);
    const orderBy: Prisma.TransactionOrderByWithRelationInput =
      allowedSortFields.has(sortBy ?? '')
        ? { [sortBy]: sortOrder ?? 'desc' }
        : { createdAt: 'desc' };

    const [data, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        skip,
        take,
        orderBy,
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
          noIdPatient: {
            select: { id: true, firstName: true, surname: true },
          },
          createdBy: {
            select: {
              id: true,
              staffId: true,
              firstName: true,
              lastName: true,
              role: true,
            },
          },
          updatedBy: {
            select: {
              id: true,
              staffId: true,
              firstName: true,
              lastName: true,
            },
          },
          _count: {
            select: {
              items: true,
              payments: true,
              discounts: true,
              refunds: true,
            },
          },
        },
      }),
      this.prisma.transaction.count({ where }),
    ]);

    console.log(data);

    return {
      data,
      total,
      skip,
      take,
      pageCount: Math.ceil(total / (take || 1)),
    };
  }

  /**
   * List transactions whose linked patient has a NULL hospital `patientId`.
   * This is used to find bills for patients that are in the system but have
   * not yet been assigned an official patientId so they can be properly
   * completed/registered.
   *
   * Requires at least one of fromDate / toDate so the query is always scoped
   * to a date range.
   */
  async findUnregisteredPatientTransactions(query: QueryTransactionDto) {
    const {
      search,
      transactionID,
      patientName,
      phoneNumber,
      createdById,
      status,
      fromDate,
      toDate,
      skip = 0,
      take = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;

    // fromDate/toDate are required by DTO validation

    const andConditions: Prisma.TransactionWhereInput[] = [
      {
        patient: {
          patientId: null,
        },
      },
    ];

    if (transactionID?.trim()) {
      andConditions.push({
        transactionID: { contains: transactionID.trim(), mode: 'insensitive' },
      });
    }

    if (status) {
      andConditions.push({ status });
    }

    if (createdById?.trim()) {
      andConditions.push({ createdById: createdById.trim() });
    }

    const { from, to } = parseDateRange(fromDate, toDate);
    andConditions.push({ createdAt: { gte: from, lte: to } });

    if (patientName?.trim() || phoneNumber?.trim()) {
      const patientConditions: Prisma.PatientWhereInput[] = [];
      if (patientName?.trim()) {
        patientConditions.push(
          { firstName: { contains: patientName.trim(), mode: 'insensitive' } },
          { surname: { contains: patientName.trim(), mode: 'insensitive' } },
          { otherName: { contains: patientName.trim(), mode: 'insensitive' } },
        );
      }
      if (phoneNumber?.trim()) {
        patientConditions.push({
          phoneNumber: { contains: phoneNumber.trim(), mode: 'insensitive' },
        });
      }
      andConditions.push({ patient: { OR: patientConditions } });
    }

    let searchCondition: Prisma.TransactionWhereInput | undefined;
    if (search?.trim()) {
      const term = search.trim();
      searchCondition = {
        OR: [
          { transactionID: { contains: term, mode: 'insensitive' } },
          {
            patient: {
              OR: [
                { firstName: { contains: term, mode: 'insensitive' } },
                { surname: { contains: term, mode: 'insensitive' } },
                { otherName: { contains: term, mode: 'insensitive' } },
                { phoneNumber: { contains: term, mode: 'insensitive' } },
              ],
            },
          },
          {
            createdBy: {
              OR: [
                { firstName: { contains: term, mode: 'insensitive' } },
                { lastName: { contains: term, mode: 'insensitive' } },
                { staffId: { contains: term, mode: 'insensitive' } },
              ],
            },
          },
        ],
      };
    }

    const where: Prisma.TransactionWhereInput = {
      AND: [
        ...(andConditions.length ? andConditions : [{}]),
        ...(searchCondition ? [searchCondition] : []),
      ],
    };

    const allowedSortFields = new Set([
      'createdAt',
      'updatedAt',
      'totalAmount',
      'amountPaid',
      'status',
    ]);
    const orderBy: Prisma.TransactionOrderByWithRelationInput =
      allowedSortFields.has(sortBy ?? '')
        ? { [sortBy]: sortOrder ?? 'desc' }
        : { createdAt: 'desc' };

    const [data, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        skip,
        take,
        orderBy,
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
          noIdPatient: {
            select: { id: true, firstName: true, surname: true },
          },
          createdBy: {
            select: {
              id: true,
              staffId: true,
              firstName: true,
              lastName: true,
              role: true,
            },
          },
          updatedBy: {
            select: {
              id: true,
              staffId: true,
              firstName: true,
              lastName: true,
            },
          },
          _count: {
            select: {
              items: true,
              payments: true,
              discounts: true,
              refunds: true,
            },
          },
        },
      }),
      this.prisma.transaction.count({ where }),
    ]);
    return {
      data,
      total,
      skip,
      take,
      pageCount: Math.ceil(total / (take || 1)),
    };
  }

  // ─── Get Single Transaction ───────────────────────────────────────────────────────

  async findOne(idOrTransactionID: string) {
    const isUUID = UUID_RE.test(idOrTransactionID);
    const where: Prisma.TransactionWhereInput = isUUID
      ? { id: idOrTransactionID }
      : { transactionID: idOrTransactionID };

    const transaction = await this.prisma.transaction.findFirst({
      where,
      include: {
        patient: {
          select: {
            id: true,
            patientId: true,
            firstName: true,
            surname: true,
            otherName: true,
            phoneNumber: true,
            email: true,
            gender: true,
            dob: true,
          },
        },

        noIdPatient: true,
        admission: true,
        createdBy: {
          select: {
            id: true,
            staffId: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
        updatedBy: {
          select: {
            id: true,
            staffId: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
        cancelledBy: {
          select: {
            id: true,
            staffId: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
        items: {
          include: {
            addedBy: {
              select: { id: true, firstName: true, lastName: true, role: true },
            },
            priceEditedBy: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        payments: {
          include: {
            receivedBy: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
          orderBy: { paidAt: 'desc' },
        },
        discounts: {
          include: {
            grantedBy: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        insuranceClaims: { orderBy: { createdAt: 'desc' } },
        refunds: {
          include: {
            processedBy: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
          orderBy: { refundedAt: 'desc' },
        },
        _count: {
          select: {
            items: true,
            payments: true,
            discounts: true,
            refunds: true,
            auditLogs: true,
          },
        },
      },
    });

    if (!transaction) {
      throw new NotFoundException(
        `Transaction "${idOrTransactionID}" was not found. ` +
          `Provide either the internal UUID or the Transaction ID (e.g. BILL-2025-00001).`,
      );
    }

    const outstanding = transaction.totalAmount
      .sub(transaction.discountAmount)
      .sub(transaction.insuranceCovered)
      .sub(transaction.amountPaid);

    return { ...transaction, outstandingBalance: outstanding };
  }

  // ─── Update Transaction ───────────────────────────────────────────────────────────

  async update(idOrTransactionID: string, dto: UpdateTransactionDto) {
    const transaction = await this.getTransactionOrThrow(idOrTransactionID, {});

    // Validate staff
    const staff = await this.prisma.staff.findUnique({
      where: { id: dto.staffId },
      select: { id: true, firstName: true, lastName: true },
    });
    if (!staff) {
      throw new NotFoundException(`Staff "${dto.staffId}" not found.`);
    }

    // Status transition validation
    if (dto.status && dto.status !== transaction.status) {
      const allowed = VALID_TRANSITIONS[transaction.status] ?? [];
      if (!allowed.includes(dto.status)) {
        throw new UnprocessableEntityException(
          `Cannot transition transaction from "${transaction.status}" to "${dto.status}". ` +
            `Allowed transitions from ${transaction.status}: ${
              allowed.length ? allowed.join(', ') : 'none'
            }.`,
        );
      }
    }

    const data: Prisma.TransactionUpdateInput = {
      updatedBy: { connect: { id: dto.staffId } },
    };
    if (dto.notes !== undefined) data.notes = dto.notes;
    if (dto.status) data.status = dto.status;

    const updated = await this.prisma.transaction.update({
      where: { id: transaction.id },
      data,
      include: {
        patient: {
          select: { id: true, patientId: true, firstName: true, surname: true },
        },
        updatedBy: {
          select: { id: true, firstName: true, lastName: true, role: true },
        },
      },
    });

    const changes: string[] = [];
    if (dto.notes !== undefined) changes.push(`notes updated`);
    if (dto.status)
      changes.push(`status changed from ${transaction.status} → ${dto.status}`);

    const auditAction =
      dto.status === TransactionStatus.DRAFT ||
      dto.status === TransactionStatus.ACTIVE
        ? TransactionAuditAction.BILL_REOPENED
        : TransactionAuditAction.BILL_CREATED;

    await this.log(
      transaction.id,
      auditAction,
      `Transaction updated by ${staff.firstName} ${staff.lastName}: ${changes.join('; ')}`,
      dto.staffId,
      { changes, previousStatus: transaction.status, newStatus: dto.status },
    );

    return updated;
  }

  // ─── findByPatient ────────────────────────────────────────────────────────────────

  async findByPatient(patientId: string) {
    const patient = await this.prisma.patient.findUnique({
      where: { id: patientId },
      select: { id: true, firstName: true, surname: true, patientId: true },
    });
    if (!patient) {
      throw new NotFoundException(`Patient "${patientId}" not found.`);
    }

    const [data, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where: { patientId },
        orderBy: { createdAt: 'desc' },
        include: {
          createdBy: {
            select: { id: true, firstName: true, lastName: true, role: true },
          },
          _count: { select: { items: true, payments: true } },
        },
      }),
      this.prisma.transaction.count({ where: { patientId } }),
    ]);

    return { patient, data, total };
  }

  // ─── Add Item ─────────────────────────────────────────────────────────────────────

  async addItem(transactionId: string, dto: AddTransactionItemDto) {
    const transaction = await this.getTransactionOrThrow(transactionId);
    this.assertNotCancelled(transaction);

    const staff = await this.prisma.staff.findUnique({
      where: { id: dto.staffId },
    });
    if (!staff)
      throw new NotFoundException(`Staff "${dto.staffId}" not found.`);

    if (dto.quantity < 1) {
      throw new BadRequestException('Quantity must be at least 1.');
    }
    if (dto.unitPrice < 0) {
      throw new BadRequestException('Unit price cannot be negative.');
    }

    const unitPrice = new Prisma.Decimal(dto.unitPrice);
    const totalPrice = unitPrice.mul(dto.quantity);

    const item = await this.prisma.transactionItem.create({
      data: {
        transactionId: transaction.id,
        description: dto.description,
        source: dto.source,
        quantity: dto.quantity,
        unitPrice,
        totalPrice,
        addedById: dto.staffId,
        referenceId: dto.referenceId,
        createdById: dto.staffId,
        updatedById: dto.staffId,
      },
      include: {
        addedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    await this.recalculateTotals(transaction.id);
    await this.log(
      transaction.id,
      TransactionAuditAction.ITEM_ADDED,
      `Item "${dto.description}" (${dto.source}) added — qty: ${dto.quantity}, unit price: ₦${dto.unitPrice}, total: ₦${totalPrice}`,
      dto.staffId,
      {
        itemId: item.id,
        description: dto.description,
        source: dto.source,
        unitPrice: dto.unitPrice,
        quantity: dto.quantity,
        totalPrice,
      },
    );

    return item;
  }

  // ─── Edit Item ────────────────────────────────────────────────────────────────────

  async editItemPrice(
    transactionId: string,
    itemId: string,
    dto: EditTransactionItemDto,
  ) {
    const transaction = await this.getTransactionOrThrow(transactionId);
    this.assertNotCancelled(transaction);

    const existing = await this.prisma.transactionItem.findFirst({
      where: { id: itemId, transactionId: transaction.id },
    });
    if (!existing) {
      throw new NotFoundException(
        `Item "${itemId}" was not found on transaction "${transactionId}". ` +
          `Verify that the item belongs to this transaction.`,
      );
    }

    const staff = await this.prisma.staff.findUnique({
      where: { id: dto.staffId },
    });
    if (!staff)
      throw new NotFoundException(`Staff "${dto.staffId}" not found.`);

    const newUnitPrice = new Prisma.Decimal(dto.unitPrice);
    const newQuantity = dto.quantity ?? existing.quantity;

    if (newQuantity < 1)
      throw new BadRequestException('Quantity must be at least 1.');
    if (newUnitPrice.lt(0))
      throw new BadRequestException('Unit price cannot be negative.');

    const newTotalPrice = newUnitPrice.mul(newQuantity);

    const updated = await this.prisma.transactionItem.update({
      where: { id: itemId },
      data: {
        unitPrice: newUnitPrice,
        quantity: newQuantity,
        totalPrice: newTotalPrice,
        description: dto.description ?? existing.description,
        priceEditedById: dto.staffId,
        priceEditedAt: new Date(),
        updatedById: dto.staffId,
      },
    });

    await this.recalculateTotals(transaction.id);
    await this.log(
      transaction.id,
      TransactionAuditAction.ITEM_EDITED,
      `Item "${existing.description}" updated — ` +
        `price: ₦${existing.unitPrice} → ₦${dto.unitPrice}, ` +
        `qty: ${existing.quantity} → ${newQuantity}`,
      dto.staffId,
      {
        itemId,
        oldUnitPrice: existing.unitPrice,
        newUnitPrice: dto.unitPrice,
        oldQuantity: existing.quantity,
        newQuantity,
        oldDescription: existing.description,
        newDescription: dto.description,
      },
    );

    return updated;
  }

  // ─── Record Payment ───────────────────────────────────────────────────────────────

  async recordPayment(transactionId: string, dto: RecordPaymentDto) {
    const transaction = await this.getTransactionOrThrow(transactionId);
    this.assertNotCancelled(transaction);
    this.assertNotPaid(transaction);

    const staff = await this.prisma.staff.findUnique({
      where: { id: dto.staffId },
    });
    if (!staff)
      throw new NotFoundException(`Staff "${dto.staffId}" not found.`);

    if (transaction.totalAmount.lte(0)) {
      throw new BadRequestException(
        `Transaction ${transaction.transactionID} has no items. ` +
          `Add items before recording a payment.`,
      );
    }

    const outstanding = transaction.totalAmount
      .sub(transaction.discountAmount)
      .sub(transaction.insuranceCovered)
      .sub(transaction.amountPaid);

    const paymentAmount = new Prisma.Decimal(dto.amount);
    if (paymentAmount.lte(0)) {
      throw new BadRequestException(
        'Payment amount must be greater than zero.',
      );
    }
    if (paymentAmount.gt(outstanding)) {
      throw new BadRequestException(
        `Payment amount ₦${dto.amount} exceeds outstanding balance ₦${outstanding.toFixed(2)}. ` +
          `Reduce the payment amount or issue a refund for previous overpayments.`,
      );
    }

    // Resolve bank (if caller provided one)
    let bankId: string | undefined;
    if (dto.bankAccountNumber) {
      const bank = await this.prisma.bank.findUnique({
        where: { accountNumber: dto.bankAccountNumber },
      });
      if (!bank) {
        throw new NotFoundException(
          `No bank found with account number "${dto.bankAccountNumber}". ` +
            `Register the bank first at POST /bank.`,
        );
      }
      bankId = bank.id;
    }

    const payment = await this.prisma.transactionPayment.create({
      data: {
        transactionId: transaction.id,
        amount: paymentAmount,
        method: dto.method,
        reference: dto.reference,
        notes: dto.notes,
        receivedById: dto.staffId,
        createdById: dto.staffId,
        ...(bankId && { bankId }),
      },
      include: {
        receivedBy: { select: { id: true, firstName: true, lastName: true } },
        bank: { select: { id: true, name: true, accountNumber: true } },
      },
    });

    const newAmountPaid = transaction.amountPaid.add(paymentAmount);
    const newOutstanding = outstanding.sub(paymentAmount);
    const newStatus = newOutstanding.lte(0)
      ? TransactionStatus.PAID
      : TransactionStatus.PARTIALLY_PAID;

    await this.prisma.transaction.update({
      where: { id: transaction.id },
      data: {
        amountPaid: newAmountPaid,
        status: newStatus,
        updatedById: dto.staffId,
      },
    });

    await this.log(
      transaction.id,
      TransactionAuditAction.PAYMENT_RECEIVED,
      `Payment of ₦${dto.amount} received via ${dto.method}` +
        (dto.reference ? ` (ref: ${dto.reference})` : '') +
        `. Outstanding balance: ₦${newOutstanding.toFixed(2)}`,
      dto.staffId,
      {
        paymentId: payment.id,
        amount: dto.amount,
        method: dto.method,
        reference: dto.reference,
        newOutstanding: newOutstanding.toFixed(2),
      },
    );

    return { ...payment, newOutstanding, newStatus };
  }

  // ─── Apply Discount ───────────────────────────────────────────────────────────────

  async applyDiscount(transactionId: string, dto: ApplyDiscountDto) {
    const transaction = await this.getTransactionOrThrow(transactionId);
    this.assertNotCancelled(transaction);

    const staff = await this.prisma.staff.findUnique({
      where: { id: dto.staffId },
    });
    if (!staff)
      throw new NotFoundException(`Staff "${dto.staffId}" not found.`);

    if (transaction.totalAmount.lte(0)) {
      throw new BadRequestException(
        `Cannot apply a discount to ${transaction.transactionID} — no items have been added yet.`,
      );
    }

    let computedAmount: Prisma.Decimal;
    if (dto.type === 'PERCENTAGE') {
      if (dto.value > 100) {
        throw new BadRequestException(
          'Percentage discount cannot exceed 100%.',
        );
      }
      computedAmount = transaction.totalAmount.mul(dto.value).div(100);
    } else {
      computedAmount = new Prisma.Decimal(dto.value);
    }

    const newDiscountTotal = transaction.discountAmount.add(computedAmount);
    if (newDiscountTotal.gt(transaction.totalAmount)) {
      throw new BadRequestException(
        `Total discounts (₦${newDiscountTotal.toFixed(2)}) would exceed the transaction total (₦${transaction.totalAmount.toFixed(2)}).`,
      );
    }

    const discount = await this.prisma.transactionDiscount.create({
      data: {
        transactionId: transaction.id,
        type: dto.type,
        value: new Prisma.Decimal(dto.value),
        computedAmount,
        reason: dto.reason,
        grantedById: dto.staffId,
        createdById: dto.staffId,
      },
      include: {
        grantedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    await this.prisma.transaction.update({
      where: { id: transaction.id },
      data: { discountAmount: newDiscountTotal, updatedById: dto.staffId },
    });

    await this.log(
      transaction.id,
      TransactionAuditAction.DISCOUNT_APPLIED,
      `Discount applied by ${staff.firstName} ${staff.lastName}: ${
        dto.type === 'PERCENTAGE' ? `${dto.value}%` : `₦${dto.value} fixed`
      } — computed ₦${computedAmount.toFixed(2)}. Reason: ${dto.reason}`,
      dto.staffId,
      {
        discountId: discount.id,
        type: dto.type,
        value: dto.value,
        computedAmount,
      },
    );

    return discount;
  }

  // ─── Apply Insurance ──────────────────────────────────────────────────────────────

  async applyInsurance(transactionId: string, dto: ApplyInsuranceDto) {
    const transaction = await this.getTransactionOrThrow(transactionId);
    this.assertNotCancelled(transaction);

    const staff = await this.prisma.staff.findUnique({
      where: { id: dto.staffId },
    });
    if (!staff)
      throw new NotFoundException(`Staff "${dto.staffId}" not found.`);

    const coveredAmount = new Prisma.Decimal(dto.coveredAmount);

    const newInsuranceTotal = transaction.insuranceCovered.add(coveredAmount);
    const outstandingAfter = transaction.totalAmount
      .sub(transaction.discountAmount)
      .sub(newInsuranceTotal)
      .sub(transaction.amountPaid);

    if (outstandingAfter.lt(0)) {
      throw new BadRequestException(
        `Insurance coverage of ₦${dto.coveredAmount} would exceed the remaining balance. ` +
          `Maximum allowed coverage for this transaction is ₦${transaction.totalAmount
            .sub(transaction.discountAmount)
            .sub(transaction.insuranceCovered)
            .sub(transaction.amountPaid)
            .toFixed(2)}.`,
      );
    }

    const claim = await this.prisma.insuranceClaim.create({
      data: {
        transactionId: transaction.id,
        provider: dto.provider,
        policyNumber: dto.policyNumber,
        coveredAmount,
        notes: dto.notes,
        createdById: dto.staffId,
      },
    });

    await this.prisma.transaction.update({
      where: { id: transaction.id },
      data: { insuranceCovered: newInsuranceTotal, updatedById: dto.staffId },
    });

    await this.log(
      transaction.id,
      TransactionAuditAction.INSURANCE_APPLIED,
      `Insurance claim applied by ${staff.firstName} ${staff.lastName}: ${dto.provider}` +
        (dto.policyNumber ? ` (policy: ${dto.policyNumber})` : '') +
        ` — covered ₦${dto.coveredAmount}`,
      dto.staffId,
      {
        claimId: claim.id,
        provider: dto.provider,
        policyNumber: dto.policyNumber,
        coveredAmount: dto.coveredAmount,
      },
    );

    return claim;
  }

  // ─── Update Insurance Claim ───────────────────────────────────────────────────────

  async updateInsuranceClaim(
    transactionId: string,
    claimId: string,
    dto: UpdateInsuranceClaimDto,
  ) {
    const transaction = await this.getTransactionOrThrow(transactionId);
    this.assertNotCancelled(transaction);

    const claim = await this.prisma.insuranceClaim.findFirst({
      where: { id: claimId, transactionId: transaction.id },
    });
    if (!claim) {
      throw new NotFoundException(
        `Insurance claim "${claimId}" not found on transaction "${transactionId}".`,
      );
    }

    const staff = await this.prisma.staff.findUnique({
      where: { id: dto.staffId },
    });
    if (!staff)
      throw new NotFoundException(`Staff "${dto.staffId}" not found.`);

    const updateData: Prisma.InsuranceClaimUpdateInput = {
      updatedBy: { connect: { id: dto.staffId } },
    };
    if (dto.status !== undefined) updateData.status = dto.status;
    if (dto.notes !== undefined) updateData.notes = dto.notes;

    if (dto.coveredAmount !== undefined) {
      const newCovered = new Prisma.Decimal(dto.coveredAmount);
      const coveredDiff = newCovered.sub(claim.coveredAmount);
      const newInsuranceTotal = transaction.insuranceCovered.add(coveredDiff);
      const outstandingAfter = transaction.totalAmount
        .sub(transaction.discountAmount)
        .sub(newInsuranceTotal)
        .sub(transaction.amountPaid);

      if (outstandingAfter.lt(0)) {
        throw new BadRequestException(
          `Updated coverage would exceed the remaining balance. Please reduce the covered amount.`,
        );
      }

      updateData.coveredAmount = newCovered;
      await this.prisma.transaction.update({
        where: { id: transaction.id },
        data: { insuranceCovered: newInsuranceTotal, updatedById: dto.staffId },
      });
    }

    const updated = await this.prisma.insuranceClaim.update({
      where: { id: claimId },
      data: updateData,
    });

    await this.log(
      transaction.id,
      TransactionAuditAction.INSURANCE_APPLIED,
      `Insurance claim "${claimId}" updated by ${staff.firstName} ${staff.lastName}`,
      dto.staffId,
      { claimId, changes: dto },
    );

    return updated;
  }

  // ─── Issue Refund ─────────────────────────────────────────────────────────────────

  async issueRefund(transactionId: string, dto: CreateRefundDto) {
    const transaction = await this.getTransactionOrThrow(transactionId);

    const staff = await this.prisma.staff.findUnique({
      where: { id: dto.staffId },
    });
    if (!staff)
      throw new NotFoundException(`Staff "${dto.staffId}" not found.`);

    const refundAmount = new Prisma.Decimal(dto.amount);
    if (refundAmount.lte(0)) {
      throw new BadRequestException('Refund amount must be greater than zero.');
    }
    if (refundAmount.gt(transaction.amountPaid)) {
      throw new BadRequestException(
        `Refund amount ₦${dto.amount} exceeds the total amount paid ₦${transaction.amountPaid.toFixed(2)} ` +
          `on transaction ${transaction.transactionID}.`,
      );
    }

    const refund = await this.prisma.transactionRefund.create({
      data: {
        transactionId: transaction.id,
        amount: refundAmount,
        reason: dto.reason,
        processedById: dto.staffId,
        createdById: dto.staffId,
      },
      include: {
        processedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    const newAmountPaid = transaction.amountPaid.sub(refundAmount);
    const outstanding = transaction.totalAmount
      .sub(transaction.discountAmount)
      .sub(transaction.insuranceCovered)
      .sub(newAmountPaid);

    const newStatus = newAmountPaid.lte(0)
      ? TransactionStatus.REFUNDED
      : outstanding.lte(0)
        ? TransactionStatus.PAID
        : TransactionStatus.PARTIALLY_PAID;

    await this.prisma.transaction.update({
      where: { id: transaction.id },
      data: {
        amountPaid: newAmountPaid,
        status: newStatus,
        updatedById: dto.staffId,
      },
    });

    await this.log(
      transaction.id,
      TransactionAuditAction.REFUND_ISSUED,
      `Refund of ₦${dto.amount} issued by ${staff.firstName} ${staff.lastName}. ` +
        `Reason: ${dto.reason}. New status: ${newStatus}`,
      dto.staffId,
      {
        refundId: refund.id,
        amount: dto.amount,
        reason: dto.reason,
        newStatus,
      },
    );

    return { ...refund, newStatus, newAmountPaid };
  }

  // ─── Cancel Transaction ───────────────────────────────────────────────────────────

  async cancelTransaction(transactionId: string, dto: CancelTransactionDto) {
    const transaction = await this.getTransactionOrThrow(transactionId);
    this.assertNotCancelled(transaction);

    const staff = await this.prisma.staff.findUnique({
      where: { id: dto.staffId },
    });
    if (!staff)
      throw new NotFoundException(`Staff "${dto.staffId}" not found.`);

    if (transaction.amountPaid.gt(0)) {
      throw new BadRequestException(
        `Cannot cancel transaction ${transaction.transactionID} — ` +
          `₦${transaction.amountPaid.toFixed(2)} has already been paid. ` +
          `Issue a full refund first, then cancel.`,
      );
    }

    const updated = await this.prisma.transaction.update({
      where: { id: transaction.id },
      data: {
        status: TransactionStatus.CANCELLED,
        cancelledById: dto.staffId,
        cancelledAt: new Date(),
        cancellationReason: dto.reason,
        updatedById: dto.staffId,
      },
      include: {
        cancelledBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    await this.log(
      transaction.id,
      TransactionAuditAction.BILL_CANCELLED,
      `Transaction ${transaction.transactionID} cancelled by ${staff.firstName} ${staff.lastName}. ` +
        `Reason: ${dto.reason}`,
      dto.staffId,
      { reason: dto.reason },
    );

    return updated;
  }

  // ─── Audit Log ────────────────────────────────────────────────────────────────────

  async getAuditLog(transactionId: string, skip = 0, take = 50) {
    const transaction = await this.getTransactionOrThrow(transactionId, {});

    const [logs, total] = await Promise.all([
      this.prisma.transactionAuditLog.findMany({
        where: { transactionId: transaction.id },
        orderBy: { createdAt: 'asc' },
        skip,
        take,
        include: {
          performedBy: {
            select: {
              id: true,
              staffId: true,
              firstName: true,
              lastName: true,
              role: true,
            },
          },
        },
      }),
      this.prisma.transactionAuditLog.count({
        where: { transactionId: transaction.id },
      }),
    ]);

    return { logs, total, skip, take };
  }

  // ─── Quick / Immediate Transaction ───────────────────────────────────────────
  /**
   * Creates a transaction, adds ALL items, applies optional discount,
   * records an immediate payment — all in one call.
   * Returns the fully-hydrated transaction (same shape as findOne).
   */
  async createQuickTransaction(dto: any) {
    // ── 1. Validate entities (read-only — outside the transaction) ─────────────
    const patient = await this.prisma.patient.findFirst({
      where: {
        OR: [{ patientId: dto.patientId }, { id: dto.patientId }],
      },
      select: { id: true, firstName: true, surname: true, patientId: true },
    });
    if (!patient) {
      throw new NotFoundException(`Patient "${dto.patientId}" does not exist.`);
    }

    const staff = await this.prisma.staff.findUnique({
      where: { id: dto.staffId },
      select: { id: true, firstName: true, lastName: true },
    });
    if (!staff) {
      throw new NotFoundException(`Staff "${dto.staffId}" does not exist.`);
    }

    if (dto.admissionId) {
      const admission = await this.prisma.admission.findUnique({
        where: { id: dto.admissionId },
      });
      if (!admission) {
        throw new NotFoundException(
          `Admission "${dto.admissionId}" does not exist.`,
        );
      }
      if (admission.patientId !== dto.patientId) {
        throw new BadRequestException(
          `Admission "${dto.admissionId}" does not belong to patient "${dto.patientId}".`,
        );
      }
    }

    // ── 2. Generate transaction number before opening the DB transaction ───────
    const transactionID = await this.generateTransactionNumber();

    // ── 3. Steps below are wrapped in an atomic DB transaction ────────────────
    const { transaction, finalStatus, totalAmount, amountPaid, itemSnapshots } =
      await this.prisma.$transaction(async (tx) => {
        // 3a. Validate items and compute totals
        let totalAmount = new Prisma.Decimal(0);
        const itemSnapshots: {
          description: string;
          unitPrice: number;
          quantity: number;
          total: string;
        }[] = [];

        const consultationKeywords = ['consultation'];

        const consultationItems: { name: string }[] = [];

        for (const [i, item] of dto.items.entries()) {
          if (item.quantity < 1) {
            throw new BadRequestException(
              `items[${i}] "${item.name}": quantity must be at least 1.`,
            );
          }
          if (item.unitPrice < 0) {
            throw new BadRequestException(
              `items[${i}] "${item.name}": unit price cannot be negative.`,
            );
          }

          const unitPrice = new Prisma.Decimal(item.unitPrice);
          const totalPrice = unitPrice.mul(item.quantity);
          totalAmount = totalAmount.add(totalPrice);

          const lowerName = String(item.name ?? '').toLowerCase();
          if (consultationKeywords.some((kw) => lowerName.includes(kw))) {
            consultationItems.push({ name: item.name });
          }

          itemSnapshots.push({
            description: item.name,
            unitPrice: item.unitPrice,
            quantity: item.quantity,
            total: totalPrice.toFixed(2),
          });
        }

        // 3b. Compute discount (already calculated client-side as a flat amount)
        const discountAmount = new Prisma.Decimal(dto.discount ?? 0);
        if (discountAmount.lt(0)) {
          throw new BadRequestException('Discount cannot be negative.');
        }
        if (discountAmount.gt(totalAmount)) {
          throw new BadRequestException(
            `Discount ₦${discountAmount.toFixed(
              2,
            )} would exceed the total ₦${totalAmount.toFixed(2)}.`,
          );
        }

        const insuranceCovered = new Prisma.Decimal(0);

        const billableAfterDiscount = totalAmount
          .sub(discountAmount)
          .sub(insuranceCovered);

        // 3c. Determine payment
        const amountPaid = new Prisma.Decimal(dto.amountPaid ?? 0);
        if (amountPaid.lt(0)) {
          throw new BadRequestException('Amount paid cannot be negative.');
        }
        if (amountPaid.gt(billableAfterDiscount)) {
          throw new BadRequestException(
            `Payment ₦${amountPaid.toFixed(
              2,
            )} exceeds the outstanding balance ₦${billableAfterDiscount.toFixed(
              2,
            )}.`,
          );
        }

        const remainingBalance = billableAfterDiscount.sub(amountPaid);

        let finalStatus: TransactionStatus;
        if (totalAmount.lte(0)) {
          finalStatus = TransactionStatus.DRAFT;
        } else if (remainingBalance.lte(0)) {
          finalStatus = TransactionStatus.PAID;
        } else if (amountPaid.gt(0)) {
          finalStatus = TransactionStatus.PARTIALLY_PAID;
        } else {
          finalStatus = TransactionStatus.ACTIVE;
        }

        // 3d. Create transaction header with final financials
        const transaction = await tx.transaction.create({
          data: {
            transactionID,
            patientId: patient.id,
            createdById: dto.staffId,
            updatedById: dto.staffId,
            admissionId: dto.admissionId,
            noIdPatientid: dto.noIdPatientId,
            amountPaid,
            totalAmount,
            discountAmount,
            insuranceCovered,
            status: finalStatus,
            notes: dto.notes,
          },
        });

        // 3e. Insert all items now that we have transaction.id
        for (const item of dto.items) {
          const unitPrice = new Prisma.Decimal(item.unitPrice);
          const totalPrice = unitPrice.mul(item.quantity);

          await tx.transactionItem.create({
            data: {
              transactionId: transaction.id,
              description: item.name,
              source: item.source,
              quantity: item.quantity,
              unitPrice,
              totalPrice,
              addedById: dto.staffId,
              referenceId: item.serviceId ?? item.referenceId,
              createdById: dto.staffId,
              updatedById: dto.staffId,
            },
          });
        }

        // 3f. Create payment record if any amount was paid
        if (amountPaid.gt(0)) {
          if (!dto.paymentMethod) {
            throw new BadRequestException(
              'paymentMethod is required when amountPaid > 0.',
            );
          }

          await tx.transactionPayment.create({
            data: {
              transactionId: transaction.id,
              amount: amountPaid,
              method: dto.paymentMethod.toUpperCase(),
              receivedById: dto.staffId,
              createdById: dto.staffId,
            },
          });
        }

        // 3g. For each consultation item, add the patient to the waiting list,
        //     linking to the matching Service (by exact name) when found.
        for (const cItem of consultationItems) {
          const service = await tx.service.findFirst({
            where: { name: cItem.name },
          });
          await tx.waitingPatient.create({
            data: {
              patient: { connect: { id: patient.id } },
              ...(service && { service: { connect: { id: service.id } } }),
              ...(dto.staffId && {
                createdBy: { connect: { id: dto.staffId } },
                updatedBy: { connect: { id: dto.staffId } },
              }),
            },
          });
        }

        // 3h. Single consolidated audit log
        const payLine = amountPaid.gt(0)
          ? `Payment of ₦${amountPaid.toFixed(
              2,
            )} via ${String(dto.paymentMethod).toUpperCase()} received. ` +
            `Balance remaining: ₦${remainingBalance.toFixed(2)}.`
          : 'No payment — bill is ACTIVE and awaiting cashier.';

        await this.log(
          transaction.id,
          TransactionAuditAction.PAYMENT_RECEIVED,
          `Quick transaction ${transactionID} created for ` +
            `${patient.firstName} ${patient.surname} (${patient.patientId}) ` +
            `by ${staff.firstName} ${staff.lastName}. ` +
            `${dto.items.length} item(s) — total ₦${totalAmount.toFixed(2)}` +
            (discountAmount.gt(0)
              ? `, discount ₦${discountAmount.toFixed(2)}`
              : '') +
            `. ${payLine}`,
          dto.staffId,
          {
            transactionID,
            patientId: dto.patientId,
            items: itemSnapshots,
            totalAmount: totalAmount.toFixed(2),
            discountAmount: discountAmount.toFixed(2),
            insuranceCovered: insuranceCovered.toFixed(2),
            amountPaid: amountPaid.toFixed(2),
            remainingBalance: remainingBalance.toFixed(2),
            finalStatus,
            consultationItemCount: consultationItems.length,
          },
          tx as any,
        );

        return {
          transaction,
          finalStatus,
          totalAmount,
          discountAmount,
          amountPaid,
          remainingBalance,
          itemSnapshots,
        };
      });

    // ── 4. Post-commit: logger and final hydrated response ─────────────────────
    this.logger.log(
      `Quick transaction ${transactionID} → status: ${finalStatus}, ` +
        `total: ₦${totalAmount.toFixed(2)}, paid: ₦${amountPaid.toFixed(2)}`,
    );

    const result = {
      transaction,
      patient,
      staff,
      itemSnapshots,
    };
    return result;
  }
}
