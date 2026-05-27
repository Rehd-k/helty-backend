import { Injectable } from '@nestjs/common';
import type { AlertItem, CmacPeriodContext, KpiMetric } from '../cmac-analytics.types';
import { CmacPatientActivityService } from './cmac-patient-activity.service';
import { CmacClinicalService } from './cmac-clinical.service';
import { CmacLaboratoryService } from './cmac-laboratory.service';
import { CmacPharmacyService } from './cmac-pharmacy.service';
import { CmacOperationsService } from './cmac-operations.service';
import { CmacQualityService } from './cmac-quality.service';
import { CmacInsightsService } from './cmac-insights.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { SafetyIncidentSeverity } from '@prisma/client';
import { inRange } from '../cmac-analytics.helpers';

@Injectable()
export class CmacOverviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly patientActivity: CmacPatientActivityService,
    private readonly clinical: CmacClinicalService,
    private readonly laboratory: CmacLaboratoryService,
    private readonly pharmacy: CmacPharmacyService,
    private readonly operations: CmacOperationsService,
    private readonly quality: CmacQualityService,
    private readonly insights: CmacInsightsService,
  ) {}

  async getOverview(ctx: CmacPeriodContext) {
    const [
      patient,
      clinicalReport,
      labReport,
      pharmReport,
      opsReport,
      qualityReport,
      insightList,
      alerts,
    ] = await Promise.all([
      this.patientActivity.getReport(ctx),
      this.clinical.getReport(ctx, 5),
      this.laboratory.getReport(ctx, 5),
      this.pharmacy.getReport(ctx, 5),
      this.operations.getReport(ctx, 5),
      this.quality.getReport(ctx),
      this.insights.generate(ctx, 5),
      this.buildAlerts(ctx),
    ]);

    const headlineKpis: KpiMetric[] = [
      patient.kpis.find((k) => k.key === 'newPatients')!,
      patient.kpis.find((k) => k.key === 'opdVisits')!,
      patient.kpis.find((k) => k.key === 'admissions')!,
      clinicalReport.kpis.find((k) => k.key === 'readmissionRate')!,
      labReport.kpis.find((k) => k.key === 'medianTatHours')!,
      opsReport.kpis.find((k) => k.key === 'noShowRate')!,
      pharmReport.kpis.find((k) => k.key === 'stockouts')!,
      qualityReport.kpis.find((k) => k.key === 'openIncidents')!,
    ].filter(Boolean);

    return {
      period: ctx.period,
      asOf: ctx.asOf.toISOString(),
      generatedAt: new Date().toISOString(),
      headlineKpis,
      alerts,
      insights: insightList,
    };
  }

  private async buildAlerts(ctx: CmacPeriodContext): Promise<AlertItem[]> {
    const range = inRange(ctx, 'current');
    const alerts: AlertItem[] = [];

    const criticalLabs = await this.prisma.labResult.count({
      where: { isCritical: true, createdAt: range },
    });
    if (criticalLabs > 0) {
      alerts.push({
        severity: 'critical',
        code: 'LAB_CRITICAL_COUNT',
        message: `${criticalLabs} critical lab result(s) in period`,
        metric: 'laboratory',
      });
    }

    const openCritical = await this.prisma.safetyIncident.count({
      where: {
        severity: SafetyIncidentSeverity.CRITICAL,
        status: { in: ['OPEN', 'INVESTIGATING'] },
      },
    });
    if (openCritical > 0) {
      alerts.push({
        severity: 'critical',
        code: 'OPEN_CRITICAL_INCIDENT',
        message: `${openCritical} open critical safety incident(s)`,
        metric: 'quality',
      });
    }

    const stockouts = await this.pharmacy.getReport(ctx, 1);
    const so = stockouts.kpis.find((k) => k.key === 'stockouts');
    if (so && so.value > 0) {
      alerts.push({
        severity: 'warning',
        code: 'PHARMACY_STOCKOUT',
        message: `${so.value} drug(s) at stockout`,
        metric: 'pharmacy',
      });
    }

    const quality = await this.quality.getReport(ctx);
    if (quality.auditFlags.length > 0) {
      alerts.push({
        severity: 'warning',
        code: 'AUDIT_FLAGS',
        message: `${quality.auditFlags.length} chart audit flag(s)`,
        metric: 'quality',
      });
    }

    return alerts;
  }
}
