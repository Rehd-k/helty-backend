import { compareMetrics } from '../billing-analytics/billing-analytics-math';
import {
  type AnalyticsPeriod,
  getCurrentWindow,
  getPreviousWindow,
  getRevenueSeriesBuckets,
} from '../billing-analytics/billing-analytics-period';
import type { KpiComparison, KpiMetric, SeriesPoint } from './cmac-analytics.types';
import type { CmacPeriodContext } from './cmac-analytics.types';

export function parseCmacPeriod(
  period: AnalyticsPeriod,
  asOf?: string,
): CmacPeriodContext {
  const anchor = asOf ? new Date(asOf) : new Date();
  const safe = Number.isNaN(anchor.getTime()) ? new Date() : anchor;
  return {
    period,
    asOf: safe,
    current: getCurrentWindow(period, safe),
    previous: getPreviousWindow(period, safe),
  };
}

export function buildComparison(
  current: number,
  previous: number,
  positiveWhenUp = true,
): KpiComparison {
  const cmp = compareMetrics(current, previous);
  let isPositive = cmp.direction === 'flat';
  if (cmp.direction === 'up') isPositive = positiveWhenUp;
  if (cmp.direction === 'down') isPositive = !positiveWhenUp;
  return {
    current,
    previous,
    percentChange: cmp.percentChange,
    direction: cmp.direction,
    isPositive,
  };
}

export function buildKpi(
  key: string,
  label: string,
  current: number,
  previous: number,
  opts?: { unit?: string; positiveWhenUp?: boolean },
): KpiMetric {
  return {
    key,
    label,
    value: current,
    unit: opts?.unit,
    comparison: buildComparison(current, previous, opts?.positiveWhenUp ?? true),
  };
}

export function seriesForPeriod(
  period: AnalyticsPeriod,
  anchor: Date,
  values: number[],
): SeriesPoint[] {
  const buckets = getRevenueSeriesBuckets(period, anchor);
  return buckets.map((b, i) => ({
    label: b.label,
    value: values[i] ?? 0,
    start: b.start.toISOString(),
    end: b.end.toISOString(),
  }));
}

export function inRange(
  ctx: CmacPeriodContext,
  which: 'current' | 'previous',
): { gte: Date; lte: Date } {
  const w = which === 'current' ? ctx.current : ctx.previous;
  return { gte: w.start, lte: w.end };
}

export const READMISSION_DAYS = 30;

export const ANTIBIOTIC_ATC_PREFIX = 'J01';
