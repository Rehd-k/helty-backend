/** Analytics period presets for billing dashboards. */

export const ANALYTICS_PERIODS = [
  'today',
  'week',
  'month',
  'quarter',
  'year',
] as const;

export type AnalyticsPeriod = (typeof ANALYTICS_PERIODS)[number];

export interface DateWindow {
  start: Date;
  end: Date;
}

function cloneDate(d: Date): Date {
  return new Date(d.getTime());
}

export function startOfDay(d: Date): Date {
  const x = cloneDate(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function endOfDay(d: Date): Date {
  const x = cloneDate(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

/** Monday 00:00:00 of the ISO week containing `d` (week = Mon–Sun). */
export function startOfISOWeek(d: Date): Date {
  const x = startOfDay(d);
  const day = x.getDay(); // 0 Sun .. 6 Sat
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  return x;
}

export function endOfISOWeek(d: Date): Date {
  const s = startOfISOWeek(d);
  const e = cloneDate(s);
  e.setDate(e.getDate() + 6);
  return endOfDay(e);
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

export function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

export function startOfQuarter(d: Date): Date {
  const q = Math.floor(d.getMonth() / 3);
  return new Date(d.getFullYear(), q * 3, 1, 0, 0, 0, 0);
}

export function endOfQuarter(d: Date): Date {
  const s = startOfQuarter(d);
  return new Date(s.getFullYear(), s.getMonth() + 3, 0, 23, 59, 59, 999);
}

export function startOfYear(d: Date): Date {
  return new Date(d.getFullYear(), 0, 1, 0, 0, 0, 0);
}

export function endOfYear(d: Date): Date {
  return new Date(d.getFullYear(), 11, 31, 23, 59, 59, 999);
}

export function getCurrentWindow(
  period: AnalyticsPeriod,
  anchor: Date,
): DateWindow {
  const a = cloneDate(anchor);
  switch (period) {
    case 'today':
      return { start: startOfDay(a), end: endOfDay(a) };
    case 'week':
      return { start: startOfISOWeek(a), end: endOfISOWeek(a) };
    case 'month':
      return { start: startOfMonth(a), end: endOfMonth(a) };
    case 'quarter':
      return { start: startOfQuarter(a), end: endOfQuarter(a) };
    case 'year':
      return { start: startOfYear(a), end: endOfYear(a) };
    default:
      return { start: startOfDay(a), end: endOfDay(a) };
  }
}

export function getPreviousWindow(
  period: AnalyticsPeriod,
  anchor: Date,
): DateWindow {
  const cur = getCurrentWindow(period, anchor);
  switch (period) {
    case 'today': {
      const y = cloneDate(cur.start);
      y.setDate(y.getDate() - 1);
      return { start: startOfDay(y), end: endOfDay(y) };
    }
    case 'week': {
      const s = cloneDate(cur.start);
      s.setDate(s.getDate() - 7);
      return { start: startOfISOWeek(s), end: endOfISOWeek(s) };
    }
    case 'month': {
      const first = cloneDate(cur.start);
      first.setMonth(first.getMonth() - 1);
      return { start: startOfMonth(first), end: endOfMonth(first) };
    }
    case 'quarter': {
      const first = cloneDate(cur.start);
      first.setMonth(first.getMonth() - 3);
      return { start: startOfQuarter(first), end: endOfQuarter(first) };
    }
    case 'year': {
      const y = cur.start.getFullYear() - 1;
      return {
        start: new Date(y, 0, 1, 0, 0, 0, 0),
        end: new Date(y, 11, 31, 23, 59, 59, 999),
      };
    }
    default:
      return getPreviousWindow('today', anchor);
  }
}

export interface RevenueBucket {
  start: Date;
  end: Date;
  label: string;
}

/** X-axis buckets for the line chart within the **current** period window. */
export function getRevenueSeriesBuckets(
  period: AnalyticsPeriod,
  anchor: Date,
): RevenueBucket[] {
  const w = getCurrentWindow(period, anchor);
  const buckets: RevenueBucket[] = [];

  switch (period) {
    case 'today': {
      const dayStart = startOfDay(cloneDate(anchor));
      for (let i = 0; i < 6; i++) {
        const start = new Date(dayStart);
        start.setHours(i * 4, 0, 0, 0);
        const end = new Date(dayStart);
        end.setHours(i * 4 + 3, 59, 59, 999);
        const sh = String(i * 4).padStart(2, '0');
        const eh = String(i * 4 + 3).padStart(2, '0');
        buckets.push({
          start,
          end,
          label: `${sh}:00–${eh}:59`,
        });
      }
      return buckets;
    }
    case 'week': {
      const s = cloneDate(w.start);
      const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      for (let i = 0; i < 7; i++) {
        const day = cloneDate(s);
        day.setDate(s.getDate() + i);
        buckets.push({
          start: startOfDay(day),
          end: endOfDay(day),
          label: dayNames[i] ?? `D${i + 1}`,
        });
      }
      return buckets;
    }
    case 'month': {
      const year = w.start.getFullYear();
      const month = w.start.getMonth();
      const lastDay = new Date(year, month + 1, 0).getDate();
      const part = Math.ceil(lastDay / 4);
      for (let p = 0; p < 4; p++) {
        const fromDay = p * part + 1;
        const toDay = p === 3 ? lastDay : Math.min((p + 1) * part, lastDay);
        const start = new Date(year, month, fromDay, 0, 0, 0, 0);
        const end = new Date(year, month, toDay, 23, 59, 59, 999);
        buckets.push({
          start,
          end,
          label: `Days ${fromDay}–${toDay}`,
        });
      }
      return buckets;
    }
    case 'quarter': {
      const qs = startOfQuarter(anchor);
      for (let m = 0; m < 3; m++) {
        const monthStart = new Date(qs.getFullYear(), qs.getMonth() + m, 1);
        buckets.push({
          start: startOfMonth(monthStart),
          end: endOfMonth(monthStart),
          label: monthStart.toLocaleString('en-US', { month: 'short' }),
        });
      }
      return buckets;
    }
    case 'year': {
      const y = anchor.getFullYear();
      for (let b = 0; b < 6; b++) {
        const m0 = b * 2;
        const start = new Date(y, m0, 1, 0, 0, 0, 0);
        const end = endOfMonth(new Date(y, m0 + 1, 1));
        const l0 = start.toLocaleString('en-US', { month: 'short' });
        const l1 = new Date(y, m0 + 1, 1).toLocaleString('en-US', {
          month: 'short',
        });
        buckets.push({
          start,
          end,
          label: `${l0}–${l1}`,
        });
      }
      return buckets;
    }
    default:
      return getRevenueSeriesBuckets('today', anchor);
  }
}

/** Invoices whose first "overdue" instant falls inside [window.start, window.end]. */
export function newOverdueCreatedAtRange(window: DateWindow): {
  createdAtMin: Date;
  createdAtMax: Date;
} {
  const dayMs = 24 * 60 * 60 * 1000;
  const thirty = 30 * dayMs;
  return {
    createdAtMin: new Date(window.start.getTime() - thirty),
    createdAtMax: new Date(window.end.getTime() - thirty),
  };
}
