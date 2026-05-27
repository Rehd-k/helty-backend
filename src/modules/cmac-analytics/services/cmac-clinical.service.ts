import { Injectable } from '@nestjs/common';
import { AdmissionStatus } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import type { CmacPeriodContext, NamedCount } from '../cmac-analytics.types';
import { READMISSION_DAYS, buildKpi, inRange } from '../cmac-analytics.helpers';

@Injectable()
export class CmacClinicalService {
  constructor(private readonly prisma: PrismaService) {}

  async getReport(ctx: CmacPeriodContext, limit = 10) {
    const [
      topDiagnoses,
      outcomesCur,
      outcomesPrev,
      readmitCur,
      readmitPrev,
      alosCur,
      alosPrev,
    ] = await Promise.all([
      this.topDiagnoses(ctx, limit),
      this.outcomeBreakdown(ctx, 'current'),
      this.outcomeBreakdown(ctx, 'previous'),
      this.readmissionRate(ctx, 'current'),
      this.readmissionRate(ctx, 'previous'),
      this.averageLosDays(ctx, 'current'),
      this.averageLosDays(ctx, 'previous'),
    ]);

    return {
      period: ctx.period,
      asOf: ctx.asOf.toISOString(),
      kpis: [
        buildKpi(
          'readmissionRate',
          'Readmission rate (%)',
          readmitCur.rate,
          readmitPrev.rate,
          { unit: '%', positiveWhenUp: false },
        ),
        buildKpi(
          'averageLos',
          'Average length of stay (days)',
          alosCur,
          alosPrev,
          { unit: 'days' },
        ),
      ],
      topDiagnoses,
      treatmentOutcomes: {
        current: outcomesCur,
        previous: outcomesPrev,
      },
      readmissions: {
        current: readmitCur,
        previous: readmitPrev,
      },
    };
  }

  private async topDiagnoses(
    ctx: CmacPeriodContext,
    limit: number,
  ): Promise<NamedCount[]> {
    const rows = await this.prisma.encounterDiagnosis.groupBy({
      by: ['primaryIcdCode'],
      where: {
        primaryIcdCode: { not: null },
        encounter: { endTime: inRange(ctx, 'current') },
      },
      _count: { _all: true },
      orderBy: { _count: { primaryIcdCode: 'desc' } },
      take: limit,
    });
    const codes = rows
      .map((r) => r.primaryIcdCode)
      .filter((c): c is string => !!c);
    const icd = await this.prisma.icd10Code.findMany({
      where: { code: { in: codes } },
      select: { code: true, description: true },
    });
    const desc = new Map(icd.map((c) => [c.code, c.description]));
    return rows.map((r) => ({
      name: r.primaryIcdCode
        ? `${r.primaryIcdCode} — ${desc.get(r.primaryIcdCode) ?? 'Unknown'}`
        : 'Unknown',
      count: r._count._all,
    }));
  }

  private async outcomeBreakdown(
    ctx: CmacPeriodContext,
    which: 'current' | 'previous',
  ): Promise<NamedCount[]> {
    const rows = await this.prisma.admission.groupBy({
      by: ['outcome'],
      where: {
        status: AdmissionStatus.DISCHARGED,
        dischargeDateTime: inRange(ctx, which),
        outcome: { not: null },
      },
      _count: { _all: true },
    });
    return rows.map((r) => ({
      name: r.outcome ?? 'Unknown',
      count: r._count._all,
    }));
  }

  private async readmissionRate(
    ctx: CmacPeriodContext,
    which: 'current' | 'previous',
  ) {
    const discharges = await this.prisma.admission.findMany({
      where: {
        status: AdmissionStatus.DISCHARGED,
        dischargeDateTime: inRange(ctx, which),
      },
      select: { patientId: true, dischargeDateTime: true },
    });
    if (discharges.length === 0) {
      return { totalDischarges: 0, readmissions: 0, rate: 0 };
    }
    let readmissions = 0;
    const ms = READMISSION_DAYS * 24 * 60 * 60 * 1000;
    for (const d of discharges) {
      if (!d.dischargeDateTime) continue;
      const until = new Date(d.dischargeDateTime.getTime() + ms);
      const next = await this.prisma.admission.findFirst({
        where: {
          patientId: d.patientId,
          admissionDateTime: {
            gt: d.dischargeDateTime,
            lte: until,
          },
        },
      });
      if (next) readmissions += 1;
    }
    const rate =
      Math.round((readmissions / discharges.length) * 10000) / 100;
    return {
      totalDischarges: discharges.length,
      readmissions,
      rate,
    };
  }

  private async averageLosDays(
    ctx: CmacPeriodContext,
    which: 'current' | 'previous',
  ): Promise<number> {
    const rows = await this.prisma.admission.findMany({
      where: {
        status: AdmissionStatus.DISCHARGED,
        dischargeDateTime: inRange(ctx, which),
        admissionDateTime: { not: undefined },
      },
      select: { admissionDateTime: true, dischargeDateTime: true },
    });
    if (rows.length === 0) return 0;
    const dayMs = 24 * 60 * 60 * 1000;
    const total = rows.reduce((sum, r) => {
      if (!r.dischargeDateTime) return sum;
      const d =
        (r.dischargeDateTime.getTime() - r.admissionDateTime.getTime()) / dayMs;
      return sum + Math.max(0, d);
    }, 0);
    return Math.round((total / rows.length) * 10) / 10;
  }
}
