import {
  getCurrentWindow,
  getPreviousWindow,
  getRevenueSeriesBuckets,
  newOverdueCreatedAtRange,
  resolvePeriodWindow,
} from './billing-analytics-period';

describe('billing-analytics-period', () => {
  const anchor = new Date('2026-03-15T14:30:00.000Z');

  it('getCurrentWindow today: start before end within ~24h', () => {
    const w = getCurrentWindow('today', anchor);
    expect(w.end.getTime()).toBeGreaterThan(w.start.getTime());
    const span = w.end.getTime() - w.start.getTime();
    expect(span).toBeGreaterThan(0);
    expect(span).toBeLessThanOrEqual(24 * 60 * 60 * 1000);
  });

  it('getPreviousWindow for month is before current month window', () => {
    const cur = getCurrentWindow('month', anchor);
    const prev = getPreviousWindow('month', anchor);
    expect(prev.end.getTime()).toBeLessThan(cur.start.getTime());
  });

  it('getRevenueSeriesBuckets today returns 6 buckets', () => {
    const b = getRevenueSeriesBuckets('today', anchor);
    expect(b).toHaveLength(6);
  });

  it('getRevenueSeriesBuckets week returns 7 buckets', () => {
    const b = getRevenueSeriesBuckets('week', anchor);
    expect(b).toHaveLength(7);
  });

  it('getRevenueSeriesBuckets month returns 4 buckets', () => {
    const b = getRevenueSeriesBuckets('month', anchor);
    expect(b).toHaveLength(4);
  });

  it('getRevenueSeriesBuckets quarter returns 3 buckets', () => {
    const b = getRevenueSeriesBuckets('quarter', anchor);
    expect(b).toHaveLength(3);
  });

  it('getRevenueSeriesBuckets year returns 6 buckets', () => {
    const b = getRevenueSeriesBuckets('year', anchor);
    expect(b).toHaveLength(6);
  });

  it('newOverdueCreatedAtRange shifts window by 30 days', () => {
    const w = getCurrentWindow('week', anchor);
    const r = newOverdueCreatedAtRange(w);
    const thirty = 30 * 24 * 60 * 60 * 1000;
    expect(r.createdAtMin.getTime()).toBe(w.start.getTime() - thirty);
    expect(r.createdAtMax.getTime()).toBe(w.end.getTime() - thirty);
  });

  it('resolvePeriodWindow custom uses exact from/to instants', () => {
    const from = '2025-12-31T23:00:00.000Z';
    const to = '2026-07-12T22:59:59.999Z';
    const w = resolvePeriodWindow('custom', anchor, { from, to });
    expect(w.start.toISOString()).toBe(from);
    expect(w.end.toISOString()).toBe(to);
  });

  it('resolvePeriodWindow custom rejects missing bounds', () => {
    expect(() =>
      resolvePeriodWindow('custom', anchor, { from: '2026-01-01' }),
    ).toThrow('from and to are required when period is custom');
  });

  it('resolvePeriodWindow custom rejects inverted range', () => {
    expect(() =>
      resolvePeriodWindow('custom', anchor, {
        from: '2026-02-01',
        to: '2026-01-01',
      }),
    ).toThrow('from must be before or equal to to');
  });
});
