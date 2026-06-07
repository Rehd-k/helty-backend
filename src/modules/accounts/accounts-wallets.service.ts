import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { toNumber } from './accounts.utils';

@Injectable()
export class AccountsWalletsService {
  constructor(private readonly prisma: PrismaService) {}

  async summary() {
    const wallets = await this.prisma.patientWallet.findMany({
      where: { balance: { gt: 0 } },
      include: {
        patient: {
          select: { id: true, firstName: true, surname: true },
        },
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { createdAt: true },
        },
        _count: { select: { transactions: true } },
      },
      orderBy: { balance: 'desc' },
    });

    const totalAgg = await this.prisma.patientWallet.aggregate({
      _sum: { balance: true },
      _count: { id: true },
    });

    const activeWallets = wallets.length;

    return {
      totalFloat: toNumber(totalAgg._sum.balance),
      activeWallets,
      rows: wallets.map((w) => ({
        patientId: w.patientId,
        patientName: `${w.patient.firstName ?? ''} ${w.patient.surname ?? ''}`.trim(),
        balance: toNumber(w.balance),
        lastTransactionAt:
          w.transactions[0]?.createdAt.toISOString() ?? null,
        transactionCount: w._count.transactions,
      })),
    };
  }
}
