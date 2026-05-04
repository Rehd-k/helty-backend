import { Injectable } from '@nestjs/common';
import { AccountType, AdmissionStatus, AlertSeverity } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { compareMetrics } from '../billing-analytics/billing-analytics-math';
import {
  NurseDashboardTimeRange,
  parseAsOf,
  previousEqualWindow,
  windowForTimeRange,
} from './nurses-dashboard-window.util';

/** UI green/red: higher occupancy = more strain → an increase is not "positive". */
const BED_OCCUPANCY_UP_IS_NEGATIVE = true;

type DeltaPercent = {
  kind: 'percent';
  value: number;
  label: string;
  direction: 'up' | 'down' | 'flat';
  isPositive: boolean;
};

type DeltaMinutes = {
  kind: 'minutes';
  value: number;
  label: string;
  direction: 'up' | 'down' | 'flat';
  isPositive: boolean;
};

type DeltaText = {
  kind: 'text';
  label: string;
  isPositive: boolean;
};

function formatInt(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}

function formatPercentDelta(cmp: {
  percentChange: number | null;
  direction: 'up' | 'down' | 'flat';
}): DeltaPercent {
  const v = cmp.percentChange ?? 0;
  const sign = v > 0 ? '+' : '';
  const label = `${sign}${v}%`;
  const isPositive =
    cmp.direction === 'flat' ? true : cmp.direction === 'up' ? v >= 0 : v <= 0;
  return {
    kind: 'percent',
    value: Math.round(v * 100) / 100,
    label,
    direction: cmp.direction,
    isPositive,
  };
}

function formatBedOccupancyDelta(cmp: {
  percentChange: number | null;
  direction: 'up' | 'down' | 'flat';
}): DeltaPercent {
  const base = formatPercentDelta(cmp);
  if (BED_OCCUPANCY_UP_IS_NEGATIVE && cmp.direction === 'up') {
    return { ...base, isPositive: false };
  }
  if (BED_OCCUPANCY_UP_IS_NEGATIVE && cmp.direction === 'down') {
    return { ...base, isPositive: true };
  }
  return base;
}

function formatWaitDelta(
  currentAvg: number,
  previousAvg: number,
): DeltaMinutes {
  const diff = Math.round(currentAvg - previousAvg);
  let direction: 'up' | 'down' | 'flat' = 'flat';
  if (diff > 0) direction = 'up';
  else if (diff < 0) direction = 'down';
  const sign = diff > 0 ? '+' : '';
  const label = `${sign}${diff}m`;
  return {
    kind: 'minutes',
    value: diff,
    label,
    direction,
    isPositive: diff <= 0,
  };
}

function shortDeptLabel(name: string): string {
  if (name.length <= 12) return name;
  return name.slice(0, 10) + '…';
}

function staffRoleTitle(staffRole: string): string {
  const map: Record<string, string> = {
    HEAD_NURSE: 'Head Nurse',
    INPATIENT_NURSE: 'Inpatient Nurse',
    OUTPATIENT_NURSE: 'Outpatient Nurse',
  };
  return map[staffRole] ?? staffRole.replace(/_/g, ' ');
}

function alertSeverityApi(s: AlertSeverity): 'critical' | 'warning' {
  if (s === AlertSeverity.CRITICAL) return 'critical';
  return 'warning';
}

function relativeLabel(occurredAt: Date, asOf: Date): string {
  const sec = Math.max(
    0,
    Math.floor((asOf.getTime() - occurredAt.getTime()) / 1000),
  );
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 48) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

