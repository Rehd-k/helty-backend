import { Injectable } from '@nestjs/common';
import type { InsightItem, CmacPeriodContext } from '../cmac-analytics.types';
import { CmacClinicalService } from './cmac-clinical.service';
import { CmacLaboratoryService } from './cmac-laboratory.service';
import { CmacPharmacyService } from './cmac-pharmacy.service';
import { CmacOperationsService } from './cmac-operations.service';
import { CmacQualityService } from './cmac-quality.service';
import { CONSULTATIONS_REVIEWS_CATEGORY } from '../../frontdesk/frontdesk.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { inRange } from '../cmac-analytics.helpers';

@Injectable()
export class CmacInsightsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clinical: CmacClinicalService,
    private readonly laboratory: CmacLaboratoryService,
    private readonly pharmacy: CmacPharmacyService,
    private readonly operations: CmacOperationsService,
    private readonly quality: CmacQualityService,
  ) {}

  async generate(ctx: CmacPeriodContext, limit = 10): Promise<InsightItem[]> {
    const [
      labReport,
      opsReport,
      pharmReport,
      clinicalReport,
      qualityReport,
      frequentReturns,
      delayedServices,
    ] = await Promise.all([
      this.laboratory.getReport(ctx, 5),
      this.operations.getReport(ctx, 10),
      this.pharmacy.getReport(ctx, 5),
      this.clinical.getReport(ctx, 5),
      this.quality.getReport(ctx),
      this.frequentReturnCases(ctx),
      this.mostDelayedService(ctx),
    ]);

    const insights: InsightItem[] = [];

    if (delayedServices) {
      insights.push({
        id: 'delayed-service',
        category: 'operations',
        severity: 'warning',
        message: `Most delayed service: ${delayedServices.name} (avg ${delayedServices.hours}hrs)`,
      });
    }

    const topDept = opsReport.departmentUtilization[0];
    if (topDept) {
      insights.push({
        id: 'peak-dept-load',
        category: 'operations',
        severity: 'info',
        message: `Highest patient load department: ${topDept.name} (${topDept.count} billable services)`,
      });
    }

    const peak = [...opsReport.peakVisitingHours].sort((a, b) => b.value - a.value)[0];
    if (peak && peak.value > 0) {
      insights.push({
        id: 'peak-hours',
        category: 'operations',
        severity: 'info',
        message: `Peak visiting hour: ${peak.label} (${peak.value} encounters)`,
      });
    }

    if (frequentReturns > 0) {
      insights.push({
        id: 'frequent-returns',
        category: 'clinical',
        severity: 'warning',
        message: `Frequent return cases within 7 days: ${frequentReturns} patients`,
      });
    }

    const abxKpi = pharmReport.kpis.find((k) => k.key === 'antibioticUnits');
    if (abxKpi?.comparison.percentChange != null && abxKpi.comparison.percentChange > 15) {
      insights.push({
        id: 'antibiotic-spike',
        category: 'pharmacy',
        severity: 'critical',
        message: `Antibiotic usage up ${abxKpi.comparison.percentChange}% vs previous period`,
      });
    }

    const stockoutKpi = pharmReport.kpis.find((k) => k.key === 'stockouts');
    if (stockoutKpi && stockoutKpi.value > 0) {
      insights.push({
        id: 'stockout-risk',
        category: 'pharmacy',
        severity: 'warning',
        message: `${stockoutKpi.value} drug(s) at or below reorder level`,
      });
    }

    const tatKpi = labReport.kpis.find((k) => k.key === 'medianTatHours');
    if (tatKpi && tatKpi.value >= 12) {
      insights.push({
        id: 'lab-tat-high',
        category: 'laboratory',
        severity: 'warning',
        message: `Lab results median turnaround is ${tatKpi.value} hours`,
      });
    }

    if (clinicalReport.readmissions.current.rate > 10) {
      insights.push({
        id: 'readmission-high',
        category: 'clinical',
        severity: 'critical',
        message: `Readmission rate is ${clinicalReport.readmissions.current.rate}% this period`,
      });
    }

    if (qualityReport.auditFlags.length > 5) {
      insights.push({
        id: 'audit-flags',
        category: 'quality',
        severity: 'warning',
        message: `${qualityReport.auditFlags.length} chart audit flags need attention`,
      });
    }

    const severityOrder = { critical: 0, warning: 1, info: 2 };
    return insights
      .sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])
      .slice(0, limit);
  }

  private async frequentReturnCases(ctx: CmacPeriodContext): Promise<number> {
    const range = inRange(ctx, 'current');
    const items = await this.prisma.invoiceItem.findMany({
      where: {
        service: { category: { name: CONSULTATIONS_REVIEWS_CATEGORY } },
        invoice: { createdAt: range, status: 'PAID' },
      },
      select: {
        invoice: { select: { patientId: true, createdAt: true } },
      },
    });
    const byPatient = new Map<string, Date[]>();
    for (const i of items) {
      const pid = i.invoice.patientId;
      if (!byPatient.has(pid)) byPatient.set(pid, []);
      byPatient.get(pid)!.push(i.invoice.createdAt);
    }
    const weekMs = 7 * 24 * 60 * 60 * 1000;
    let count = 0;
    for (const dates of byPatient.values()) {
      dates.sort((a, b) => a.getTime() - b.getTime());
      for (let i = 1; i < dates.length; i++) {
        if (dates[i].getTime() - dates[i - 1].getTime() <= weekMs) {
          count += 1;
          break;
        }
      }
    }
    return count;
  }

  private async mostDelayedService(
    ctx: CmacPeriodContext,
  ): Promise<{ name: string; hours: number } | null> {
    const range = inRange(ctx, 'current');
    const labReport = await this.laboratory.getReport(ctx, 1);
    const tat = labReport.kpis.find((k) => k.key === 'medianTatHours')?.value ?? 0;

    void range;

    if (tat <= 0) return null;
    return { name: 'Lab results', hours: tat };
  }
}
