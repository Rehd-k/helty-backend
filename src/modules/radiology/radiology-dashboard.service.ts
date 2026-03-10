import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RadiologyRequestStatus } from '@prisma/client';

@Injectable()
export class RadiologyDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard() {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

    const [
      totalToday,
      pending,
      completed,
      waitingReports,
      urgentCount,
    ] = await Promise.all([
      this.prisma.radiologyRequest.count({
        where: { createdAt: { gte: startOfToday } },
      }),
      this.prisma.radiologyRequest.count({
        where: { status: RadiologyRequestStatus.PENDING },
      }),
      this.prisma.radiologyRequest.count({
        where: { status: RadiologyRequestStatus.COMPLETED },
      }),
      this.prisma.radiologyRequest.count({
        where: { status: RadiologyRequestStatus.COMPLETED },
      }),
      this.prisma.radiologyRequest.count({
        where: {
          priority: 'EMERGENCY',
          status: { in: [RadiologyRequestStatus.PENDING, RadiologyRequestStatus.SCHEDULED, RadiologyRequestStatus.IN_PROGRESS] },
        },
      }),
    ]);

    const completedWithoutReport = await this.prisma.radiologyRequest.count({
      where: {
        status: RadiologyRequestStatus.COMPLETED,
        report: null,
      },
    });

    return {
      totalScansToday: totalToday,
      pending,
      completed,
      waitingReports: completedWithoutReport,
      urgentCases: urgentCount,
    };
  }
}
