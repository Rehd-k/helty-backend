import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  InvoiceAuditAction,
  InvoiceCoverageKind,
  InvoiceCoverageMode,
  InvoiceCoverageScope,
  InvoiceCoverageStatus,
  InvoiceStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { InvoiceService } from '../invoice.service';
import { ApplyHmoCoverageDto } from './dto/apply-hmo-coverage.dto';
import { ApplyDiscountDto } from './dto/apply-discount.dto';

@Injectable()
export class InvoiceCoverageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly invoiceService: InvoiceService,
  ) { }

  private asDecimal(value: number | string | Prisma.Decimal): Prisma.Decimal {
    return value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value);
  }

  private readonly dayMs = 24 * 60 * 60 * 1000;

  private computeRecurringDays(
    segments: Array<{ startAt: Date; endAt: Date | null }>,
    now: Date,
  ): number {
    let totalDays = 0;
    for (const seg of segments) {
      const start = new Date(seg.startAt).getTime();
      const end = (seg.endAt ? new Date(seg.endAt) : now).getTime();
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue;
      const ms = end - start;
      // Closed segments count ceil days; open segment counts floor days.
      const isOpen = !seg.endAt;
      const days = isOpen ? Math.floor(ms / this.dayMs) : Math.ceil(ms / this.dayMs);
      totalDays += Math.max(0, days);
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
  ): Prisma.Decimal {
    const unit = this.asDecimal(item.unitPrice);
    if (item.isRecurringDaily) {
      const days = this.computeRecurringDays(item.usageSegments, now);
      return unit.mul(days);
    }
    return unit.mul(item.quantity);
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

  private async assertInvoiceOpen(
    tx: Prisma.TransactionClient,
    invoiceId: string,
  ) {
    const invoice = await tx.invoice.findUnique({
      where: { id: invoiceId },
      select: { id: true, status: true, totalAmount: true, amountPaid: true, patientId: true },
    });
    if (!invoice) throw new NotFoundException(`Invoice ${invoiceId} not found`);
    if (invoice.status === InvoiceStatus.PAID) {
      throw new BadRequestException('This invoice is already paid.');
    }
    return invoice;
  }

  private async invoiceCoveredAmount(
    tx: Prisma.TransactionClient,
    invoiceId: string,
  ): Promise<Prisma.Decimal> {
    const aggregated = await tx.invoiceCoverage.aggregate({
      where: { invoiceId, status: { not: InvoiceCoverageStatus.REVERSED } },
      _sum: { amount: true },
    });
    return this.asDecimal(aggregated._sum.amount ?? 0);
  }

  private async resolveHmoCoveragePercent(params: {
    tx: Prisma.TransactionClient;
    hmoId: string;
    serviceId?: string | null;
  }): Promise<Prisma.Decimal> {
    if (params.serviceId) {
      const override = await params.tx.hmoServicePrice.findFirst({
        where: { hmoId: params.hmoId, serviceId: params.serviceId },
        select: { coveragePercent: true },
      });
      if (override?.coveragePercent !== null && override?.coveragePercent !== undefined) {
        return this.asDecimal(override.coveragePercent);
      }
    }
    const hmo = await params.tx.hmo.findUnique({
      where: { id: params.hmoId },
      select: { defaultCoveragePercent: true },
    });
    if (!hmo) throw new NotFoundException(`HMO "${params.hmoId}" not found`);
    return this.asDecimal(hmo.defaultCoveragePercent ?? 0);
  }

  async listCoverages(invoiceId: string) {
    await this.invoiceService.findOne(invoiceId);
    return this.prisma.invoiceCoverage.findMany({
      where: { invoiceId },
      orderBy: { createdAt: 'desc' },
      include: {
        hmo: { select: { id: true, name: true } },
        policy: { select: { id: true, name: true, reason: true, mode: true, value: true } },
        payer: { select: { id: true, firstName: true, lastName: true } },
        appliedBy: {
          select: { id: true, firstName: true, lastName: true, accountType: true, staffRole: true },
        },
        reversedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async applyHmoCoverage(invoiceId: string, dto: ApplyHmoCoverageDto, staffId: string) {
    await this.prisma.$transaction(async (tx) => {
      const invoice = await this.assertInvoiceOpen(tx, invoiceId);
      const patient = await tx.patient.findUnique({
        where: { id: invoice.patientId },
        select: { id: true, hmoId: true },
      });
      if (!patient) throw new NotFoundException(`Patient "${invoice.patientId}" not found`);
      if (!patient.hmoId) {
        throw new BadRequestException('Patient has no registered HMO.');
      }

      const existingCovered = await this.invoiceCoveredAmount(tx, invoiceId);
      const maxCoverable = this.asDecimal(invoice.totalAmount)
        .sub(this.asDecimal(invoice.amountPaid))
        .sub(existingCovered);
      if (maxCoverable.lte(0)) {
        throw new BadRequestException('This invoice has no outstanding balance to cover.');
      }

      if (dto.scope === InvoiceCoverageScope.ITEM) {
        const ids = dto.itemIds ?? [];
        if (ids.length === 0) {
          throw new BadRequestException('itemIds is required when scope=ITEM.');
        }
        const items = await tx.invoiceItem.findMany({
          where: { invoiceId, id: { in: ids } },
          include: { usageSegments: { orderBy: { startAt: 'asc' } }, service: { select: { id: true } } },
        });
        if (items.length !== ids.length) {
          throw new BadRequestException('One or more invoice items were not found on this invoice.');
        }

        const now = new Date();
        const created: any[] = [];
        for (const it of items) {
          const percent = dto.percentOverride !== undefined
            ? this.asDecimal(dto.percentOverride)
            : await this.resolveHmoCoveragePercent({ tx, hmoId: patient.hmoId, serviceId: it.serviceId });
          if (percent.lt(0) || percent.gt(100)) {
            throw new BadRequestException('Coverage percent must be between 0 and 100.');
          }
          const lineGross = this.invoiceLineTotal(it as any, now);
          const linePaid = this.asDecimal(it.amountPaid);
          const lineExistingCovered = this.asDecimal(
            (
              await tx.invoiceCoverage.aggregate({
                where: {
                  invoiceId,
                  invoiceItemId: it.id,
                  status: { not: InvoiceCoverageStatus.REVERSED },
                },
                _sum: { amount: true },
              })
            )._sum.amount ?? 0,
          );
          const lineMax = lineGross.sub(linePaid).sub(lineExistingCovered);
          if (lineMax.lte(0)) continue;

          const proposed = lineGross.mul(percent).div(100);
          const amount = proposed.gt(lineMax) ? lineMax : proposed;
          if (amount.lte(0)) continue;

          created.push(
            await tx.invoiceCoverage.create({
              data: {
                invoiceId,
                invoiceItemId: it.id,
                scope: InvoiceCoverageScope.ITEM,
                kind: InvoiceCoverageKind.HMO,
                hmoId: patient.hmoId,
                mode: InvoiceCoverageMode.PERCENT,
                value: percent,
                amount,
                status: InvoiceCoverageStatus.APPLIED,
                notes: dto.notes,
                appliedById: staffId,
              },
            }),
          );
        }

        await this.invoiceService.recalculateInvoiceTotals(invoiceId, tx);
        await this.logInvoiceAudit(tx, {
          invoiceId,
          action: InvoiceAuditAction.COVERAGE_APPLIED,
          description: `HMO coverage applied to ${created.length} line(s).`,
          performedById: staffId,
          metadata: { scope: 'ITEM', count: created.length } as Prisma.InputJsonValue,
        });
        return;
      }

      const percent = dto.percentOverride !== undefined
        ? this.asDecimal(dto.percentOverride)
        : await this.resolveHmoCoveragePercent({ tx, hmoId: patient.hmoId, serviceId: null });
      if (percent.lt(0) || percent.gt(100)) {
        throw new BadRequestException('Coverage percent must be between 0 and 100.');
      }
      const proposed = this.asDecimal(invoice.totalAmount).mul(percent).div(100);
      const amount = proposed.gt(maxCoverable) ? maxCoverable : proposed;
      if (amount.lte(0)) {
        throw new BadRequestException('Computed coverage amount is zero.');
      }

      const row = await tx.invoiceCoverage.create({
        data: {
          invoiceId,
          scope: InvoiceCoverageScope.INVOICE,
          kind: InvoiceCoverageKind.HMO,
          hmoId: patient.hmoId,
          mode: InvoiceCoverageMode.PERCENT,
          value: percent,
          amount,
          status: InvoiceCoverageStatus.APPLIED,
          notes: dto.notes,
          appliedById: staffId,
        },
      });

      await this.invoiceService.recalculateInvoiceTotals(invoiceId, tx);
      await this.logInvoiceAudit(tx, {
        invoiceId,
        action: InvoiceAuditAction.COVERAGE_APPLIED,
        description: `HMO coverage of ₦${amount.toFixed(2)} applied (${percent.toFixed(2)}%).`,
        performedById: staffId,
        metadata: { coverageId: row.id, amount: amount.toFixed(2), percent: percent.toFixed(2) } as Prisma.InputJsonValue,
      });
      return;
    }, { timeout: 15000 });
    return this.invoiceService.findOne(invoiceId);
  }

  async applyDiscount(invoiceId: string, dto: ApplyDiscountDto, staffId: string) {
    await this.prisma.$transaction(async (tx) => {
      const invoice = await this.assertInvoiceOpen(tx, invoiceId);
      const policy = await tx.discountPolicy.findUnique({
        where: { id: dto.policyId },
      });
      if (!policy || !policy.active) {
        throw new NotFoundException('Discount policy not found or inactive.');
      }

      const existingCovered = await this.invoiceCoveredAmount(tx, invoiceId);
      const maxCoverable = this.asDecimal(invoice.totalAmount)
        .sub(this.asDecimal(invoice.amountPaid))
        .sub(existingCovered);
      if (maxCoverable.lte(0)) {
        throw new BadRequestException('This invoice has no outstanding balance to discount.');
      }

      const mode = policy.mode;
      const value = dto.valueOverride !== undefined ? this.asDecimal(dto.valueOverride) : policy.value;

      if (dto.scope === InvoiceCoverageScope.ITEM) {
        const ids = dto.itemIds ?? [];
        if (ids.length === 0) {
          throw new BadRequestException('itemIds is required when scope=ITEM.');
        }
        const items = await tx.invoiceItem.findMany({
          where: { invoiceId, id: { in: ids } },
          include: { usageSegments: { orderBy: { startAt: 'asc' } } },
        });
        if (items.length !== ids.length) {
          throw new BadRequestException('One or more invoice items were not found on this invoice.');
        }
        const now = new Date();
        const created: any[] = [];
        for (const it of items) {
          const lineGross = this.invoiceLineTotal(it as any, now);
          const linePaid = this.asDecimal(it.amountPaid);
          const lineExistingCovered = this.asDecimal(
            (
              await tx.invoiceCoverage.aggregate({
                where: {
                  invoiceId,
                  invoiceItemId: it.id,
                  status: { not: InvoiceCoverageStatus.REVERSED },
                },
                _sum: { amount: true },
              })
            )._sum.amount ?? 0,
          );
          const lineMax = lineGross.sub(linePaid).sub(lineExistingCovered);
          if (lineMax.lte(0)) continue;

          const proposed =
            mode === InvoiceCoverageMode.PERCENT
              ? lineGross.mul(value).div(100)
              : value;
          const amount = proposed.gt(lineMax) ? lineMax : proposed;
          if (amount.lte(0)) continue;

          created.push(
            await tx.invoiceCoverage.create({
              data: {
                invoiceId,
                invoiceItemId: it.id,
                scope: InvoiceCoverageScope.ITEM,
                kind: InvoiceCoverageKind.DISCOUNT,
                policyId: policy.id,
                reason: policy.reason,
                payerStaffId: policy.ownerId,
                mode,
                value,
                amount,
                status: InvoiceCoverageStatus.APPLIED,
                notes: dto.notes,
                appliedById: staffId,
              },
            }),
          );
        }

        await this.invoiceService.recalculateInvoiceTotals(invoiceId, tx);
        await this.logInvoiceAudit(tx, {
          invoiceId,
          action: InvoiceAuditAction.COVERAGE_APPLIED,
          description: `Discount "${policy.name}" applied to ${created.length} line(s).`,
          performedById: staffId,
          metadata: { scope: 'ITEM', policyId: policy.id, count: created.length } as Prisma.InputJsonValue,
        });
        return;
      }

      const proposed =
        mode === InvoiceCoverageMode.PERCENT
          ? this.asDecimal(invoice.totalAmount).mul(value).div(100)
          : value;
      const amount = proposed.gt(maxCoverable) ? maxCoverable : proposed;
      if (amount.lte(0)) {
        throw new BadRequestException('Computed discount amount is zero.');
      }

      const row = await tx.invoiceCoverage.create({
        data: {
          invoiceId,
          scope: InvoiceCoverageScope.INVOICE,
          kind: InvoiceCoverageKind.DISCOUNT,
          policyId: policy.id,
          reason: policy.reason,
          payerStaffId: policy.ownerId,
          mode,
          value,
          amount,
          status: InvoiceCoverageStatus.APPLIED,
          notes: dto.notes,
          appliedById: staffId,
        },
      });

      await this.invoiceService.recalculateInvoiceTotals(invoiceId, tx);
      await this.logInvoiceAudit(tx, {
        invoiceId,
        action: InvoiceAuditAction.COVERAGE_APPLIED,
        description: `Discount "${policy.name}" of ₦${amount.toFixed(2)} applied.`,
        performedById: staffId,
        metadata: { coverageId: row.id, policyId: policy.id, amount: amount.toFixed(2) } as Prisma.InputJsonValue,
      });
      return;
    }, { timeout: 15000 });
    return this.invoiceService.findOne(invoiceId);
  }

  async reverseCoverage(invoiceId: string, coverageId: string, staffId: string, reason?: string) {
    const alreadyReversed = await this.prisma.$transaction(async (tx) => {
      await this.assertInvoiceOpen(tx, invoiceId);
      const coverage = await tx.invoiceCoverage.findFirst({
        where: { id: coverageId, invoiceId },
      });
      if (!coverage) {
        throw new NotFoundException(`Coverage "${coverageId}" not found on invoice "${invoiceId}".`);
      }
      if (coverage.status === InvoiceCoverageStatus.REVERSED) {
        return true;
      }
      if (coverage.status === InvoiceCoverageStatus.SETTLED) {
        throw new BadRequestException('Cannot reverse a settled coverage.');
      }

      await tx.invoiceCoverage.update({
        where: { id: coverage.id },
        data: {
          status: InvoiceCoverageStatus.REVERSED,
          reversedById: staffId,
          reversedAt: new Date(),
          reversalReason: reason?.trim() || null,
        },
      });

      await this.invoiceService.recalculateInvoiceTotals(invoiceId, tx);
      await this.logInvoiceAudit(tx, {
        invoiceId,
        action: InvoiceAuditAction.COVERAGE_REVERSED,
        description: reason?.trim() || `Coverage ${coverageId} reversed.`,
        performedById: staffId,
        metadata: { coverageId } as Prisma.InputJsonValue,
      });
      return false;
    }, { timeout: 15000 });

    if (alreadyReversed) {
      return this.invoiceService.findOne(invoiceId);
    }
    return this.invoiceService.findOne(invoiceId);
  }
}

