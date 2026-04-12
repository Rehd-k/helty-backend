import {
  endOfUtcDay,
  parseAsOf,
  previousEqualWindow,
  startOfUtcDay,
  windowForTimeRange,
} from './nurses-dashboard-window.util';

describe('nurses-dashboard-window.util', () => {
  const anchor = new Date('2026-04-12T15:30:00.000Z');

  it('parseAsOf falls back to valid date when invalid string', () => {
    const d = parseAsOf('not-a-date');
    expect(d.getTime()).not.toBeNaN();
  });

  it('Today window is UTC calendar day of asOf', () => {
    const w = windowForTimeRange('Today', anchor);
    expect(w.start.toISOString()).toBe('2026-04-12T00:00:00.000Z');
    expect(w.end.toISOString()).toBe('2026-04-12T23:59:59.999Z');
  });

  it('Last 7 Days is inclusive 7 UTC days ending anchor day', () => {
    const w = windowForTimeRange('Last 7 Days', anchor);
    expect(w.start.toISOString()).toBe('2026-04-06T00:00:00.000Z');
    expect(w.end.toISOString()).toBe('2026-04-12T23:59:59.999Z');
  });

  it('This Month spans month start through anchor day (UTC)', () => {
    const w = windowForTimeRange('This Month', anchor);
    expect(w.start.toISOString()).toBe('2026-04-01T00:00:00.000Z');
    expect(w.end.toISOString()).toBe('2026-04-12T23:59:59.999Z');
  });

  it('This Year spans Jan 1 through anchor day (UTC)', () => {
    const w = windowForTimeRange('This Year', anchor);
    expect(w.start.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(w.end.toISOString()).toBe('2026-04-12T23:59:59.999Z');
  });

  it('previousEqualWindow shifts back by the same span', () => {
    const w = windowForTimeRange('Today', anchor);
    const p = previousEqualWindow(w.start, w.end);
    const span = w.end.getTime() - w.start.getTime();
    expect(p.end.getTime()).toBe(w.start.getTime() - 1);
    expect(p.end.getTime() - p.start.getTime()).toBe(span);
    expect(startOfUtcDay(p.start).toISOString()).toBe('2026-04-11T00:00:00.000Z');
    expect(endOfUtcDay(p.end).toISOString()).toBe('2026-04-11T23:59:59.999Z');
  });
});
