import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RadiologyRequestStatus } from '@prisma/client';

const ACTIVE_STATUSES: RadiologyRequestStatus[] = [
  RadiologyRequestStatus.PENDING,
  RadiologyRequestStatus.SCHEDULED,
  RadiologyRequestStatus.IN_PROGRESS,
];

const COMPLETED_STATUSES: RadiologyRequestStatus[] = [
  RadiologyRequestStatus.COMPLETED,
  RadiologyRequestStatus.REPORTED,
];

@Injectable()
export class RadiologyDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard() {
    const now = new Date();
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      0,
      0,
      0,
      0,
    );

    const [totalToday, pending, completed, waitingReports, urgentCount] =
      await Promise.all([
        this.prisma.radiologyOrderItem.count({
          where: { createdAt: { gte: startOfToday } },
        }),
        this.prisma.radiologyOrderItem.count({
          where: { status: { in: ACTIVE_STATUSES } },
        }),
        this.prisma.radiologyOrderItem.count({
          where: { status: { in: COMPLETED_STATUSES } },
        }),
        this.prisma.radiologyOrderItem.count({
          where: {
            status: RadiologyRequestStatus.COMPLETED,
            report: null,
          },
        }),
        this.prisma.radiologyOrderItem.count({
          where: {
            priority: 'EMERGENCY',
            status: { in: ACTIVE_STATUSES },
          },
        }),
      ]);

    return {
      totalScansToday: totalToday,
      pending,
      completed,
      waitingReports,
      urgentCases: urgentCount,
    };
  }
}
