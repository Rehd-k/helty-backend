import { Injectable } from '@nestjs/common';
import { LabOrderStatus } from '@prisma/client';
import {
  formatPatientDisplayName,
  patientNameFieldsSelect,
} from '../../../common/utils/patient-display-name.util';
import { PrismaService } from '../../../prisma/prisma.service';
import type { AlertItem, CmacPeriodContext, NamedCount } from '../cmac-analytics.types';
import { buildKpi, inRange } from '../cmac-analytics.helpers';

@Injectable()
export class CmacLaboratoryService {
  constructor(private readonly prisma: PrismaService) {}

  async getReport(ctx: CmacPeriodContext, limit = 10) {
    const range = inRange(ctx, 'current');
    const prevRange = inRange(ctx, 'previous');

    const [
      withResultsCur,
      withResultsPrev,
      pendingCur,
      completedCur,
      tatCur,
      tatPrev,
      topTests,
      criticalCount,
      criticalAlerts,
      statusBreakdown,
    ] = await Promise.all([
      this.countItemsWithResults(range),
      this.countItemsWithResults(prevRange),
      this.prisma.labOrder.count({
        where: {
          status: { in: [LabOrderStatus.PENDING, LabOrderStatus.PROCESSING] },
          createdAt: range,
        },
      }),
      this.prisma.labOrder.count({
        where: {
          status: { in: [LabOrderStatus.COMPLETED, LabOrderStatus.VERIFIED] },
          createdAt: range,
        },
      }),
      this.medianTatHours(range),
      this.medianTatHours(prevRange),
      this.topTests(range, limit),
      this.prisma.labResult.count({
        where: { isCritical: true, createdAt: range },
      }),
      this.criticalAlerts(range, limit),
      this.statusBreakdown(range),
    ]);

    return {
      period: ctx.period,
      asOf: ctx.asOf.toISOString(),
      kpis: [
        buildKpi(
          'testsWithResults',
          'Tests with results',
          withResultsCur,
          withResultsPrev,
        ),
        buildKpi(
          'medianTatHours',
          'Median turnaround (hours)',
          tatCur,
          tatPrev,
          { unit: 'hrs', positiveWhenUp: false },
        ),
        buildKpi(
          'criticalResults',
          'Critical abnormal results',
          criticalCount,
          await this.prisma.labResult.count({
            where: { isCritical: true, createdAt: prevRange },
          }),
          { positiveWhenUp: false },
        ),
      ],
      pendingVsCompleted: { pending: pendingCur, completed: completedCur },
      statusBreakdown,
      topTests,
      criticalAlerts,
    };
  }

  private async countItemsWithResults(range: { gte: Date; lte: Date }) {
    return this.prisma.labOrderItem.count({
      where: {
        results: { some: {} },
        createdAt: range,
      },
    });
  }

  private async medianTatHours(range: { gte: Date; lte: Date }): Promise<number> {
    const orders = await this.prisma.labOrder.findMany({
      where: { createdAt: range },
      select: {
        createdAt: true,
        completedAt: true,
        items: {
          select: {
            results: { select: { createdAt: true }, orderBy: { createdAt: 'desc' }, take: 1 },
          },
        },
      },
    });
    const hours: number[] = [];
    for (const o of orders) {
      const end =
        o.completedAt ??
        o.items
          .map((i) => i.results[0]?.createdAt)
          .filter(Boolean)
          .sort((a, b) => (b!.getTime() - a!.getTime()))[0];
      if (!end) continue;
      const h = (end.getTime() - o.createdAt.getTime()) / (1000 * 60 * 60);
      if (h >= 0) hours.push(h);
    }
    if (hours.length === 0) return 0;
    hours.sort((a, b) => a - b);
    const mid = Math.floor(hours.length / 2);
    const med =
      hours.length % 2 === 0
        ? (hours[mid - 1] + hours[mid]) / 2
        : hours[mid];
    return Math.round(med * 10) / 10;
  }

  private async topTests(
    range: { gte: Date; lte: Date },
    limit: number,
  ): Promise<NamedCount[]> {
    const items = await this.prisma.labOrderItem.findMany({
      where: { createdAt: range },
      select: {
        testVersion: { select: { test: { select: { name: true } } } },
      },
    });
    const map = new Map<string, number>();
    for (const i of items) {
      const name = i.testVersion.test.name;
      map.set(name, (map.get(name) ?? 0) + 1);
    }
    return [...map.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  private async criticalAlerts(
    range: { gte: Date; lte: Date },
    limit: number,
  ): Promise<AlertItem[]> {
    const rows = await this.prisma.labResult.findMany({
      where: { isCritical: true, createdAt: range },
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        field: { select: { label: true } },
        orderItem: {
          include: {
            order: {
              include: {
                patient: {
                  select: patientNameFieldsSelect,
                },
              },
            },
            testVersion: { include: { test: { select: { name: true } } } },
          },
        },
      },
    });
    return rows.map((r) => {
      const p = r.orderItem.order.patient;
      const name =
        formatPatientDisplayName(p) === 'Unknown'
          ? p.patientId || p.id
          : formatPatientDisplayName(p);
      return {
        severity: 'critical' as const,
        code: 'LAB_CRITICAL',
        message: `${name}: ${r.orderItem.testVersion.test.name} — ${r.field.label} = ${r.value ?? '—'}`,
        metric: 'laboratory',
      };
    });
  }

  private async statusBreakdown(range: { gte: Date; lte: Date }) {
    const statuses = Object.values(LabOrderStatus);
    const counts = await Promise.all(
      statuses.map((status) =>
        this.prisma.labOrder.count({ where: { status, createdAt: range } }),
      ),
    );
    return statuses.map((status, i) => ({
      name: status,
      count: counts[i],
    }));
  }
}
