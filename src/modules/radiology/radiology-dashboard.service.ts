import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RadiologyRequestStatus } from '@prisma/client';
import { parseDateRange } from '../../common/utils/date-range';
import { RadiologyDashboardQueryDto } from './dto/radiology-dashboard-query.dto';

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
  constructor(private readonly prisma: PrismaService) { }

  async getDashboard(query: RadiologyDashboardQueryDto) {
    const { from, to } = parseDateRange(query.fromDate, query.toDate);
    const dateFilter = { createdAt: { gte: from, lte: to } };

    const [totalToday, pending, completed, waitingReports, urgentCount] =
      await Promise.all([
        this.prisma.radiologyOrderItem.count({
          where: dateFilter,
        }),
        this.prisma.radiologyOrderItem.count({
          where: { ...dateFilter, status: { in: ACTIVE_STATUSES } },
        }),
        this.prisma.radiologyOrderItem.count({
          where: { ...dateFilter, status: { in: COMPLETED_STATUSES } },
        }),
        this.prisma.radiologyOrderItem.count({
          where: {
            ...dateFilter,
            status: RadiologyRequestStatus.COMPLETED,
            report: null,
          },
        }),
        this.prisma.radiologyOrderItem.count({
          where: {
            ...dateFilter,
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
      window: { from: from.toISOString(), to: to.toISOString() },
    };
  }
}
