/**
 * Nurse dashboard reporting windows use UTC calendar boundaries so `asOf` (ISO UTC)
 * aligns with `window.start` / `window.end` in the API contract.
 *
 * Delta baseline: the immediately previous interval with the same duration
 * (`previousEqualWindow`), except where noted in service docs.
 */

export type NurseDashboardTimeRange =
  | 'Today'
  | 'Last 7 Days'
  | 'This Month'
  | 'This Year';

export type TimeWindow = { start: Date; end: Date };

export function parseAsOf(asOf?: string): Date {
  if (!asOf) return new Date();
  const d = new Date(asOf);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

export function startOfUtcDay(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0),
  );
}

export function endOfUtcDay(d: Date): Date {
  return new Date(
    Date.UTC(
      d.getUTCFullYear(),
      d.getUTCMonth(),
      d.getUTCDate(),
      23,
      59,
      59,
      999,
    ),
  );
}

function endOfUtcMonth(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0, 23, 59, 59, 999),
  );
}

function startOfUtcMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0, 0));
}

function startOfUtcYear(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), 0, 1, 0, 0, 0, 0));
}

/** Inclusive last day of year in UTC. */
function endOfUtcYear(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), 11, 31, 23, 59, 59, 999));
}

export function windowForTimeRange(
  timeRange: NurseDashboardTimeRange,
  asOf: Date,
): TimeWindow {
  const dayStart = startOfUtcDay(asOf);
  const dayEnd = endOfUtcDay(asOf);

  switch (timeRange) {
    case 'Today':
      return { start: dayStart, end: dayEnd };
    case 'Last 7 Days': {
      const start = new Date(dayStart);
      start.setUTCDate(start.getUTCDate() - 6);
      return { start, end: dayEnd };
    }
    case 'This Month': {
      const start = startOfUtcMonth(asOf);
      const monthEnd = endOfUtcMonth(asOf);
      const end = dayEnd.getTime() > monthEnd.getTime() ? monthEnd : dayEnd;
      return { start, end };
    }
    case 'This Year': {
      const start = startOfUtcYear(asOf);
      const yearEnd = endOfUtcYear(asOf);
      const end = dayEnd.getTime() > yearEnd.getTime() ? yearEnd : dayEnd;
      return { start, end };
    }
    default:
      return { start: dayStart, end: dayEnd };
  }
}

/**
 * Previous window with the same wall-clock span as [start, end]
 * (end − start in milliseconds), ending immediately before `start`.
 */
export function previousEqualWindow(start: Date, end: Date): TimeWindow {
  const spanMs = end.getTime() - start.getTime();
  const prevEnd = new Date(start.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - spanMs);
  return { start: prevStart, end: prevEnd };
}
