import { Injectable } from '@nestjs/common';
import {
  AdmissionStatus,
  EncounterStatus,
  EncounterType,
  SafetyIncidentSeverity,
} from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import type {
  AuditFlagItem,
  CmacPeriodContext,
  NamedCount,
} from '../cmac-analytics.types';
import { buildKpi, inRange } from '../cmac-analytics.helpers';

const AUDIT_LIMIT = 50;

@Injectable()
export class CmacQualityService {
  constructor(private readonly prisma: PrismaService) {}

  async getReport(ctx: CmacPeriodContext) {
    const range = inRange(ctx, 'current');
    const admissionsInPeriod = await this.prisma.admission.count({
      where: { admissionDateTime: range },
    });

    const [
      openIncidents,
      criticalIncidents,
      infectionCases,
      openComplaints,
      incidentsByType,
      complaintsByCategory,
    ] = await Promise.all([
      this.prisma.safetyIncident.count({
        where: { status: { in: ['OPEN', 'INVESTIGATING'] }, occurredAt: range },
      }),
      this.prisma.safetyIncident.count({
        where: {
          severity: SafetyIncidentSeverity.CRITICAL,
          occurredAt: range,
        },
      }),
      this.prisma.infectionCase.count({ where: { onsetDate: range } }),
      this.prisma.patientComplaint.count({
        where: { status: { in: ['OPEN', 'INVESTIGATING'] }, reportedAt: range },
      }),
      this.incidentsByType(range),
      this.complaintsByCategory(range),
    ]);

    const infectionRate =
      admissionsInPeriod > 0
        ? Math.round((infectionCases / admissionsInPeriod) * 10000) / 100
        : 0;

    const auditFlags = await this.buildAuditFlags(range);

    return {
      period: ctx.period,
      asOf: ctx.asOf.toISOString(),
      kpis: [
        buildKpi('openIncidents', 'Open safety incidents', openIncidents, openIncidents, {
          positiveWhenUp: false,
        }),
        buildKpi(
          'infectionRate',
          'Infection cases per 100 admissions',
          infectionRate,
          infectionRate,
          { unit: 'per 100', positiveWhenUp: false },
        ),
        buildKpi('openComplaints', 'Open complaints', openComplaints, openComplaints, {
          positiveWhenUp: false,
        }),
        buildKpi(
          'auditFlags',
          'Chart audit flags',
          auditFlags.length,
          auditFlags.length,
          { positiveWhenUp: false },
        ),
      ],
      criticalIncidents,
      incidentsByType,
      complaintsByCategory,
      auditFlags,
    };
  }

  private async incidentsByType(range: {
    gte: Date;
    lte: Date;
  }): Promise<NamedCount[]> {
    const rows = await this.prisma.safetyIncident.groupBy({
      by: ['type'],
      where: { occurredAt: range },
      _count: { _all: true },
    });
    return rows.map((r) => ({ name: r.type, count: r._count._all }));
  }

  private async complaintsByCategory(range: {
    gte: Date;
    lte: Date;
  }): Promise<NamedCount[]> {
    const rows = await this.prisma.patientComplaint.groupBy({
      by: ['category'],
      where: { reportedAt: range },
      _count: { _all: true },
    });
    return rows.map((r) => ({ name: r.category, count: r._count._all }));
  }

  private async buildAuditFlags(range: {
    gte: Date;
    lte: Date;
  }): Promise<AuditFlagItem[]> {
    const flags: AuditFlagItem[] = [];

    const encountersNoDx = await this.prisma.encounter.findMany({
      where: {
        encounterType: EncounterType.OUTPATIENT,
        status: EncounterStatus.COMPLETED,
        endTime: range,
        diagnoses: { none: {} },
      },
      select: { id: true, patientId: true },
      take: AUDIT_LIMIT,
    });
    for (const e of encountersNoDx) {
      flags.push({
        entityType: 'Encounter',
        entityId: e.id,
        patientId: e.patientId,
        rule: 'MISSING_DIAGNOSIS',
        severity: 'warning',
      });
    }

    const admissionsNoSummary = await this.prisma.admission.findMany({
      where: {
        status: AdmissionStatus.DISCHARGED,
        dischargeDateTime: range,
        OR: [{ dischargeSummary: null }, { dischargeSummary: '' }],
      },
      select: { id: true, patientId: true },
      take: Math.max(0, AUDIT_LIMIT - flags.length),
    });
    for (const a of admissionsNoSummary) {
      flags.push({
        entityType: 'Admission',
        entityId: a.id,
        patientId: a.patientId,
        rule: 'MISSING_DISCHARGE_SUMMARY',
        severity: 'warning',
      });
    }

    return flags.slice(0, AUDIT_LIMIT);
  }
}
