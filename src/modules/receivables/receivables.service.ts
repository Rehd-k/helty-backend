import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CoverageRemittancePayerType,
  InvoiceAuditAction,
  InvoiceCoverageKind,
  InvoiceCoverageStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { parseDateRange } from '../../common/utils/date-range';
import {
  CreateRemittanceDto,
  DiscountReceivablesQueryDto,
  HmoReceivablesQueryDto,
  ReceivablesQueryDto,
} from './dto/receivables.dto';

@Injectable()
export class ReceivablesService {
  constructor(private readonly prisma: PrismaService) {}

  private asDecimal(value: number | string | Prisma.Decimal): Prisma.Decimal {
    return value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value);
  }

  private parseDateWindow(q: ReceivablesQueryDto): { from: Date; to: Date } {
    const { from, to } = parseDateRange(q.fromDate, q.toDate);
    return { from, to };
  }

  private buildBroadSearchOr(q: string): Prisma.InvoiceCoverageWhereInput[] {
    const needle = { contains: q, mode: 'insensitive' as const };
    return [
      { invoice: { invoiceID: needle } },
      {
        invoice: {
          patient: {
            OR: [{ firstName: needle }, { surname: needle }, { patientId: needle }],
          },
        },
      },
    ];
  }

  async listHmoReceivables(q: HmoReceivablesQueryDto) {
    const { from, to } = this.parseDateWindow(q);
    const skip = Number(q.skip ?? 0);
    const take = Math.min(Number(q.take ?? 20), 100);
    const needle = q.q?.trim();

    const where: Prisma.InvoiceCoverageWhereInput = {
      kind: InvoiceCoverageKind.HMO,
      createdAt: { gte: from, lte: to },
      ...(q.hmoId ? { hmoId: q.hmoId } : {}),
      ...(q.status ? { status: q.status } : { status: { not: InvoiceCoverageStatus.REVERSED } }),
      ...(needle ? { OR: this.buildBroadSearchOr(needle) } : {}),
    };

    const [rows, total, sum] = await Promise.all([
      this.prisma.invoiceCoverage.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          hmo: { select: { id: true, name: true } },
          invoice: {
            select: {
              id: true,
              invoiceID: true,
              status: true,
              createdAt: true,
              patient: {
                select: { id: true, patientId: true, firstName: true, surname: true, phoneNumber: true },
              },
            },
          },
          invoiceItem: {
            select: {
              id: true,
              customDescription: true,
              quantity: true,
              unitPrice: true,
              service: { select: { id: true, name: true } },
              drug: { select: { id: true, genericName: true, brandName: true } },
            },
          },
          remittance: {
            include: {
              remittance: { select: { id: true, paidAt: true, reference: true } },
            },
          },
        },
      }),
      this.prisma.invoiceCoverage.count({ where }),
      this.prisma.invoiceCoverage.aggregate({ where, _sum: { amount: true } }),
    ]);

    return {
      data: rows,
      total,
      skip,
      take,
      totalAmount: (sum._sum.amount ?? new Prisma.Decimal(0)).toFixed(2),
    };
  }

  async hmoStatement(hmoId: string, q: ReceivablesQueryDto) {
    const { from, to } = this.parseDateWindow(q);
    const where: Prisma.InvoiceCoverageWhereInput = {
      kind: InvoiceCoverageKind.HMO,
      hmoId,
      createdAt: { gte: from, lte: to },
      status: { in: [InvoiceCoverageStatus.APPLIED, InvoiceCoverageStatus.SETTLED] },
    };
    const [rows, sum, hmo] = await Promise.all([
      this.prisma.invoiceCoverage.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        include: {
          invoice: {
            select: {
              id: true,
              invoiceID: true,
              createdAt: true,
              patient: { select: { id: true, patientId: true, firstName: true, surname: true } },
            },
          },
          invoiceItem: {
            select: {
              id: true,
              customDescription: true,
              quantity: true,
              unitPrice: true,
              service: { select: { id: true, name: true } },
              drug: { select: { id: true, genericName: true, brandName: true } },
            },
          },
        },
      }),
      this.prisma.invoiceCoverage.aggregate({ where, _sum: { amount: true } }),
      this.prisma.hmo.findUnique({ where: { id: hmoId }, select: { id: true, name: true } }),
    ]);
    if (!hmo) throw new NotFoundException(`HMO "${hmoId}" not found`);
    return {
      hmo,
      from: from.toISOString(),
      to: to.toISOString(),
      totalAmount: (sum._sum.amount ?? new Prisma.Decimal(0)).toFixed(2),
      rows,
    };
  }

  async listDiscountReceivables(q: DiscountReceivablesQueryDto) {
    const { from, to } = this.parseDateWindow(q);
    const skip = Number(q.skip ?? 0);
    const take = Math.min(Number(q.take ?? 20), 100);
    const needle = q.q?.trim();

    const where: Prisma.InvoiceCoverageWhereInput = {
      kind: InvoiceCoverageKind.DISCOUNT,
      createdAt: { gte: from, lte: to },
      ...(q.reason ? { reason: q.reason } : {}),
      ...(q.ownerId ? { payerStaffId: q.ownerId } : {}),
      ...(q.status ? { status: q.status } : { status: { not: InvoiceCoverageStatus.REVERSED } }),
      ...(needle ? { OR: this.buildBroadSearchOr(needle) } : {}),
    };

    const [rows, total, sum] = await Promise.all([
      this.prisma.invoiceCoverage.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          policy: { select: { id: true, name: true, reason: true } },
          payer: { select: { id: true, firstName: true, lastName: true, staffId: true } },
          invoice: {
            select: {
              id: true,
              invoiceID: true,
              status: true,
              createdAt: true,
              patient: {
                select: { id: true, patientId: true, firstName: true, surname: true, phoneNumber: true },
              },
            },
          },
          invoiceItem: {
            select: {
              id: true,
              customDescription: true,
              quantity: true,
              unitPrice: true,
              service: { select: { id: true, name: true } },
              drug: { select: { id: true, genericName: true, brandName: true } },
            },
          },
          remittance: {
            include: {
              remittance: { select: { id: true, paidAt: true, reference: true } },
            },
          },
        },
      }),
      this.prisma.invoiceCoverage.count({ where }),
      this.prisma.invoiceCoverage.aggregate({ where, _sum: { amount: true } }),
    ]);

    return {
      data: rows,
      total,
      skip,
      take,
      totalAmount: (sum._sum.amount ?? new Prisma.Decimal(0)).toFixed(2),
    };
  }

  async discountOwnerStatement(ownerId: string, q: ReceivablesQueryDto) {
    const { from, to } = this.parseDateWindow(q);
    const where: Prisma.InvoiceCoverageWhereInput = {
      kind: InvoiceCoverageKind.DISCOUNT,
      payerStaffId: ownerId,
      createdAt: { gte: from, lte: to },
      status: { in: [InvoiceCoverageStatus.APPLIED, InvoiceCoverageStatus.SETTLED] },
    };
    const [rows, sum, owner] = await Promise.all([
      this.prisma.invoiceCoverage.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        include: {
          policy: { select: { id: true, name: true, reason: true } },
          invoice: {
            select: {
              id: true,
              invoiceID: true,
              createdAt: true,
              patient: { select: { id: true, patientId: true, firstName: true, surname: true } },
            },
          },
          invoiceItem: {
            select: {
              id: true,
              customDescription: true,
              quantity: true,
              unitPrice: true,
              service: { select: { id: true, name: true } },
              drug: { select: { id: true, genericName: true, brandName: true } },
            },
          },
        },
      }),
      this.prisma.invoiceCoverage.aggregate({ where, _sum: { amount: true } }),
      this.prisma.staff.findUnique({
        where: { id: ownerId },
        select: { id: true, staffId: true, firstName: true, lastName: true },
      }),
    ]);
    if (!owner) throw new NotFoundException(`Staff "${ownerId}" not found`);
    return {
      owner,
      from: from.toISOString(),
      to: to.toISOString(),
      totalAmount: (sum._sum.amount ?? new Prisma.Decimal(0)).toFixed(2),
      rows,
    };
  }

  async listRemittances(q: ReceivablesQueryDto) {
    const { from, to } = this.parseDateWindow(q);
    const skip = Number(q.skip ?? 0);
    const take = Math.min(Number(q.take ?? 20), 100);
    const where: Prisma.CoverageRemittanceWhereInput = { paidAt: { gte: from, lte: to } };

    const [data, total] = await Promise.all([
      this.prisma.coverageRemittance.findMany({
        where,
        skip,
        take,
        orderBy: { paidAt: 'desc' },
        include: {
          hmo: { select: { id: true, name: true } },
          payerStaff: { select: { id: true, staffId: true, firstName: true, lastName: true } },
          receivedBy: { select: { id: true, staffId: true, firstName: true, lastName: true } },
          lines: { include: { coverage: { select: { id: true, invoiceId: true } } } },
        },
      }),
      this.prisma.coverageRemittance.count({ where }),
    ]);
    return { data, total, skip, take };
  }

  async getRemittance(id: string) {
    const row = await this.prisma.coverageRemittance.findUnique({
      where: { id },
      include: {
        hmo: { select: { id: true, name: true } },
        payerStaff: { select: { id: true, staffId: true, firstName: true, lastName: true } },
        receivedBy: { select: { id: true, staffId: true, firstName: true, lastName: true } },
        lines: {
          include: {
            coverage: {
              include: {
                invoice: { select: { id: true, invoiceID: true, patientId: true } },
                invoiceItem: {
                  select: {
                    id: true,
                    customDescription: true,
                    service: { select: { id: true, name: true } },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!row) throw new NotFoundException(`Remittance "${id}" not found`);
    return row;
  }

  async createRemittance(dto: CreateRemittanceDto, authStaffId?: string) {
    return this.prisma.$transaction(async (tx) => {
      if (dto.payerType === CoverageRemittancePayerType.HMO) {
        if (!dto.hmoId) throw new BadRequestException('hmoId is required when payerType=HMO');
      } else {
        if (!dto.payerStaffId)
          throw new BadRequestException('payerStaffId is required when payerType=STAFF');
      }

      const paidAt = dto.paidAt ? new Date(dto.paidAt) : new Date();
      if (Number.isNaN(paidAt.getTime())) {
        throw new BadRequestException('paidAt must be a valid ISO date');
      }

      const lineSum = dto.lines.reduce(
        (sum, l) => sum.add(this.asDecimal(l.amount)),
        new Prisma.Decimal(0),
      );
      const total = this.asDecimal(dto.amount);
      if (lineSum.comparedTo(total) !== 0) {
        throw new BadRequestException(
          `Sum of lines (${lineSum.toFixed(2)}) must equal amount (${total.toFixed(2)})`,
        );
      }

      const coverageIds = [...new Set(dto.lines.map((l) => l.coverageId))];
      if (coverageIds.length !== dto.lines.length) {
        throw new BadRequestException('Duplicate coverageId in remittance lines');
      }

      const coverages = await tx.invoiceCoverage.findMany({
        where: { id: { in: coverageIds } },
        select: {
          id: true,
          invoiceId: true,
          amount: true,
          status: true,
          hmoId: true,
          payerStaffId: true,
        },
      });
      if (coverages.length !== coverageIds.length) {
        throw new BadRequestException('One or more coverage ids were not found');
      }

      const byId = new Map(coverages.map((c) => [c.id, c]));
      for (const line of dto.lines) {
        const cov = byId.get(line.coverageId)!;
        if (cov.status !== InvoiceCoverageStatus.APPLIED) {
          throw new BadRequestException(`Coverage ${cov.id} is not outstanding (status ${cov.status})`);
        }
        const expectedPayerOk =
          dto.payerType === CoverageRemittancePayerType.HMO
            ? cov.hmoId === dto.hmoId
            : cov.payerStaffId === dto.payerStaffId;
        if (!expectedPayerOk) {
          throw new BadRequestException(`Coverage ${cov.id} does not belong to this payer`);
        }
        const amt = this.asDecimal(line.amount);
        if (amt.comparedTo(this.asDecimal(cov.amount)) !== 0) {
          throw new BadRequestException(`Line amount for coverage ${cov.id} must equal its coverage amount`);
        }
      }

      const remittance = await tx.coverageRemittance.create({
        data: {
          payerType: dto.payerType,
          hmoId: dto.hmoId ?? null,
          payerStaffId: dto.payerStaffId ?? null,
          amount: total,
          reference: dto.reference?.trim() || null,
          notes: dto.notes?.trim() || null,
          receivedById: authStaffId ?? null,
          paidAt,
        },
      });

      for (const line of dto.lines) {
        await tx.coverageRemittanceLine.create({
          data: {
            remittanceId: remittance.id,
            coverageId: line.coverageId,
            amount: this.asDecimal(line.amount),
          },
        });
        await tx.invoiceCoverage.update({
          where: { id: line.coverageId },
          data: { status: InvoiceCoverageStatus.SETTLED },
        });
      }

      // Write audit logs per invoice touched.
      const invoicesTouched = [
        ...new Set(dto.lines.map((l) => byId.get(l.coverageId)!.invoiceId)),
      ];
      for (const invoiceId of invoicesTouched) {
        await tx.invoiceAuditLog.create({
          data: {
            invoiceId,
            action: InvoiceAuditAction.COVERAGE_REMITTANCE_RECORDED,
            description: `Coverage remittance recorded (remittance ${remittance.id}).`,
            performedById: authStaffId ?? null,
            metadata: { remittanceId: remittance.id } as Prisma.InputJsonValue,
          },
        });
      }

      return this.getRemittance(remittance.id);
    });
  }
}

