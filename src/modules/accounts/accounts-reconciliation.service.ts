import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  FinanceReconciliationStatus,
  InvoicePaymentSource,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  assertAccountHead,
  formatDateOnly,
  isAccountHead,
  toNumber,
} from './accounts.utils';
import {
  CreateBankReconciliationDto,
  SubmitDailyCashDto,
} from './dto/accounts-body.dto';

@Injectable()
export class AccountsReconciliationService {
  constructor(private readonly prisma: PrismaService) {}

  async listDailyCash() {
    const rows = await this.prisma.dailyCashReconciliation.findMany({
      orderBy: { date: 'desc' },
      take: 90,
      include: {
        submittedBy: {
          select: { firstName: true, lastName: true, email: true },
        },
        closedBy: {
          select: { firstName: true, lastName: true, email: true },
        },
      },
    });
    return { rows };
  }

  async submitDailyCash(
    dto: SubmitDailyCashDto,
    staffId: string,
    staffRole?: string,
  ) {
    const date = new Date(dto.date);
    date.setHours(0, 0, 0, 0);

    const dayStart = new Date(date);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    const expected = await this.prisma.invoicePayment.aggregate({
      where: {
        source: InvoicePaymentSource.CASH,
        paidAt: { gte: dayStart, lte: dayEnd },
      },
      _sum: { amount: true },
    });
    const expectedCash = toNumber(expected._sum.amount);
    const countedCash = dto.countedCash;
    const variance = countedCash - expectedCash;

    const existing = await this.prisma.dailyCashReconciliation.findUnique({
      where: { date },
    });

    if (existing?.status === FinanceReconciliationStatus.closed) {
      throw new ConflictException('Daily cash reconciliation is already closed.');
    }

    const status = isAccountHead(staffRole)
      ? FinanceReconciliationStatus.closed
      : FinanceReconciliationStatus.submitted;

    const data: Prisma.DailyCashReconciliationUncheckedCreateInput = {
      date,
      countedCash,
      expectedCash,
      variance,
      status,
      notes: dto.notes,
      submittedById: staffId,
      ...(isAccountHead(staffRole) ? { closedById: staffId } : {}),
    };

    if (existing) {
      return this.prisma.dailyCashReconciliation.update({
        where: { date },
        data,
      });
    }

    return this.prisma.dailyCashReconciliation.create({ data });
  }

  async listBankRecon() {
    const rows = await this.prisma.bankReconciliation.findMany({
      orderBy: { statementDate: 'desc' },
      take: 50,
      include: { bank: { select: { id: true, name: true } } },
    });
    return {
      rows: rows.map((r) => ({
        id: r.id,
        bankName: r.bank.name,
        statementDate: formatDateOnly(r.statementDate),
        bookBalance: toNumber(r.bookBalance),
        statementBalance: toNumber(r.statementBalance),
        variance: toNumber(r.variance),
        status: r.status,
      })),
    };
  }

  async createBankRecon(
    dto: CreateBankReconciliationDto,
    staffId: string,
    staffRole?: string,
  ) {
    assertAccountHead(staffRole);

    const bank = await this.prisma.bank.findUnique({
      where: { id: dto.bankId },
    });
    if (!bank) throw new NotFoundException('Bank not found');

    const statementDate = new Date(dto.statementDate);
    const payments = await this.prisma.invoicePayment.aggregate({
      where: { bankId: dto.bankId },
      _sum: { amount: true },
    });
    const bookBalance = toNumber(payments._sum.amount);
    const statementBalance = dto.statementBalance;
    const variance = statementBalance - bookBalance;

    return this.prisma.bankReconciliation.create({
      data: {
        bankId: dto.bankId,
        statementDate,
        bookBalance,
        statementBalance,
        variance,
        status: FinanceReconciliationStatus.open,
        closedById: staffId,
      },
      include: { bank: { select: { name: true } } },
    });
  }
}
