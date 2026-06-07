import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  FinanceApprovalStatus,
  FiscalPeriodStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { assertAccountHead, staffLabel, toNumber } from './accounts.utils';
import {
  CreateFinanceApprovalDto,
  RejectApprovalDto,
  ReviewApprovalDto,
} from './dto/accounts-body.dto';

@Injectable()
export class AccountsApprovalsService {
  constructor(private readonly prisma: PrismaService) {}

  async listPending() {
    const approvals = await this.prisma.financeApproval.findMany({
      where: { status: FinanceApprovalStatus.pending },
      orderBy: { submittedAt: 'desc' },
      include: {
        requester: {
          select: { email: true, staffId: true, firstName: true, lastName: true },
        },
      },
    });

    return {
      approvals: approvals.map((a) => ({
        id: a.id,
        type: a.type,
        amount: toNumber(a.amount),
        requester: staffLabel(a.requester),
        status: a.status,
        submittedAt: a.submittedAt.toISOString(),
        detail: a.detail,
        entityRef: a.entityRef,
      })),
    };
  }

  async create(dto: CreateFinanceApprovalDto, requesterId: string) {
    return this.prisma.financeApproval.create({
      data: {
        type: dto.type,
        amount: dto.amount,
        requesterId,
        entityRef: dto.entityRef,
        detail: dto.detail,
        status: FinanceApprovalStatus.pending,
      },
    });
  }

  async approve(id: string, dto: ReviewApprovalDto, reviewerId: string, staffRole?: string) {
    assertAccountHead(staffRole);
    const row = await this.prisma.financeApproval.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Approval not found');
    if (row.status !== FinanceApprovalStatus.pending) {
      throw new ConflictException('Approval is no longer pending.');
    }

    return this.prisma.financeApproval.update({
      where: { id },
      data: {
        status: FinanceApprovalStatus.approved,
        note: dto.note,
        reviewedById: reviewerId,
        reviewedAt: new Date(),
      },
    });
  }

  async reject(
    id: string,
    dto: RejectApprovalDto,
    reviewerId: string,
    staffRole?: string,
  ) {
    assertAccountHead(staffRole);
    const row = await this.prisma.financeApproval.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Approval not found');
    if (row.status !== FinanceApprovalStatus.pending) {
      throw new ConflictException('Approval is no longer pending.');
    }

    return this.prisma.financeApproval.update({
      where: { id },
      data: {
        status: FinanceApprovalStatus.rejected,
        reason: dto.reason,
        reviewedById: reviewerId,
        reviewedAt: new Date(),
      },
    });
  }
}

@Injectable()
export class AccountsPeriodsService {
  constructor(private readonly prisma: PrismaService) {}

  async listPeriods() {
    const periods = await this.prisma.fiscalPeriod.findMany({
      orderBy: { startDate: 'desc' },
      include: {
        closedBy: {
          select: { email: true, staffId: true, firstName: true, lastName: true },
        },
      },
    });

    return {
      periods: periods.map((p) => ({
        id: p.id,
        label: p.label,
        startDate: p.startDate.toISOString().slice(0, 10),
        endDate: p.endDate.toISOString().slice(0, 10),
        status: p.status,
        closedAt: p.closedAt?.toISOString() ?? null,
        closedBy: p.closedBy ? staffLabel(p.closedBy) : null,
      })),
    };
  }

  async closePeriod(id: string, staffId: string, staffRole?: string) {
    assertAccountHead(staffRole);
    const period = await this.prisma.fiscalPeriod.findUnique({ where: { id } });
    if (!period) throw new NotFoundException('Fiscal period not found');
    if (period.status === FiscalPeriodStatus.closed) {
      throw new ConflictException('Fiscal period is already closed.');
    }

    return this.prisma.fiscalPeriod.update({
      where: { id },
      data: {
        status: FiscalPeriodStatus.closed,
        closedAt: new Date(),
        closedById: staffId,
      },
    });
  }
}
