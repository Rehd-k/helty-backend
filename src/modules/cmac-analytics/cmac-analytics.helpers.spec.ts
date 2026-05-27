import {
  buildComparison,
  buildKpi,
  parseCmacPeriod,
  READMISSION_DAYS,
} from './cmac-analytics.helpers';

describe('cmac-analytics.helpers', () => {
  it('parseCmacPeriod returns current and previous windows', () => {
    const ctx = parseCmacPeriod('month', '2026-05-15T12:00:00.000Z');
    expect(ctx.period).toBe('month');
    expect(ctx.current.start.getTime()).toBeLessThan(ctx.current.end.getTime());
    expect(ctx.previous.end.getTime()).toBeLessThan(ctx.current.start.getTime());
  });

  it('buildComparison handles zero previous', () => {
    const c = buildComparison(10, 0);
    expect(c.percentChange).toBe(100);
    expect(c.direction).toBe('up');
  });

  it('buildKpi marks negative metrics correctly', () => {
    const kpi = buildKpi('x', 'Test', 5, 10, { positiveWhenUp: false });
    expect(kpi.comparison.isPositive).toBe(true);
  });

  it('READMISSION_DAYS is 30', () => {
    expect(READMISSION_DAYS).toBe(30);
  });
});
