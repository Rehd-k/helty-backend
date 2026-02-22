import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TransactionAuditAction, TransactionStatus, Prisma } from '@prisma/client';
import {
  AddTransactionItemDto,
  ApplyDiscountDto,
  ApplyInsuranceDto,
  CancelTransactionDto,
  CreateTransactionDto,
  CreateRefundDto,
  EditTransactionItemDto,
  RecordPaymentDto,
} from './dto/create-bill.dto';

@Injectable()
export class TransactionService {
  constructor(private readonly prisma: PrismaService) { }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private async generateTransactionNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.prisma.transaction.count();
    const seq = String(count + 1).padStart(5, '0');
    return `BILL-${year}-${seq}`;
  }

  private async getTransactionOrThrow(id: string) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id },
      include: {
        items: true,
        payments: true,
        discounts: true,
        insuranceClaims: true,
        refunds: true,
      },
    });
    if (!transaction) throw new NotFoundException(`Transaction ${id} not found`);
    return transaction;
  }

  private assertNotCancelled(transaction: { status: TransactionStatus }) {
    if (transaction.status === TransactionStatus.CANCELLED) {
      throw new BadRequestException('Cannot modify a cancelled transaction');
    }
  }

  /** Recalculate totalAmount from items and update the transaction */
  private async recalculateTotals(transactionId: string) {
    const items = await this.prisma.transactionItem.findMany({ where: { transactionId } });
    const totalAmount = items.reduce(
      (sum, item) => sum.add(item.totalPrice),
      new Prisma.Decimal(0),
    );

    const transaction = await this.prisma.transaction.findUnique({ where: { id: transactionId } });
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
      } else {
        status = TransactionStatus.ACTIVE;
      }
    }

    await this.prisma.transaction.update({
      where: { id: transactionId },
      data: { totalAmount, status },
    });
  }

  private async log(
    transactionId: string,
    action: TransactionAuditAction,
    description: string,
    performedById: string,
    metadata?: object,
  ) {
    await this.prisma.transactionAuditLog.create({
      data: {
        transactionId,
        action,
        description,
        performedById,
        metadata: metadata ? (metadata as Prisma.InputJsonValue) : undefined,
      },
    });
  }

  // ─── Create Transaction ───────────────────────────────────────────────────────────

  async createTransaction(dto: CreateTransactionDto) {
    const transactionNumber = await this.generateTransactionNumber();

    const transaction = await this.prisma.transaction.create({
      data: {
        transactionNumber,
        patientId: dto.patientId,
        createdById: dto.staffId,
        admissionId: dto.admissionId,
        notes: dto.notes,
        status: TransactionStatus.ACTIVE,
      },
      include: { patient: true, createdBy: true },
    });

    await this.log(
      transaction.id,
      TransactionAuditAction.BILL_CREATED,
      `Transaction ${transactionNumber} created for patient ${dto.patientId}`,
      dto.staffId,
      { transactionNumber },
    );

    return transaction;
  }

  // ─── Get Transactions ─────────────────────────────────────────────────────────────

  async findAll(skip = 0, take = 20) {
    const [transactions, total] = await Promise.all([
      this.prisma.transaction.findMany({
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          patient: {
            select: {
              id: true,
              patientId: true,
              firstName: true,
              surname: true,
            },
          },
          createdBy: {
            select: { id: true, firstName: true, lastName: true, role: true },
          },
          _count: { select: { items: true, payments: true } },
        },
      }),
      this.prisma.transaction.count(),
    ]);
    return { transactions, total, skip, take };
  }

  async findOne(id: string) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id },
      include: {
        patient: true,
        admission: true,
        createdBy: {
          select: { id: true, firstName: true, lastName: true, role: true },
        },
        cancelledBy: {
          select: { id: true, firstName: true, lastName: true, role: true },
        },
        items: {
          include: {
            addedBy: { select: { id: true, firstName: true, lastName: true } },
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
        },
        insuranceClaims: true,
        refunds: {
          include: {
            processedBy: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
        },
      },
    });
    if (!transaction) throw new NotFoundException(`Transaction ${id} not found`);

    // Compute outstanding balance
    const outstanding = transaction.totalAmount
      .sub(transaction.discountAmount)
      .sub(transaction.insuranceCovered)
      .sub(transaction.amountPaid);

    return { ...transaction, outstandingBalance: outstanding };
  }

  findByPatient(patientId: string) {
    return this.prisma.transaction.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { items: true, payments: true } },
      },
    });
  }

  // ─── Add Item ──────────────────────────────────────────────────────────────

  async addItem(transactionId: string, dto: AddTransactionItemDto) {
    const transaction = await this.getTransactionOrThrow(transactionId);
    this.assertNotCancelled(transaction);

    const unitPrice = new Prisma.Decimal(dto.unitPrice);
    const totalPrice = unitPrice.mul(dto.quantity);

    const item = await this.prisma.transactionItem.create({
      data: {
        transactionId,
        description: dto.description,
        source: dto.source,
        quantity: dto.quantity,
        unitPrice,
        totalPrice,
        addedById: dto.staffId,
        referenceId: dto.referenceId,
        createdById: '',
      },
      include: {
        addedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    await this.recalculateTotals(transactionId);
    await this.log(
      transactionId,
      TransactionAuditAction.ITEM_ADDED,
      `Item "${dto.description}" (${dto.source}) added — qty: ${dto.quantity}, unit: ${dto.unitPrice}`,
      dto.staffId,
      {
        itemId: item.id,
        description: dto.description,
        unitPrice: dto.unitPrice,
        quantity: dto.quantity,
      },
    );

    return item;
  }

  // ─── Edit Item Price ───────────────────────────────────────────────────────

  async editItemPrice(transactionId: string, itemId: string, dto: EditTransactionItemDto) {
    const transaction = await this.getTransactionOrThrow(transactionId);
    this.assertNotCancelled(transaction);

    const existing = await this.prisma.transactionItem.findFirst({
      where: { id: itemId, transactionId },
    });
    if (!existing)
      throw new NotFoundException(`Item ${itemId} not found on transaction ${transactionId}`);

    const newUnitPrice = new Prisma.Decimal(dto.unitPrice);
    const newTotalPrice = newUnitPrice.mul(existing.quantity);

    const updated = await this.prisma.transactionItem.update({
      where: { id: itemId },
      data: {
        unitPrice: newUnitPrice,
        totalPrice: newTotalPrice,
        priceEditedById: dto.staffId,
        priceEditedAt: new Date(),
      },
    });

    await this.recalculateTotals(transactionId);
    await this.log(
      transactionId,
      TransactionAuditAction.ITEM_EDITED,
      `Item "${existing.description}" price changed from ${existing.unitPrice.toString()} to ${dto.unitPrice.toString()}`,
      dto.staffId,
      { itemId, oldUnitPrice: existing.unitPrice, newUnitPrice: dto.unitPrice },
    );

    return updated;
  }

  // ─── Record Payment ────────────────────────────────────────────────────────

  async recordPayment(transactionId: string, dto: RecordPaymentDto) {
    const transaction = await this.getTransactionOrThrow(transactionId);
    this.assertNotCancelled(transaction);

    if (transaction.status === TransactionStatus.PAID) {
      throw new BadRequestException('Transaction is already fully paid');
    }

    const outstanding = transaction.totalAmount
      .sub(transaction.discountAmount)
      .sub(transaction.insuranceCovered)
      .sub(transaction.amountPaid);

    const paymentAmount = new Prisma.Decimal(dto.amount);
    if (paymentAmount.gt(outstanding)) {
      throw new BadRequestException(
        `Payment amount (${dto.amount}) exceeds outstanding balance (${outstanding.toString()})`,
      );
    }

    const payment = await this.prisma.transactionPayment.create({
      data: {
        transactionId,
        amount: paymentAmount,
        method: dto.method,
        reference: dto.reference,
        notes: dto.notes,
        receivedById: dto.staffId,
      },
      include: {
        receivedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    const newAmountPaid = transaction.amountPaid.add(paymentAmount);
    const newOutstanding = outstanding.sub(paymentAmount);
    const newStatus = newOutstanding.lte(0)
      ? TransactionStatus.PAID
      : TransactionStatus.PARTIALLY_PAID;

    await this.prisma.transaction.update({
      where: { id: transactionId },
      data: { amountPaid: newAmountPaid, status: newStatus },
    });

    await this.log(
      transactionId,
      TransactionAuditAction.PAYMENT_RECEIVED,
      `Payment of ${dto.amount} received via ${dto.method}. Outstanding: ${newOutstanding.toString()}`,
      dto.staffId,
      {
        paymentId: payment.id,
        amount: dto.amount,
        method: dto.method,
        reference: dto.reference,
      },
    );

    return payment;
  }

  // ─── Apply Discount ────────────────────────────────────────────────────────

  async applyDiscount(transactionId: string, dto: ApplyDiscountDto) {
    const transaction = await this.getTransactionOrThrow(transactionId);
    this.assertNotCancelled(transaction);

    let computedAmount: Prisma.Decimal;
    if (dto.type === 'PERCENTAGE') {
      computedAmount = transaction.totalAmount.mul(dto.value).div(100);
    } else {
      computedAmount = new Prisma.Decimal(dto.value);
    }

    const discount = await this.prisma.transactionDiscount.create({
      data: {
        transactionId,
        type: dto.type,
        value: new Prisma.Decimal(dto.value),
        computedAmount,
        reason: dto.reason,
        grantedById: dto.staffId,
      },
      include: {
        grantedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    const newDiscountAmount = transaction.discountAmount.add(computedAmount);
    await this.prisma.transaction.update({
      where: { id: transactionId },
      data: { discountAmount: newDiscountAmount },
    });

    await this.log(
      transactionId,
      TransactionAuditAction.DISCOUNT_APPLIED,
      `Discount applied: ${dto.type === 'PERCENTAGE' ? dto.value + '%' : dto.value + ' fixed'} — ${dto.reason}. Computed: ${computedAmount.toString()}`,
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

  // ─── Apply Insurance ───────────────────────────────────────────────────────

  async applyInsurance(transactionId: string, dto: ApplyInsuranceDto) {
    const transaction = await this.getTransactionOrThrow(transactionId);
    this.assertNotCancelled(transaction);

    const coveredAmount = new Prisma.Decimal(dto.coveredAmount);

    const claim = await this.prisma.insuranceClaim.create({
      data: {
        transactionId,
        provider: dto.provider,
        policyNumber: dto.policyNumber,
        coveredAmount,
        notes: dto.notes,
      },
    });

    const newInsuranceCovered = transaction.insuranceCovered.add(coveredAmount);
    await this.prisma.transaction.update({
      where: { id: transactionId },
      data: { insuranceCovered: newInsuranceCovered },
    });

    // Insurance claims don't have a staffId in the DTO — log with a system note
    // We use the transaction's createdById as the performer for the audit log
    await this.log(
      transactionId,
      TransactionAuditAction.INSURANCE_APPLIED,
      `Insurance claim applied: ${dto.provider}, covered: ${dto.coveredAmount}`,
      transaction.createdById,
      {
        claimId: claim.id,
        provider: dto.provider,
        coveredAmount: dto.coveredAmount,
      },
    );

    return claim;
  }

  // ─── Issue Refund ──────────────────────────────────────────────────────────

  async issueRefund(transactionId: string, dto: CreateRefundDto) {
    const transaction = await this.getTransactionOrThrow(transactionId);

    const refundAmount = new Prisma.Decimal(dto.amount);
    if (refundAmount.gt(transaction.amountPaid)) {
      throw new BadRequestException(
        `Refund amount (${dto.amount}) exceeds amount paid (${transaction.amountPaid.toString()})`,
      );
    }

    const refund = await this.prisma.transactionRefund.create({
      data: {
        transactionId,
        amount: refundAmount,
        reason: dto.reason,
        processedById: dto.staffId,
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
      where: { id: transactionId },
      data: { amountPaid: newAmountPaid, status: newStatus },
    });

    await this.log(
      transactionId,
      TransactionAuditAction.REFUND_ISSUED,
      `Refund of ${dto.amount} issued. Reason: ${dto.reason}`,
      dto.staffId,
      { refundId: refund.id, amount: dto.amount, reason: dto.reason },
    );

    return refund;
  }

  // ─── Cancel Transaction ───────────────────────────────────────────────────────────

  async cancelTransaction(transactionId: string, dto: CancelTransactionDto) {
    const transaction = await this.getTransactionOrThrow(transactionId);
    this.assertNotCancelled(transaction);

    if (transaction.amountPaid.gt(0)) {
      throw new BadRequestException(
        'Cannot cancel a transaction that has received payments. Issue a refund first.',
      );
    }

    const updated = await this.prisma.transaction.update({
      where: { id: transactionId },
      data: {
        status: TransactionStatus.CANCELLED,
        cancelledById: dto.staffId,
        cancelledAt: new Date(),
        cancellationReason: dto.reason,
      },
    });

    await this.log(
      transactionId,
      TransactionAuditAction.BILL_CANCELLED,
      `Transaction cancelled. Reason: ${dto.reason}`,
      dto.staffId,
      { reason: dto.reason },
    );

    return updated;
  }

  // ─── Audit Log ─────────────────────────────────────────────────────────────

  async getAuditLog(transactionId: string) {
    await this.getTransactionOrThrow(transactionId);

    return this.prisma.transactionAuditLog.findMany({
      where: { transactionId },
      orderBy: { createdAt: 'asc' },
      include: {
        performedBy: {
          select: { id: true, firstName: true, lastName: true, role: true },
        },
      },
    });
  }

  // ─── Staff CRUD (simple) ───────────────────────────────────────────────────

  async createStaff(data: {
    staffId: string;
    firstName: string;
    lastName: string;
    role: string;
    department?: string;
    email?: string;
    phone?: string;
  }) {
    const createData = {
      staffId: data.staffId,
      firstName: data.firstName,
      lastName: data.lastName,
      role: data.role,
      email: data.email,
      phone: data.phone,
      ...(data.department && { department: { connect: { id: data.department } } }),
    };
    return this.prisma.staff.create({ data: createData });
  }

  async findAllStaff() {
    return this.prisma.staff.findMany({ orderBy: { createdAt: 'desc' } });
  }
}
