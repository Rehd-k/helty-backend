import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  assertAccountHead,
  assertPeriodOpen,
  toNumber,
} from './accounts.utils';
import {
  CreateChartOfAccountDto,
  CreateJournalEntryDto,
  UpdateChartOfAccountDto,
} from './dto/accounts-body.dto';
import { AccountsDateRangeQueryDto } from './dto/accounts-query.dto';

@Injectable()
export class AccountsGlService {
  constructor(private readonly prisma: PrismaService) {}

  async listJournalEntries(q: AccountsDateRangeQueryDto) {
    const from = q.from ? new Date(q.from) : new Date(0);
    const to = q.to ? new Date(q.to) : new Date();
    to.setHours(23, 59, 59, 999);

    const entries = await this.prisma.journalEntry.findMany({
      where: { entryDate: { gte: from, lte: to } },
      orderBy: { entryDate: 'desc' },
      include: {
        debitAccount: { select: { code: true, name: true } },
        creditAccount: { select: { code: true, name: true } },
        createdBy: {
          select: { firstName: true, lastName: true, email: true },
        },
      },
    });

    return { entries };
  }

  async createJournalEntry(
    dto: CreateJournalEntryDto,
    createdById: string,
    staffRole?: string,
  ) {
    assertAccountHead(staffRole);
    const entryDate = new Date(dto.entryDate);
    await assertPeriodOpen(this.prisma, entryDate);

    const [debit, credit] = await Promise.all([
      this.prisma.chartOfAccount.findUnique({ where: { code: dto.debitAccount } }),
      this.prisma.chartOfAccount.findUnique({ where: { code: dto.creditAccount } }),
    ]);
    if (!debit || !credit) {
      throw new NotFoundException('Debit or credit account not found');
    }
    if (!debit.isActive || !credit.isActive) {
      throw new ConflictException('Account is inactive');
    }

    const existing = await this.prisma.journalEntry.findUnique({
      where: { reference: dto.reference },
    });
    if (existing) {
      throw new ConflictException(`Journal reference ${dto.reference} already exists.`);
    }

    const fiscalPeriod = await this.prisma.fiscalPeriod.findFirst({
      where: {
        startDate: { lte: entryDate },
        endDate: { gte: entryDate },
        status: 'open',
      },
    });

    const amount = new Prisma.Decimal(dto.amount);

    return this.prisma.$transaction(async (tx) => {
      const entry = await tx.journalEntry.create({
        data: {
          entryDate,
          reference: dto.reference,
          description: dto.description,
          amount,
          debitAccountId: debit.id,
          creditAccountId: credit.id,
          fiscalPeriodId: fiscalPeriod?.id,
          createdById,
        },
        include: {
          debitAccount: true,
          creditAccount: true,
        },
      });

      await tx.chartOfAccount.update({
        where: { id: debit.id },
        data: { balance: { increment: amount } },
      });
      await tx.chartOfAccount.update({
        where: { id: credit.id },
        data: { balance: { increment: amount } },
      });

      return entry;
    });
  }

  async listChartOfAccounts() {
    const accounts = await this.prisma.chartOfAccount.findMany({
      orderBy: { code: 'asc' },
    });
    return {
      accounts: accounts.map((a) => ({
        id: a.id,
        code: a.code,
        name: a.name,
        type: a.type,
        isActive: a.isActive,
        balance: toNumber(a.balance),
      })),
    };
  }

  async createChartOfAccount(dto: CreateChartOfAccountDto, staffRole?: string) {
    assertAccountHead(staffRole);
    const existing = await this.prisma.chartOfAccount.findUnique({
      where: { code: dto.code },
    });
    if (existing) {
      throw new ConflictException(`Account code ${dto.code} already exists.`);
    }
    return this.prisma.chartOfAccount.create({ data: dto });
  }

  async updateChartOfAccount(
    id: string,
    dto: UpdateChartOfAccountDto,
    staffRole?: string,
  ) {
    assertAccountHead(staffRole);
    const account = await this.prisma.chartOfAccount.findUnique({ where: { id } });
    if (!account) throw new NotFoundException('Account not found');

    return this.prisma.chartOfAccount.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
  }
}
