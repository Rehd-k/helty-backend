import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BillAuditAction, BillStatus, Prisma } from '@prisma/client';
import {
  AddBillItemDto,
  ApplyDiscountDto,
  ApplyInsuranceDto,
  CancelBillDto,
  CreateBillDto,
  CreateRefundDto,
  EditBillItemDto,
  RecordPaymentDto,
} from './dto/create-bill.dto';

@Injectable()
export class BillingService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private async generateBillNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.prisma.bill.count();
    const seq = String(count + 1).padStart(5, '0');
    return `BILL-${year}-${seq}`;
  }

  private async getBillOrThrow(id: string) {
    const bill = await this.prisma.bill.findUnique({
      where: { id },
      include: {
        items: true,
        payments: true,
        discounts: true,
        insuranceClaims: true,
        refunds: true,
      },
    });
    if (!bill) throw new NotFoundException(`Bill ${id} not found`);
    return bill;
  }

  private assertNotCancelled(bill: { status: BillStatus }) {
    if (bill.status === BillStatus.CANCELLED) {
      throw new BadRequestException('Cannot modify a cancelled bill');
    }
  }

  /** Recalculate totalAmount from items and update the bill */
  private async recalculateTotals(billId: string) {
    const items = await this.prisma.billItem.findMany({ where: { billId } });
    const totalAmount = items.reduce(
      (sum, item) => sum.add(item.totalPrice),
      new Prisma.Decimal(0),
    );

    const bill = await this.prisma.bill.findUnique({ where: { id: billId } });
    if (!bill) return;

    const outstanding = totalAmount
      .sub(bill.discountAmount)
      .sub(bill.insuranceCovered)
      .sub(bill.amountPaid);

    let status: BillStatus = bill.status;
    if (bill.status !== BillStatus.CANCELLED) {
      if (outstanding.lte(0) && totalAmount.gt(0)) {
        status = BillStatus.PAID;
      } else if (bill.amountPaid.gt(0)) {
        status = BillStatus.PARTIALLY_PAID;
      } else {
        status = BillStatus.ACTIVE;
      }
    }

    await this.prisma.bill.update({
      where: { id: billId },
      data: { totalAmount, status },
    });
  }

  private async log(
    billId: string,
    action: BillAuditAction,
    description: string,
    performedById: string,
    metadata?: object,
  ) {
    await this.prisma.billAuditLog.create({
      data: {
        billId,
        action,
        description,
        performedById,
        metadata: metadata ? (metadata as Prisma.InputJsonValue) : undefined,
      },
    });
  }

  // ─── Create Bill ───────────────────────────────────────────────────────────

  async createBill(dto: CreateBillDto) {
    const billNumber = await this.generateBillNumber();

    const bill = await this.prisma.bill.create({
      data: {
        billNumber,
        patientId: dto.patientId,
        createdById: dto.staffId,
        admissionId: dto.admissionId,
        notes: dto.notes,
        status: BillStatus.ACTIVE,
      },
      include: { patient: true, createdBy: true },
    });

    await this.log(
      bill.id,
      BillAuditAction.BILL_CREATED,
      `Bill ${billNumber} created for patient ${dto.patientId}`,
      dto.staffId,
      { billNumber },
    );

    return bill;
  }

  // ─── Get Bills ─────────────────────────────────────────────────────────────

  async findAll(skip = 0, take = 20) {
    const [bills, total] = await Promise.all([
      this.prisma.bill.findMany({
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
      this.prisma.bill.count(),
    ]);
    return { bills, total, skip, take };
  }

  async findOne(id: string) {
    const bill = await this.prisma.bill.findUnique({
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
    if (!bill) throw new NotFoundException(`Bill ${id} not found`);

    // Compute outstanding balance
    const outstanding = bill.totalAmount
      .sub(bill.discountAmount)
      .sub(bill.insuranceCovered)
      .sub(bill.amountPaid);

    return { ...bill, outstandingBalance: outstanding };
  }

  findByPatient(patientId: string) {
    return this.prisma.bill.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { items: true, payments: true } },
      },
    });
  }

  // ─── Add Item ──────────────────────────────────────────────────────────────

  async addItem(billId: string, dto: AddBillItemDto) {
    const bill = await this.getBillOrThrow(billId);
    this.assertNotCancelled(bill);

    const unitPrice = new Prisma.Decimal(dto.unitPrice);
    const totalPrice = unitPrice.mul(dto.quantity);

    const item = await this.prisma.billItem.create({
      data: {
        billId,
        description: dto.description,
        source: dto.source,
        quantity: dto.quantity,
        unitPrice,
        totalPrice,
        addedById: dto.staffId,
        referenceId: dto.referenceId,
      },
      include: {
        addedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    await this.recalculateTotals(billId);
    await this.log(
      billId,
      BillAuditAction.ITEM_ADDED,
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

  async editItemPrice(billId: string, itemId: string, dto: EditBillItemDto) {
    const bill = await this.getBillOrThrow(billId);
    this.assertNotCancelled(bill);

    const existing = await this.prisma.billItem.findFirst({
      where: { id: itemId, billId },
    });
    if (!existing)
      throw new NotFoundException(`Item ${itemId} not found on bill ${billId}`);

    const newUnitPrice = new Prisma.Decimal(dto.unitPrice);
    const newTotalPrice = newUnitPrice.mul(existing.quantity);

    const updated = await this.prisma.billItem.update({
      where: { id: itemId },
      data: {
        unitPrice: newUnitPrice,
        totalPrice: newTotalPrice,
        priceEditedById: dto.staffId,
        priceEditedAt: new Date(),
      },
    });

    await this.recalculateTotals(billId);
    await this.log(
      billId,
      BillAuditAction.ITEM_EDITED,
      `Item "${existing.description}" price changed from ${existing.unitPrice.toString()} to ${dto.unitPrice.toString()}`,
      dto.staffId,
      { itemId, oldUnitPrice: existing.unitPrice, newUnitPrice: dto.unitPrice },
    );

    return updated;
  }

  // ─── Record Payment ────────────────────────────────────────────────────────

  async recordPayment(billId: string, dto: RecordPaymentDto) {
    const bill = await this.getBillOrThrow(billId);
    this.assertNotCancelled(bill);

    if (bill.status === BillStatus.PAID) {
      throw new BadRequestException('Bill is already fully paid');
    }

    const outstanding = bill.totalAmount
      .sub(bill.discountAmount)
      .sub(bill.insuranceCovered)
      .sub(bill.amountPaid);

    const paymentAmount = new Prisma.Decimal(dto.amount);
    if (paymentAmount.gt(outstanding)) {
      throw new BadRequestException(
        `Payment amount (${dto.amount}) exceeds outstanding balance (${outstanding.toString()})`,
      );
    }

    const payment = await this.prisma.billPayment.create({
      data: {
        billId,
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

    const newAmountPaid = bill.amountPaid.add(paymentAmount);
    const newOutstanding = outstanding.sub(paymentAmount);
    const newStatus = newOutstanding.lte(0)
      ? BillStatus.PAID
      : BillStatus.PARTIALLY_PAID;

    await this.prisma.bill.update({
      where: { id: billId },
      data: { amountPaid: newAmountPaid, status: newStatus },
    });

    await this.log(
      billId,
      BillAuditAction.PAYMENT_RECEIVED,
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

  async applyDiscount(billId: string, dto: ApplyDiscountDto) {
    const bill = await this.getBillOrThrow(billId);
    this.assertNotCancelled(bill);

    let computedAmount: Prisma.Decimal;
    if (dto.type === 'PERCENTAGE') {
      computedAmount = bill.totalAmount.mul(dto.value).div(100);
    } else {
      computedAmount = new Prisma.Decimal(dto.value);
    }

    const discount = await this.prisma.billDiscount.create({
      data: {
        billId,
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

    const newDiscountAmount = bill.discountAmount.add(computedAmount);
    await this.prisma.bill.update({
      where: { id: billId },
      data: { discountAmount: newDiscountAmount },
    });

    await this.log(
      billId,
      BillAuditAction.DISCOUNT_APPLIED,
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

  async applyInsurance(billId: string, dto: ApplyInsuranceDto) {
    const bill = await this.getBillOrThrow(billId);
    this.assertNotCancelled(bill);

    const coveredAmount = new Prisma.Decimal(dto.coveredAmount);

    const claim = await this.prisma.insuranceClaim.create({
      data: {
        billId,
        provider: dto.provider,
        policyNumber: dto.policyNumber,
        coveredAmount,
        notes: dto.notes,
      },
    });

    const newInsuranceCovered = bill.insuranceCovered.add(coveredAmount);
    await this.prisma.bill.update({
      where: { id: billId },
      data: { insuranceCovered: newInsuranceCovered },
    });

    // Insurance claims don't have a staffId in the DTO — log with a system note
    // We use the bill's createdById as the performer for the audit log
    await this.log(
      billId,
      BillAuditAction.INSURANCE_APPLIED,
      `Insurance claim applied: ${dto.provider}, covered: ${dto.coveredAmount}`,
      bill.createdById,
      {
        claimId: claim.id,
        provider: dto.provider,
        coveredAmount: dto.coveredAmount,
      },
    );

    return claim;
  }

  // ─── Issue Refund ──────────────────────────────────────────────────────────

  async issueRefund(billId: string, dto: CreateRefundDto) {
    const bill = await this.getBillOrThrow(billId);

    const refundAmount = new Prisma.Decimal(dto.amount);
    if (refundAmount.gt(bill.amountPaid)) {
      throw new BadRequestException(
        `Refund amount (${dto.amount}) exceeds amount paid (${bill.amountPaid.toString()})`,
      );
    }

    const refund = await this.prisma.billRefund.create({
      data: {
        billId,
        amount: refundAmount,
        reason: dto.reason,
        processedById: dto.staffId,
      },
      include: {
        processedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    const newAmountPaid = bill.amountPaid.sub(refundAmount);
    const outstanding = bill.totalAmount
      .sub(bill.discountAmount)
      .sub(bill.insuranceCovered)
      .sub(newAmountPaid);

    const newStatus = newAmountPaid.lte(0)
      ? BillStatus.REFUNDED
      : outstanding.lte(0)
        ? BillStatus.PAID
        : BillStatus.PARTIALLY_PAID;

    await this.prisma.bill.update({
      where: { id: billId },
      data: { amountPaid: newAmountPaid, status: newStatus },
    });

    await this.log(
      billId,
      BillAuditAction.REFUND_ISSUED,
      `Refund of ${dto.amount} issued. Reason: ${dto.reason}`,
      dto.staffId,
      { refundId: refund.id, amount: dto.amount, reason: dto.reason },
    );

    return refund;
  }

  // ─── Cancel Bill ───────────────────────────────────────────────────────────

  async cancelBill(billId: string, dto: CancelBillDto) {
    const bill = await this.getBillOrThrow(billId);
    this.assertNotCancelled(bill);

    if (bill.amountPaid.gt(0)) {
      throw new BadRequestException(
        'Cannot cancel a bill that has received payments. Issue a refund first.',
      );
    }

    const updated = await this.prisma.bill.update({
      where: { id: billId },
      data: {
        status: BillStatus.CANCELLED,
        cancelledById: dto.staffId,
        cancelledAt: new Date(),
        cancellationReason: dto.reason,
      },
    });

    await this.log(
      billId,
      BillAuditAction.BILL_CANCELLED,
      `Bill cancelled. Reason: ${dto.reason}`,
      dto.staffId,
      { reason: dto.reason },
    );

    return updated;
  }

  // ─── Audit Log ─────────────────────────────────────────────────────────────

  async getAuditLog(billId: string) {
    await this.getBillOrThrow(billId);

    return this.prisma.billAuditLog.findMany({
      where: { billId },
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
    return this.prisma.staff.create({ data });
  }

  async findAllStaff() {
    return this.prisma.staff.findMany({ orderBy: { createdAt: 'desc' } });
  }
}
