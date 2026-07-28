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
import { patientNameFieldsSelect } from '../../common/utils/patient-display-name.util';
import { buildPatientNameSearchWhere } from '../../common/utils/patient-name-search.util';
import {
  CreateRemittanceDto,
  DiscountReceivablesQueryDto,
  HmoReceivablesQueryDto,
  ReceivablesQueryDto,
} from './dto/receivables.dto';

@Injectable()
export class ReceivablesService {
  constructor(private readonly prisma: PrismaService) { }

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
            OR: [buildPatientNameSearchWhere(q), { patientId: needle }],
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

    const hmoName = q.hmoName?.trim();
    const where: Prisma.InvoiceCoverageWhereInput = {
      kind: InvoiceCoverageKind.HMO,
      createdAt: { gte: from, lte: to },
      ...(q.hmoId ? { hmoId: q.hmoId } : {}),
      ...(hmoName
        ? { hmo: { name: { contains: hmoName, mode: 'insensitive' } } }
        : {}),
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
              invoiceItems: {
                select: {
                  id: true,
                  createdAt: true,
                  quantity: true,
                  unitPrice: true,
                  service: { select: { id: true, name: true } },
                  drug: { select: { id: true, genericName: true, brandName: true } },
                  purchaseItem: { select: { id: true, itemName: true } },
                },
              },
              patient: {
                select: { ...patientNameFieldsSelect, phoneNumber: true },
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
              patient: { select: patientNameFieldsSelect },
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
                select: { ...patientNameFieldsSelect, phoneNumber: true },
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
              patient: { select: patientNameFieldsSelect },
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

  async hmoCoverageBreakdown(q: ReceivablesQueryDto) {
    const { from, to } = this.parseDateWindow(q);
    const where: Prisma.InvoiceCoverageWhereInput = {
      kind: InvoiceCoverageKind.HMO,
      createdAt: { gte: from, lte: to },
      status: { not: InvoiceCoverageStatus.REVERSED },
    };

    const [rows, grandTotal] = await Promise.all([
      this.prisma.invoiceCoverage.groupBy({
        by: ['hmoId'],
        where,
        _sum: { amount: true },
        _count: { _all: true },
      }),
      this.prisma.invoiceCoverage.aggregate({
        where,
        _sum: { amount: true },
      }),
    ]);

    const hmoIds = rows.map((r) => r.hmoId).filter((id): id is string => Boolean(id));
    const hmos = hmoIds.length
      ? await this.prisma.hmo.findMany({
        where: { id: { in: hmoIds } },
        select: { id: true, name: true },
      })
      : [];
    const hmoById = new Map(hmos.map((h) => [h.id, h]));

    const data = rows
      .map((r) => ({
        hmoId: r.hmoId,
        hmoName: r.hmoId ? (hmoById.get(r.hmoId)?.name ?? 'Unknown HMO') : 'Unassigned HMO',
        totalAmount: (r._sum.amount ?? new Prisma.Decimal(0)).toFixed(2),
        count: r._count._all,
      }))
      .sort((a, b) => Number(b.totalAmount) - Number(a.totalAmount));

    return {
      from: from.toISOString(),
      to: to.toISOString(),
      totalAmount: (grandTotal._sum.amount ?? new Prisma.Decimal(0)).toFixed(2),
      totalCount: data.reduce((acc, row) => acc + row.count, 0),
      data,
    };
  }

  async discountCoverageBreakdown(q: ReceivablesQueryDto) {
    const { from, to } = this.parseDateWindow(q);
    const where: Prisma.InvoiceCoverageWhereInput = {
      kind: InvoiceCoverageKind.DISCOUNT,
      createdAt: { gte: from, lte: to },
      status: { not: InvoiceCoverageStatus.REVERSED },
    };

    const [byReason, byPolicy, grandTotal] = await Promise.all([
      this.prisma.invoiceCoverage.groupBy({
        by: ['reason'],
        where,
        _sum: { amount: true },
        _count: { _all: true },
      }),
      this.prisma.invoiceCoverage.groupBy({
        by: ['policyId'],
        where,
        _sum: { amount: true },
        _count: { _all: true },
      }),
      this.prisma.invoiceCoverage.aggregate({
        where,
        _sum: { amount: true },
      }),
    ]);

    const policyIds = byPolicy
      .map((r) => r.policyId)
      .filter((id): id is string => Boolean(id));
    const policies = policyIds.length
      ? await this.prisma.discountPolicy.findMany({
        where: { id: { in: policyIds } },
        select: { id: true, name: true, reason: true },
      })
      : [];
    const policyById = new Map(policies.map((p) => [p.id, p]));

    return {
      from: from.toISOString(),
      to: to.toISOString(),
      totalAmount: (grandTotal._sum.amount ?? new Prisma.Decimal(0)).toFixed(2),
      byReason: byReason
        .map((r) => ({
          reason: r.reason,
          totalAmount: (r._sum.amount ?? new Prisma.Decimal(0)).toFixed(2),
          count: r._count._all,
        }))
        .sort((a, b) => Number(b.totalAmount) - Number(a.totalAmount)),
      byPolicy: byPolicy
        .map((r) => ({
          policyId: r.policyId,
          policyName: r.policyId
            ? (policyById.get(r.policyId)?.name ?? 'Unknown policy')
            : 'No policy',
          reason: r.policyId ? (policyById.get(r.policyId)?.reason ?? null) : null,
          totalAmount: (r._sum.amount ?? new Prisma.Decimal(0)).toFixed(2),
          count: r._count._all,
        }))
        .sort((a, b) => Number(b.totalAmount) - Number(a.totalAmount)),
    };
  }

  async remittanceCollectionsSummary(q: ReceivablesQueryDto) {
    const { from, to } = this.parseDateWindow(q);
    const where: Prisma.CoverageRemittanceWhereInput = {
      paidAt: { gte: from, lte: to },
    };

    const [grandTotal, byPayerType, byHmo, byStaff] = await Promise.all([
      this.prisma.coverageRemittance.aggregate({
        where,
        _sum: { amount: true },
        _count: { _all: true },
      }),
      this.prisma.coverageRemittance.groupBy({
        by: ['payerType'],
        where,
        _sum: { amount: true },
        _count: { _all: true },
      }),
      this.prisma.coverageRemittance.groupBy({
        by: ['hmoId'],
        where: { ...where, payerType: CoverageRemittancePayerType.HMO },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      this.prisma.coverageRemittance.groupBy({
        by: ['payerStaffId'],
        where: { ...where, payerType: CoverageRemittancePayerType.STAFF },
        _sum: { amount: true },
        _count: { _all: true },
      }),
    ]);

    const hmoIds = byHmo.map((r) => r.hmoId).filter((id): id is string => Boolean(id));
    const staffIds = byStaff
      .map((r) => r.payerStaffId)
      .filter((id): id is string => Boolean(id));

    const hmos = hmoIds.length
      ? await this.prisma.hmo.findMany({
        where: { id: { in: hmoIds } },
        select: { id: true, name: true },
      })
      : [];
    const staff = staffIds.length
      ? await this.prisma.staff.findMany({
        where: { id: { in: staffIds } },
        select: { id: true, firstName: true, lastName: true, staffId: true },
      })
      : [];

    const hmoById = new Map(hmos.map((h) => [h.id, h] as const));
    const staffById = new Map(staff.map((s) => [s.id, s] as const));

    return {
      from: from.toISOString(),
      to: to.toISOString(),
      totalAmount: (grandTotal._sum.amount ?? new Prisma.Decimal(0)).toFixed(2),
      totalCount: grandTotal._count._all,
      byPayerType: byPayerType.map((r) => ({
        payerType: r.payerType,
        totalAmount: (r._sum.amount ?? new Prisma.Decimal(0)).toFixed(2),
        count: r._count._all,
      })),
      byHmo: byHmo
        .map((r) => ({
          hmoId: r.hmoId,
          hmoName: r.hmoId ? (hmoById.get(r.hmoId)?.name ?? 'Unknown HMO') : 'Unassigned HMO',
          totalAmount: (r._sum.amount ?? new Prisma.Decimal(0)).toFixed(2),
          count: r._count._all,
        }))
        .sort((a, b) => Number(b.totalAmount) - Number(a.totalAmount)),
      byStaff: byStaff
        .map((r) => {
          const owner = r.payerStaffId ? staffById.get(r.payerStaffId) : null;
          return {
            payerStaffId: r.payerStaffId,
            payerStaffName: owner ? `${owner.firstName} ${owner.lastName}`.trim() : 'Unknown staff',
            payerStaffCode: owner?.staffId ?? null,
            totalAmount: (r._sum.amount ?? new Prisma.Decimal(0)).toFixed(2),
            count: r._count._all,
          };
        })
        .sort((a, b) => Number(b.totalAmount) - Number(a.totalAmount)),
    };
  }

  private async getRemittanceWithClient(
    client: PrismaService | Prisma.TransactionClient,
    id: string,
  ) {
    const row = await client.coverageRemittance.findUnique({
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

  async getRemittance(id: string) {
    return this.getRemittanceWithClient(this.prisma, id);
  }

  async createRemittance(dto: CreateRemittanceDto, authStaffId?: string) {
    return this.prisma.$transaction(async (tx) => {
      if (dto.payerType === CoverageRemittancePayerType.HMO) {
        if (!dto.hmoId) throw new BadRequestException('HmoId is required when payerType=HMO');
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

      return this.getRemittanceWithClient(tx, remittance.id);
    });
  }
}