@Injectable()
export class NursesDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(
    timeRange: NurseDashboardTimeRange,
    asOfRaw: string | undefined,
    staffId: string,
  ) {
    const asOf = parseAsOf(asOfRaw);
    const window = windowForTimeRange(timeRange, asOf);
    const prev = previousEqualWindow(window.start, window.end);

    const staff = await this.prisma.staff.findUnique({
      where: { id: staffId },
      select: { firstName: true, lastName: true },
    });
    const userDisplayName =
      staff?.firstName?.trim() || staff?.lastName?.trim() || 'there';

    const [
      totalPatientsCurrent,
      totalPatientsPrev,
      bedCurrent,
      bedPrev,
      activeNurseHeadcount,
      waitCurrent,
      waitPrev,
      seriesPoints,
      departmentLoad,
      staffOnDuty,
      criticalAlerts,
    ] = await Promise.all([
      this.countDistinctPatientsInWindow(window.start, window.end),
      this.countDistinctPatientsInWindow(prev.start, prev.end),
      this.bedOccupancyAt(asOf),
      this.bedOccupancyAt(prev.end),
      this.countActiveNurses(),
      this.averageWaitMinutes(window.start, window.end),
      this.averageWaitMinutes(prev.start, prev.end),
      this.buildAdmissionsDischargesSeries(timeRange, window, asOf),
      this.buildDepartmentLoad(),
      this.buildStaffOnDuty(),
      this.buildCriticalAlerts(asOf),
    ]);

    const totalCmp = compareMetrics(totalPatientsCurrent, totalPatientsPrev);
    const bedRatioCurr = bedCurrent.ratio;
    const bedRatioPrev = bedPrev.ratio;
    const bedCmp = compareMetrics(
      Math.round(bedRatioCurr * 10000) / 100,
      Math.round(bedRatioPrev * 10000) / 100,
    );

    const yMax = Math.max(
      1,
      ...seriesPoints.flatMap((p) => [p.admissions, p.discharges]),
    );
    const yAxisMax = yMax <= 100 ? 100 : Math.ceil(yMax * 1.1);

    return {
      asOf: asOf.toISOString(),
      timeRange,
      window: {
        start: window.start.toISOString(),
        end: window.end.toISOString(),
      },
      header: {
        title: 'Hospital Overview',
        subtitleTemplate:
          "Welcome back, {name}. Here's what's happening today.",
        userDisplayName,
      },
      kpis: {
        totalPatients: {
          value: totalPatientsCurrent,
          valueFormatted: formatInt(totalPatientsCurrent),
          delta: formatPercentDelta(totalCmp),
        },
        bedOccupancy: {
          ratio: bedRatioCurr,
          valueFormatted: `${Math.round(bedRatioCurr * 100)}%`,
          delta: formatBedOccupancyDelta(bedCmp),
        },
        activeStaff: {
          count: activeNurseHeadcount,
          valueFormatted: formatInt(activeNurseHeadcount),
          delta: {
            kind: 'text',
            label: 'Optimal',
            isPositive: true,
          } satisfies DeltaText,
        },
        averageWaitTime: {
          minutes: waitCurrent,
          valueFormatted: `${waitCurrent}m`,
          delta: formatWaitDelta(waitCurrent, waitPrev),
        },
      },
      admissionsDischargesSeries: {
        points: seriesPoints,
        meta: {
          yAxisMax,
          yAxisSuggested: yMax <= 100,
        },
      },
      departmentLoad,
      staffOnDuty,
      criticalAlerts,
    };
  }

  private async countDistinctPatientsInWindow(from: Date, to: Date) {
    const [enc, adm] = await Promise.all([
      this.prisma.encounter.groupBy({
        by: ['patientId'],
        where: { startTime: { gte: from, lte: to } },
      }),
      this.prisma.admission.groupBy({
        by: ['patientId'],
        where: { admissionDateTime: { gte: from, lte: to } },
      }),
    ]);
    return new Set([
      ...enc.map((e) => e.patientId),
      ...adm.map((a) => a.patientId),
    ]).size;
  }

  /**
   * Inpatient census at instant `at` (admitted on/before `at`, not yet discharged before `at`)
   * as a fraction of total ward capacity (sum of `Ward.capacity`). If capacity is unset, uses
   * physical bed count as the denominator when available.
   */
  private async bedOccupancyAt(at: Date): Promise<{
    ratio: number;
    occupied: number;
    capacity: number;
  }> {
    const [wards, bedTotal] = await Promise.all([
      this.prisma.ward.findMany({ select: { capacity: true } }),
      this.prisma.bed.count(),
    ]);
    const wardCap = wards.reduce((s, w) => s + w.capacity, 0);
    const capacity = wardCap > 0 ? wardCap : Math.max(1, bedTotal);

    const occupied = await this.prisma.admission.count({
      where: {
        admissionDateTime: { lte: at },
        OR: [{ dischargeDateTime: null }, { dischargeDateTime: { gt: at } }],
      },
    });

    return {
      ratio: Math.min(1, occupied / capacity),
      occupied,
      capacity,
    };
  }

  private countActiveNurses(): Promise<number> {
    return this.prisma.staff.count({
      where: { isActive: true, accountType: AccountType.NURSE },
    });
  }

  private async averageWaitMinutes(from: Date, to: Date): Promise<number> {
    const rows = await this.prisma.waitingPatient.findMany({
      where: {
        seen: true,
        createdAt: { gte: from, lte: to },
      },
      select: { createdAt: true, updatedAt: true },
    });
    const mins = rows
      .map((r) => (r.updatedAt.getTime() - r.createdAt.getTime()) / 60000)
      .filter((m) => m >= 0 && m < 24 * 60);
    if (!mins.length) return 0;
    return Math.round(mins.reduce((a, b) => a + b, 0) / mins.length);
  }

  private async admissionsInRange(from: Date, to: Date) {
    return this.prisma.admission.count({
      where: { admissionDateTime: { gte: from, lte: to } },
    });
  }

  private async dischargesInRange(from: Date, to: Date) {
    return this.prisma.admission.count({
      where: {
        status: AdmissionStatus.DISCHARGED,
        OR: [
          { dischargeDateTime: { gte: from, lte: to } },
          {
            dischargeDateTime: null,
            dischargeDate: { gte: from, lte: to },
          },
        ],
      },
    });
  }

  private async buildAdmissionsDischargesSeries(
    timeRange: NurseDashboardTimeRange,
    window: { start: Date; end: Date },
    asOf: Date,
  ): Promise<Array<{ label: string; admissions: number; discharges: number }>> {
    if (timeRange === 'Today') {
      const y = window.start.getUTCFullYear();
      const mo = window.start.getUTCMonth();
      const day = window.start.getUTCDate();
      const hours = await Promise.all(
        Array.from({ length: 24 }, async (_, h) => {
          const from = new Date(Date.UTC(y, mo, day, h, 0, 0, 0));
          const to = new Date(Date.UTC(y, mo, day, h, 59, 59, 999));
          const [admissions, discharges] = await Promise.all([
            this.admissionsInRange(from, to),
            this.dischargesInRange(from, to),
          ]);
          return {
            label: `${String(h).padStart(2, '0')}:00`,
            admissions,
            discharges,
          };
        }),
      );
      return hours;
    }

    if (timeRange === 'Last 7 Days') {
      const points: Array<{
        label: string;
        admissions: number;
        discharges: number;
      }> = [];
      for (let i = 0; i < 7; i += 1) {
        const day = new Date(window.start);
        day.setUTCDate(day.getUTCDate() + i);
        const from = new Date(
          Date.UTC(
            day.getUTCFullYear(),
            day.getUTCMonth(),
            day.getUTCDate(),
            0,
            0,
            0,
            0,
          ),
        );
        const to = new Date(
          Date.UTC(
            day.getUTCFullYear(),
            day.getUTCMonth(),
            day.getUTCDate(),
            23,
            59,
            59,
            999,
          ),
        );
        const [admissions, discharges] = await Promise.all([
          this.admissionsInRange(from, to),
          this.dischargesInRange(from, to),
        ]);
        points.push({
          label: from.toLocaleDateString('en-US', {
            weekday: 'short',
            timeZone: 'UTC',
          }),
          admissions,
          discharges,
        });
      }
      return points;
    }

    if (timeRange === 'This Month') {
      const points: Array<{
        label: string;
        admissions: number;
        discharges: number;
      }> = [];
      const cursor = new Date(window.start);
      while (cursor.getTime() <= window.end.getTime()) {
        const from = new Date(
          Date.UTC(
            cursor.getUTCFullYear(),
            cursor.getUTCMonth(),
            cursor.getUTCDate(),
            0,
            0,
            0,
            0,
          ),
        );
        const to = new Date(
          Date.UTC(
            cursor.getUTCFullYear(),
            cursor.getUTCMonth(),
            cursor.getUTCDate(),
            23,
            59,
            59,
            999,
          ),
        );
        const [admissions, discharges] = await Promise.all([
          this.admissionsInRange(from, to),
          this.dischargesInRange(from, to),
        ]);
        points.push({
          label: String(cursor.getUTCDate()),
          admissions,
          discharges,
        });
        cursor.setUTCDate(cursor.getUTCDate() + 1);
      }
      return points;
    }

    const points: Array<{
      label: string;
      admissions: number;
      discharges: number;
    }> = [];
    const startMonth = window.start.getUTCMonth();
    const endMonth = asOf.getUTCMonth();
    const year = asOf.getUTCFullYear();
    for (let m = 0; m <= endMonth; m += 1) {
      if (m < startMonth) continue;
      const from = new Date(Date.UTC(year, m, 1, 0, 0, 0, 0));
      const to = new Date(Date.UTC(year, m + 1, 0, 23, 59, 59, 999));
      const sliceFrom =
        from.getTime() < window.start.getTime() ? window.start : from;
      const sliceTo = to.getTime() > window.end.getTime() ? window.end : to;
      const [admissions, discharges] = await Promise.all([
        this.admissionsInRange(sliceFrom, sliceTo),
        this.dischargesInRange(sliceFrom, sliceTo),
      ]);
      points.push({
        label: from.toLocaleDateString('en-US', {
          month: 'short',
          timeZone: 'UTC',
        }),
        admissions,
        discharges,
      });
    }
    return points;
  }

  private async buildDepartmentLoad(): Promise<{
    chartMax: number;
    bars: Array<{
      departmentId: string;
      shortLabel: string;
      load: number;
    }>;
  }> {
    const departments = await this.prisma.department.findMany({
      select: {
        id: true,
        name: true,
        wards: { select: { id: true, capacity: true } },
      },
    });

    const bars: Array<{
      departmentId: string;
      shortLabel: string;
      load: number;
    }> = [];

    for (const d of departments) {
      const wardIds = d.wards.map((w) => w.id);
      const cap = d.wards.reduce((s, w) => s + w.capacity, 0);
      if (!wardIds.length || cap <= 0) continue;

      const occupied = await this.prisma.admission.count({
        where: {
          status: AdmissionStatus.ACTIVE,
          wardId: { in: wardIds },
        },
      });

      const load = Math.min(100, Math.round((occupied / cap) * 100));
      bars.push({
        departmentId: d.id,
        shortLabel: shortDeptLabel(d.name),
        load,
      });
    }

    bars.sort((a, b) => b.load - a.load);
    return {
      chartMax: 100,
      bars: bars.slice(0, 5),
    };
  }

  private async buildStaffOnDuty() {
    const since = new Date(Date.now() - 8 * 60 * 60 * 1000);
    const nurses = await this.prisma.staff.findMany({
      where: { accountType: AccountType.NURSE, isActive: true },
      take: 12,
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        staffRole: true,
        patientVitalsRecorded: {
          where: { recordedAt: { gte: since } },
          orderBy: { recordedAt: 'desc' },
          take: 1,
          select: { recordedAt: true },
        },
      },
    });

    return nurses.map((s) => {
      const name = `${s.firstName} ${s.lastName}`.trim();
      const recent = s.patientVitalsRecorded[0]?.recordedAt;
      let status = 'On duty';
      let statusTone:
        | 'success'
        | 'warning'
        | 'danger'
        | 'neutral'
        | 'busy'
        | 'break' = 'neutral';
      if (recent) {
        status = 'Active — vitals';
        statusTone = 'busy';
      } else if (s.staffRole === 'HEAD_NURSE') {
        status = 'Supervising';
        statusTone = 'warning';
      } else {
        statusTone = 'success';
      }
      return {
        id: s.id,
        name,
        role: staffRoleTitle(s.staffRole),
        status,
        statusTone,
      };
    });
  }

  private async buildCriticalAlerts(asOf: Date) {
    const rows = await this.prisma.alertLog.findMany({
      where: {
        resolved: false,
        severity: { in: [AlertSeverity.CRITICAL, AlertSeverity.HIGH] },
      },
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        admission: {
          select: {
            ward: true,
            wardEntity: { select: { name: true } },
          },
        },
      },
    });

    return rows.map((r) => {
      const loc =
        r.admission.wardEntity?.name ?? r.admission.ward ?? 'Inpatient';
      return {
        id: r.id,
        location: loc,
        message: r.message,
        severity: alertSeverityApi(r.severity),
        occurredAt: r.createdAt.toISOString(),
        relativeLabel: relativeLabel(r.createdAt, asOf),
      };
    });
  }
}
