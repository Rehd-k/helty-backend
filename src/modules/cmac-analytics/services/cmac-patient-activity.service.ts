import { Injectable } from '@nestjs/common';
import { ReferralDirection } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { CONSULTATIONS_REVIEWS_CATEGORY } from '../../frontdesk/frontdesk.service';
import type { CmacPeriodContext } from '../cmac-analytics.types';
import { buildKpi, inRange, seriesForPeriod } from '../cmac-analytics.helpers';
import {
  getRevenueSeriesBuckets,
  type AnalyticsPeriod,
} from '../../billing-analytics/billing-analytics-period';

@Injectable()
export class CmacPatientActivityService {
  constructor(private readonly prisma: PrismaService) {}

  async getReport(ctx: CmacPeriodContext) {
    const [
      totalPatients,
      newPatientsCur,
      newPatientsPrev,
      opdCur,
      opdPrev,
      admissionsCur,
      admissionsPrev,
      dischargesCur,
      dischargesPrev,
      refInCur,
      refInPrev,
      refOutCur,
      refOutPrev,
      newPatientsSeries,
      referralsSeries,
    ] = await Promise.all([
      this.prisma.patient.count(),
      this.countNewPatients(ctx, 'current'),
      this.countNewPatients(ctx, 'previous'),
      this.countOpdVisits(ctx, 'current'),
      this.countOpdVisits(ctx, 'previous'),
      this.countAdmissions(ctx, 'current'),
      this.countAdmissions(ctx, 'previous'),
      this.countDischarges(ctx, 'current'),
      this.countDischarges(ctx, 'previous'),
      this.countReferrals(ctx, 'current', ReferralDirection.IN),
      this.countReferrals(ctx, 'previous', ReferralDirection.IN),
      this.countReferrals(ctx, 'current', ReferralDirection.OUT),
      this.countReferrals(ctx, 'previous', ReferralDirection.OUT),
      this.newPatientsBucketSeries(ctx),
      this.referralsBucketSeries(ctx),
    ]);

    return {
      period: ctx.period,
      asOf: ctx.asOf.toISOString(),
      kpis: [
        buildKpi('totalPatients', 'Total patients registered', totalPatients, totalPatients),
        buildKpi('newPatients', 'New patients', newPatientsCur, newPatientsPrev),
        buildKpi('opdVisits', 'Outpatient visits (paid consultation)', opdCur, opdPrev),
        buildKpi('admissions', 'Admissions', admissionsCur, admissionsPrev),
        buildKpi('discharges', 'Discharges', dischargesCur, dischargesPrev),
        buildKpi('referralsIn', 'Referrals in', refInCur, refInPrev),
        buildKpi('referralsOut', 'Referrals out', refOutCur, refOutPrev),
      ],
      series: {
        newPatients: newPatientsSeries,
        referralsIn: referralsSeries.in,
        referralsOut: referralsSeries.out,
      },
    };
  }

  private async countNewPatients(
    ctx: CmacPeriodContext,
    which: 'current' | 'previous',
  ) {
    return this.prisma.patient.count({
      where: { createdAt: inRange(ctx, which) },
    });
  }

  private async countOpdVisits(
    ctx: CmacPeriodContext,
    which: 'current' | 'previous',
  ) {
    const range = inRange(ctx, which);
    const items = await this.prisma.invoiceItem.findMany({
      where: {
        service: { category: { name: CONSULTATIONS_REVIEWS_CATEGORY } },
        invoice: { createdAt: range, status: 'PAID' },
      },
      select: { invoice: { select: { patientId: true } } },
    });
    return new Set(items.map((i) => i.invoice.patientId)).size;
  }

  private async countAdmissions(
    ctx: CmacPeriodContext,
    which: 'current' | 'previous',
  ) {
    return this.prisma.admission.count({
      where: { admissionDateTime: inRange(ctx, which) },
    });
  }

  private async countDischarges(
    ctx: CmacPeriodContext,
    which: 'current' | 'previous',
  ) {
    return this.prisma.admission.count({
      where: {
        dischargeDateTime: inRange(ctx, which),
        status: 'DISCHARGED',
      },
    });
  }

  private async countReferrals(
    ctx: CmacPeriodContext,
    which: 'current' | 'previous',
    direction: ReferralDirection,
  ) {
    return this.prisma.referral.count({
      where: { direction, occurredAt: inRange(ctx, which) },
    });
  }

  private async newPatientsBucketSeries(ctx: CmacPeriodContext) {
    const buckets = await this.bucketCounts(
      ctx.period as AnalyticsPeriod,
      ctx.asOf,
      async (start, end) =>
        this.prisma.patient.count({
          where: { createdAt: { gte: start, lte: end } },
        }),
    );
    return seriesForPeriod(ctx.period as AnalyticsPeriod, ctx.asOf, buckets);
  }

  private async referralsBucketSeries(ctx: CmacPeriodContext) {
    const buckets = getRevenueSeriesBuckets(ctx.period as AnalyticsPeriod, ctx.asOf);
    const inVals: number[] = [];
    const outVals: number[] = [];
    for (const b of buckets) {
      const [i, o] = await Promise.all([
        this.prisma.referral.count({
          where: {
            direction: ReferralDirection.IN,
            occurredAt: { gte: b.start, lte: b.end },
          },
        }),
        this.prisma.referral.count({
          where: {
            direction: ReferralDirection.OUT,
            occurredAt: { gte: b.start, lte: b.end },
          },
        }),
      ]);
      inVals.push(i);
      outVals.push(o);
    }
    return {
      in: seriesForPeriod(ctx.period as AnalyticsPeriod, ctx.asOf, inVals),
      out: seriesForPeriod(ctx.period as AnalyticsPeriod, ctx.asOf, outVals),
    };
  }

  private async bucketCounts(
    period: AnalyticsPeriod,
    anchor: Date,
    fn: (start: Date, end: Date) => Promise<number>,
  ) {
    const buckets = getRevenueSeriesBuckets(period, anchor);
    return Promise.all(buckets.map((b) => fn(b.start, b.end)));
  }
}
