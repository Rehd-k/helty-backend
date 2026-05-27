import { Injectable } from '@nestjs/common';
import { EncounterStatus } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import type { CmacPeriodContext, NamedCount, SeriesPoint } from '../cmac-analytics.types';
import { buildKpi, inRange } from '../cmac-analytics.helpers';

const NO_SHOW_STATUS = 'no_show';

@Injectable()
export class CmacOperationsService {
  constructor(private readonly prisma: PrismaService) {}

  async getReport(ctx: CmacPeriodContext, limit = 10) {
    const [
      noShowCur,
      noShowPrev,
      totalAptCur,
      totalAptPrev,
      waitCur,
      waitPrev,
      doctorWorkload,
      deptUtilization,
      peakHours,
    ] = await Promise.all([
      this.countNoShows(ctx, 'current'),
      this.countNoShows(ctx, 'previous'),
      this.countAppointments(ctx, 'current'),
      this.countAppointments(ctx, 'previous'),
      this.averageWaitMinutes(ctx, 'current'),
      this.averageWaitMinutes(ctx, 'previous'),
      this.doctorWorkload(ctx, limit),
      this.departmentUtilization(ctx, limit),
      this.peakVisitingHours(ctx),
    ]);

    const noShowRateCur =
      totalAptCur > 0 ? Math.round((noShowCur / totalAptCur) * 1000) / 10 : 0;
    const noShowRatePrev =
      totalAptPrev > 0 ? Math.round((noShowPrev / totalAptPrev) * 1000) / 10 : 0;

    return {
      period: ctx.period,
      asOf: ctx.asOf.toISOString(),
      kpis: [
        buildKpi('noShows', 'Missed appointments (no-shows)', noShowCur, noShowPrev, {
          positiveWhenUp: false,
        }),
        buildKpi('noShowRate', 'No-show rate (%)', noShowRateCur, noShowRatePrev, {
          unit: '%',
          positiveWhenUp: false,
        }),
        buildKpi(
          'avgWaitMinutes',
          'Average waiting time',
          waitCur,
          waitPrev,
          { unit: 'min', positiveWhenUp: false },
        ),
      ],
      doctorWorkload,
      departmentUtilization: deptUtilization,
      peakVisitingHours: peakHours,
    };
  }

  private async countNoShows(
    ctx: CmacPeriodContext,
    which: 'current' | 'previous',
  ) {
    return this.prisma.appointment.count({
      where: { status: NO_SHOW_STATUS, date: inRange(ctx, which) },
    });
  }

  private async countAppointments(
    ctx: CmacPeriodContext,
    which: 'current' | 'previous',
  ) {
    return this.prisma.appointment.count({
      where: { date: inRange(ctx, which) },
    });
  }

  private async averageWaitMinutes(
    ctx: CmacPeriodContext,
    which: 'current' | 'previous',
  ) {
    const range = inRange(ctx, which);
    const seen = await this.prisma.waitingPatient.findMany({
      where: {
        seen: true,
        createdAt: range,
      },
      select: { createdAt: true, updatedAt: true },
    });
    if (seen.length === 0) return 0;
    const total = seen.reduce(
      (s, w) =>
        s + Math.max(0, (w.updatedAt.getTime() - w.createdAt.getTime()) / 60000),
      0,
    );
    return Math.round(total / seen.length);
  }

  private async doctorWorkload(
    ctx: CmacPeriodContext,
    limit: number,
  ): Promise<NamedCount[]> {
    const rows = await this.prisma.encounter.groupBy({
      by: ['doctorId'],
      where: {
        status: EncounterStatus.COMPLETED,
        endTime: inRange(ctx, 'current'),
      },
      _count: { _all: true },
      orderBy: { _count: { doctorId: 'desc' } },
      take: limit,
    });
    const staff = await this.prisma.staff.findMany({
      where: { id: { in: rows.map((r) => r.doctorId) } },
      select: { id: true, firstName: true, lastName: true },
    });
    const names = new Map(
      staff.map((s) => [s.id, `${s.firstName} ${s.lastName}`.trim()]),
    );
    return rows.map((r) => ({
      name: names.get(r.doctorId) ?? r.doctorId,
      count: r._count._all,
    }));
  }

  private async departmentUtilization(
    ctx: CmacPeriodContext,
    limit: number,
  ): Promise<NamedCount[]> {
    const byService = await this.prisma.invoiceItem.groupBy({
      by: ['serviceId'],
      where: {
        invoice: { createdAt: inRange(ctx, 'current') },
        service: { departmentId: { not: null } },
      },
      _count: { _all: true },
      orderBy: { _count: { serviceId: 'desc' } },
      take: limit * 3,
    });
    const services = await this.prisma.service.findMany({
      where: { id: { in: byService.map((s) => s.serviceId!).filter(Boolean) } },
      include: { department: { select: { name: true } } },
    });
    const deptMap = new Map<string, number>();
    for (const row of byService) {
      const svc = services.find((s) => s.id === row.serviceId);
      const dept = svc?.department?.name ?? 'Unassigned';
      deptMap.set(dept, (deptMap.get(dept) ?? 0) + row._count._all);
    }
    return [...deptMap.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  private async peakVisitingHours(ctx: CmacPeriodContext): Promise<SeriesPoint[]> {
    const encounters = await this.prisma.encounter.findMany({
      where: { startTime: inRange(ctx, 'current') },
      select: { startTime: true },
    });
    const hours = Array.from({ length: 24 }, () => 0);
    for (const e of encounters) {
      hours[e.startTime.getUTCHours()] += 1;
    }
    return hours.map((value, h) => ({
      label: `${String(h).padStart(2, '0')}:00`,
      value,
      start: '',
      end: '',
    }));
  }
}
