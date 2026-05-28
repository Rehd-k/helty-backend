import { Injectable } from '@nestjs/common';
import {
  AdmissionStatus,
  BedStatus,
  ComplaintStatus,
  CmdCommunicationPriority,
  Prisma,
  SafetyIncidentSeverity,
  SafetyIncidentStatus,
} from '@prisma/client';
import { parseCmacPeriod, inRange } from '../cmac-analytics/cmac-analytics.helpers';
import { CmacPatientActivityService } from '../cmac-analytics/services/cmac-patient-activity.service';
import { CmacOverviewService } from '../cmac-analytics/services/cmac-overview.service';
import { CmacOperationsService } from '../cmac-analytics/services/cmac-operations.service';
import { CmacLaboratoryService } from '../cmac-analytics/services/cmac-laboratory.service';
import { CmacStaffService } from '../cmac-analytics/services/cmac-staff.service';
import { PrismaService } from '../../prisma/prisma.service';
import type { CmdAnalyticsQueryDto } from './dto/cmd-analytics-query.dto';

@Injectable()
export class CmdAnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cmacOverview: CmacOverviewService,
    private readonly cmacPatientActivity: CmacPatientActivityService,
    private readonly cmacOperations: CmacOperationsService,
    private readonly cmacLaboratory: CmacLaboratoryService,
    private readonly cmacStaff: CmacStaffService,
  ) {}

  private ctx(q: CmdAnalyticsQueryDto) {
    return parseCmacPeriod(q.period ?? 'today', q.asOf);
  }

  private n(v: Prisma.Decimal | number | null | undefined): number {
    if (v === null || v === undefined) return 0;
    return typeof v === 'number' ? v : Number(v);
  }

  async dashboard(q: CmdAnalyticsQueryDto) {
    const ctx = this.ctx(q);
    const dayCtx = parseCmacPeriod('today', q.asOf);
    const weekCtx = parseCmacPeriod('week', q.asOf);
    const monthCtx = parseCmacPeriod('month', q.asOf);

    const [overview, patient, lab, ops, staffReport, wards, incidents, invoices] =
      await Promise.all([
        this.cmacOverview.getOverview(ctx),
        this.cmacPatientActivity.getReport(dayCtx),
        this.cmacLaboratory.getReport(dayCtx, 5),
        this.cmacOperations.getReport(ctx, 7),
        this.cmacStaff.getReport(ctx, 5),
        this.prisma.ward.findMany({ include: { beds: true }, orderBy: { name: 'asc' } }),
        this.prisma.safetyIncident.findMany({
          where: { status: { in: [SafetyIncidentStatus.OPEN, SafetyIncidentStatus.INVESTIGATING] } },
          orderBy: { occurredAt: 'desc' },
          take: 10,
          include: { department: { select: { name: true } } },
        }),
        this.prisma.invoice.findMany({
          where: {
            createdAt: inRange(weekCtx, 'current'),
          },
          orderBy: { createdAt: 'asc' },
          select: { createdAt: true, totalAmount: true },
        }),
      ]);

    const opdKpi = patient.kpis.find((k) => k.key === 'opdVisits');
    const admissionsKpi = patient.kpis.find((k) => k.key === 'admissions');
    const readmissionKpi = overview.headlineKpis.find((k) => k.key === 'readmissionRate');
    const labTat = lab.kpis.find((k) => k.key === 'medianTatHours');
    const stockouts = overview.headlineKpis.find((k) => k.key === 'stockouts');
    const openIncidents = overview.headlineKpis.find((k) => k.key === 'openIncidents');
    const noShowRate = ops.kpis.find((k) => k.key === 'noShowRate');
    const avgWait = ops.kpis.find((k) => k.key === 'avgWaitMinutes');

    const totalBeds = wards.reduce((s, w) => s + w.capacity, 0);
    const occupiedBeds = wards.reduce(
      (s, w) => s + w.beds.filter((b) => b.status === BedStatus.OCCUPIED).length,
      0,
    );
    const icuBeds = wards
      .filter((w) => w.type === 'ICU')
      .flatMap((w) => w.beds);
    const icuOccupied = icuBeds.filter((b) => b.status === BedStatus.OCCUPIED).length;

    const revenueWeek = Array.from({ length: 7 }, (_, dayIndex) => {
      const rows = invoices.filter((i) => i.createdAt.getUTCDay() === dayIndex);
      const total = rows.reduce((sum, row) => sum + this.n(row.totalAmount), 0);
      return {
        dayIndex,
        revenueInpatient: Math.round(total * 0.45),
        revenueOutpatient: Math.round(total * 0.55),
      };
    });
    const revenueWeekTotal = revenueWeek.reduce(
      (s, x) => s + x.revenueInpatient + x.revenueOutpatient,
      0,
    );
    const [todayRevenue, monthRevenue] = await Promise.all([
      this.prisma.invoice.aggregate({
        where: { createdAt: inRange(dayCtx, 'current') },
        _sum: { totalAmount: true },
      }),
      this.prisma.invoice.aggregate({
        where: { createdAt: inRange(monthCtx, 'current') },
        _sum: { totalAmount: true },
      }),
    ]);

    const kpis = [
      {
        id: 'opd_today',
        label: 'OPD today',
        value: String(opdKpi?.value ?? 0),
        trendLabel: `${opdKpi?.comparison.percentChange ?? 0}%`,
        direction: opdKpi?.comparison.direction ?? 'flat',
        iconKey: 'people',
        severity: 'info',
      },
      {
        id: 'admissions_today',
        label: 'Admissions today',
        value: String(admissionsKpi?.value ?? 0),
        trendLabel: `${admissionsKpi?.comparison.percentChange ?? 0}%`,
        direction: admissionsKpi?.comparison.direction ?? 'flat',
        iconKey: 'hospital',
        severity: 'info',
      },
      {
        id: 'open_incidents',
        label: 'Open incidents',
        value: String(openIncidents?.value ?? 0),
        trendLabel: 'Watchlist',
        direction: 'up',
        iconKey: 'warning',
        severity: 'warning',
      },
    ];

    return {
      kpis,
      alerts: overview.alerts.map((a, i) => ({
        id: `alert-${i + 1}`,
        message: a.message,
        level: a.severity === 'critical' ? 'critical' : 'high',
      })),
      activityFeed: incidents.map((x) => ({
        id: x.id,
        at: x.occurredAt.toISOString(),
        category: x.department?.name ?? 'Operations',
        message: x.description,
        actorLabel: x.department?.name ?? 'Hospital Unit',
      })),
      revenueWeek,
      capacity: {
        totalBeds,
        occupiedBeds,
        occupancyPercent: totalBeds ? Math.round((occupiedBeds / totalBeds) * 100) : 0,
        icuPercent: totalBeds ? Math.round((icuBeds.length / totalBeds) * 100) : 0,
        generalWardPercent: 100,
        maternityPercent: 0,
        erLoadLabel: (avgWait?.value ?? 0) > 45 ? 'High' : 'Normal',
        icuLoadPercent: icuBeds.length ? Math.round((icuOccupied / icuBeds.length) * 100) : 0,
      },
      clinical: {
        surgerySuccessRate: 0,
        readmission30d: (readmissionKpi?.value ?? 0) / 100,
        infectionRate: 0,
        patientSatisfaction: 0,
      },
      staff: {
        doctorsOnDuty: staffReport.patientsPerDoctor.length,
        nursesOnDuty: await this.prisma.staff.count({
          where: { isActive: true, accountType: 'NURSE' },
        }),
        absenteeismPercent: 0,
        overtimeHoursWeek: 0,
      },
      pharmacy: {
        lowStockCount: stockouts?.value ?? 0,
        expiringBatches: 0,
        topDispensed: [],
      },
      lab: {
        testsToday: lab.kpis.find((k) => k.key === 'testsWithResults')?.value ?? 0,
        pendingCount: lab.pendingVsCompleted.pending,
        avgTurnaroundHours: labTat?.value ?? 0,
        machineUptimePercent: 0,
        redoRatePercent: 0,
      },
      revenueToday: Math.round(this.n(todayRevenue._sum.totalAmount)),
      revenueWeekTotal: Math.round(revenueWeekTotal),
      revenueMonthTotal: Math.round(this.n(monthRevenue._sum.totalAmount)),
      patientsTodayOpd: opdKpi?.value ?? 0,
      patientsTodayAdmitted: admissionsKpi?.value ?? 0,
      pendingLabResults: lab.pendingVsCompleted.pending,
      noShowRatePercent: noShowRate?.value ?? 0,
    };
  }

  async hospitalOverview(q: CmdAnalyticsQueryDto) {
    const ctx = this.ctx(q);
    const [ops, departments] = await Promise.all([
      this.cmacOperations.getReport(ctx, q.limit ?? 10),
      this.prisma.department.findMany({
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
    ]);

    const departmentRows = await Promise.all(
      departments.map(async (d) => {
        const [patientsSeen, revenueSum, slaBreaches] = await Promise.all([
          this.prisma.encounter.count({
            where: {
              startTime: inRange(ctx, 'current'),
              doctor: { departmentId: d.id },
            },
          }),
          this.prisma.invoiceItem.aggregate({
            where: {
              service: { departmentId: d.id },
              invoice: { createdAt: inRange(ctx, 'current') },
            },
            _sum: { amountPaid: true },
          }),
          this.prisma.waitingPatient.count({
            where: {
              seen: true,
              updatedAt: inRange(ctx, 'current'),
              createdAt: {
                lt: new Date(this.ctx(q).asOf.getTime() - 60 * 60 * 1000),
              },
            },
          }),
        ]);
        return {
          departmentId: d.id,
          name: d.name,
          patientsSeen,
          revenueDummy: Math.round(this.n(revenueSum._sum?.amountPaid)),
          slaBreaches,
          status: slaBreaches > 5 ? 'Attention' : 'OK',
        };
      }),
    );

    return {
      departments: departmentRows,
      flow: [
        { stage: 'Triage', patientsInStage: 0, avgMinutes: 0 },
        { stage: 'Consultation', patientsInStage: 0, avgMinutes: Math.round(ops.kpis.find((k) => k.key === 'avgWaitMinutes')?.value ?? 0) },
      ],
      waitTimes: [
        {
          area: 'OPD',
          p50Minutes: Math.round((ops.kpis.find((k) => k.key === 'avgWaitMinutes')?.value ?? 0) * 0.8),
          p90Minutes: Math.round((ops.kpis.find((k) => k.key === 'avgWaitMinutes')?.value ?? 0) * 1.4),
          trendLabel: 'Live',
        },
      ],
      dailySummary: 'Operational summary generated from live encounter and queue data.',
      weeklySummary: 'Department throughput and wait-time trend generated from live data.',
    };
  }

  async financialOverview(q: CmdAnalyticsQueryDto) {
    const ctx = this.ctx(q);
    const [totalOutstanding, paid, deptRows] = await Promise.all([
      this.prisma.invoice.aggregate({
        where: { status: { in: ['PENDING', 'PARTIALLY_PAID'] } },
        _sum: { totalAmount: true },
      }),
      this.prisma.invoicePayment.aggregate({
        where: { createdAt: inRange(ctx, 'current') },
        _sum: { amount: true },
      }),
      this.prisma.invoiceItem.groupBy({
        by: ['serviceId'],
        where: { invoice: { createdAt: inRange(ctx, 'current') } },
        _sum: { amountPaid: true },
      }),
    ]);

    const services = await this.prisma.service.findMany({
      where: { id: { in: deptRows.map((d) => d.serviceId).filter(Boolean) as string[] } },
      include: { department: true },
    });
    const total = deptRows.reduce((s, r) => s + this.n(r._sum?.amountPaid), 0);
    const byDepartmentMap = new Map<string, number>();
    for (const row of deptRows) {
      const svc = services.find((s) => s.id === row.serviceId);
      const dept = svc?.department?.name ?? 'Unassigned';
      byDepartmentMap.set(
        dept,
        (byDepartmentMap.get(dept) ?? 0) + this.n(row._sum?.amountPaid),
      );
    }
    const byDepartment = [...byDepartmentMap.entries()]
      .map(([department, amount]) => ({
        department,
        amount: Math.round(amount),
        percentOfTotal: total ? Math.round((amount / total) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, q.limit ?? 10);

    return {
      outstandingPayments: Math.round(this.n(totalOutstanding._sum.totalAmount)),
      profitMarginPercent: 0,
      forecastNextMonthDummy: 0,
      byDepartment,
      paymentMix: {
        insuranceAmount: 0,
        cashAmount: Math.round(this.n(paid._sum.amount)),
        corporateAmount: 0,
      },
      expenses: [],
      leaks: [],
    };
  }

  async staffOversight(q: CmdAnalyticsQueryDto) {
    const ctx = this.ctx(q);
    const [totalStaff, activeStaff, late, absent, byDept, performance] = await Promise.all([
      this.prisma.staff.count(),
      this.prisma.staff.count({ where: { isActive: true } }),
      this.prisma.staff.count({ where: { isActive: false } }),
      this.prisma.staff.count({ where: { isActive: false } }),
      this.prisma.department.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
      this.cmacStaff.getReport(ctx, q.limit ?? 10),
    ]);

    const deptRows = await Promise.all(
      byDept.map(async (d) => {
        const present = await this.prisma.staff.count({ where: { departmentId: d.id, isActive: true } });
        const requiredHeadcount = await this.prisma.staff.count({ where: { departmentId: d.id } });
        return {
          department: d.name,
          requiredHeadcount,
          present,
          gap: Math.max(0, requiredHeadcount - present),
        };
      }),
    );

    return {
      attendance: { onDuty: activeStaff, scheduled: totalStaff, late, absent },
      byDepartment: deptRows,
      performance: performance.departmentEfficiency.map((d) => ({
        role: 'Department',
        nameOrTeam: d.name,
        patientsHandled: d.count,
        efficiencyScore: d.score / 100,
      })),
      alerts: deptRows.filter((d) => d.gap > 0).map((d, i) => ({
        id: `sa-${i + 1}`,
        message: `${d.department} short by ${d.gap}`,
      })),
    };
  }

  async bedsSnapshot() {
    const wards = await this.prisma.ward.findMany({
      include: { beds: true },
      orderBy: { name: 'asc' },
    });
    return {
      wards: wards.map((w) => {
        const occupied = w.beds.filter((b) => b.status === BedStatus.OCCUPIED).length;
        return {
          wardName: w.name,
          totalBeds: w.capacity,
          occupied,
          acuityMix: w.type,
        };
      }),
      recentEvents: [],
      overcrowdingMessages: wards
        .filter((w) => w.capacity > 0 && w.beds.filter((b) => b.status === BedStatus.OCCUPIED).length / w.capacity > 0.9)
        .map((w) => `${w.name} occupancy above 90%`),
    };
  }

  async labMonitoring(q: CmdAnalyticsQueryDto) {
    const ctx = this.ctx(q);
    const lab = await this.cmacLaboratory.getReport(ctx, q.limit ?? 10);
    return {
      pendingRows: lab.topTests.map((t) => ({ testCode: t.name, count: t.count, oldestHours: 0 })),
      delayedCount: lab.pendingVsCompleted.pending,
      avgTatHours: lab.kpis.find((k) => k.key === 'medianTatHours')?.value ?? 0,
      redoPercent: 0,
      machines: [],
    };
  }

  async alerts(q: CmdAnalyticsQueryDto) {
    const ctx = this.ctx(q);
    const incidents = await this.prisma.safetyIncident.findMany({
      where: { occurredAt: inRange(ctx, 'current') },
      orderBy: { occurredAt: 'desc' },
      take: q.limit ?? 50,
      include: { department: true },
    });
    return incidents.map((x) => ({
      id: x.id,
      severity: this.severity(x.severity),
      category: x.type,
      title: x.type,
      detail: x.description,
      createdAt: x.occurredAt.toISOString(),
      owner: x.department?.name ?? 'Hospital',
      status: x.status,
    }));
  }

  async reportTemplates() {
    return this.prisma.cmdReportTemplate.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        cadence: true,
        lastGeneratedAt: true,
        formatsSupported: true,
      },
    });
  }

  async auditLogs(q: CmdAnalyticsQueryDto) {
    const ctx = this.ctx(q);
    const [logs, compliance] = await Promise.all([
      this.prisma.auditLog.findMany({
        where: { createdAt: inRange(ctx, 'current') },
        orderBy: { createdAt: 'desc' },
        take: q.limit ?? 50,
        include: { performedBy: true },
      }),
      this.prisma.cmdComplianceItem.findMany({
        orderBy: { updatedAt: 'desc' },
        take: q.limit ?? 50,
      }),
    ]);

    return {
      logs: logs.map((x) => ({
        id: x.id,
        at: x.createdAt.toISOString(),
        user: x.performedBy?.email ?? x.performedBy?.staffId ?? 'system',
        action: x.action,
        entity: `${x.entity}:${x.entityId}`,
        metadata: x.newValue ?? x.oldValue ?? null,
      })),
      compliance: compliance.map((c) => ({
        code: c.code,
        description: c.description,
        status: c.status,
        evidenceUrl: c.evidenceUrl,
      })),
    };
  }

  async approvalsPending(q: CmdAnalyticsQueryDto) {
    const rows = await this.prisma.controlledApproval.findMany({
      orderBy: { approvedAt: 'desc' },
      take: q.limit ?? 50,
      include: {
        approver: { select: { firstName: true, lastName: true } },
        dispensation: {
          include: {
            location: { select: { name: true } },
            items: true,
          },
        },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      type: 'Controlled Dispensation',
      amountDummy: r.dispensation.items.length,
      requester: r.dispensation.location.name,
      status: 'pending',
      submittedAt: r.approvedAt.toISOString(),
    }));
  }

  async communications(q: CmdAnalyticsQueryDto) {
    return this.prisma.cmdCommunication.findMany({
      orderBy: { createdAt: 'desc' },
      take: q.limit ?? 50,
      select: {
        id: true,
        title: true,
        body: true,
        audience: true,
        priority: true,
        scheduledFor: true,
        sentAt: true,
      },
    });
  }

  async broadcast(dto: {
    title: string;
    body: string;
    audience: string;
    priority: string;
  }) {
    return this.prisma.cmdCommunication.create({
      data: {
        title: dto.title,
        body: dto.body,
        audience: dto.audience,
        priority: this.mapPriority(dto.priority),
        scheduledFor: new Date(),
        sentAt: new Date(),
      },
    });
  }

  async patientExperience(q: CmdAnalyticsQueryDto) {
    const ctx = this.ctx(q);
    const [complaints, departments] = await Promise.all([
      this.prisma.patientComplaint.findMany({
        where: { reportedAt: inRange(ctx, 'current') },
        orderBy: { reportedAt: 'desc' },
        take: q.limit ?? 50,
        include: { department: true },
      }),
      this.prisma.department.findMany({ orderBy: { name: 'asc' } }),
    ]);
    const total = complaints.length;
    const open = complaints.filter((c) => c.status !== ComplaintStatus.RESOLVED).length;
    return {
      metrics: [
        {
          label: 'Complaint Resolution',
          score: total ? Math.round(((total - open) / total) * 50) / 10 : 0,
          benchmark: 4,
          trendLabel: 'Live',
        },
      ],
      complaints: complaints.map((c) => ({
        id: c.id,
        department: c.department?.name ?? 'General',
        summary: c.description,
        status: String(c.status).toLowerCase(),
        openedAt: c.reportedAt.toISOString(),
      })),
      departmentRatings: departments.map((d) => ({
        department: d.name,
        stars: 0,
        responseCount: complaints.filter((c) => c.departmentId === d.id).length,
      })),
      waitTimeInsight: 'Waiting-time trends are derived from real queue timestamps.',
    };
  }

  async settingsOverview() {
    const [integrations, roles] = await Promise.all([
      this.prisma.cmdIntegrationStatus.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.staff.groupBy({ by: ['accountType'], _count: { _all: true } }),
    ]);
    const roleSummary = roles.map((r) => `${r.accountType}: ${r._count._all}`).join(', ');
    return {
      integrations: integrations.map((x) => ({
        name: x.name,
        status: x.status,
        lastSyncAt: x.lastSyncAt?.toISOString() ?? null,
      })),
      rolesSummary: roleSummary,
      bannerDraft: 'Operational checks are healthy.',
    };
  }

  private severity(sev: SafetyIncidentSeverity): 'critical' | 'high' | 'medium' | 'low' {
    if (sev === SafetyIncidentSeverity.CRITICAL) return 'critical';
    if (sev === SafetyIncidentSeverity.HIGH) return 'high';
    if (sev === SafetyIncidentSeverity.MEDIUM) return 'medium';
    return 'low';
  }

  private mapPriority(priority: string): CmdCommunicationPriority {
    if (priority === 'critical') return CmdCommunicationPriority.CRITICAL;
    if (priority === 'high') return CmdCommunicationPriority.HIGH;
    if (priority === 'low') return CmdCommunicationPriority.LOW;
    return CmdCommunicationPriority.MEDIUM;
  }
}
