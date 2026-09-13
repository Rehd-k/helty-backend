import { HOSPITAL_TIMEZONE } from '../../common/utils/datetime';
import {
  CYCLE_GAP_SAMPLE_SIZE,
  DEFAULT_CYCLE_LENGTH_DAYS,
  DEFAULT_PERIOD_LENGTH_DAYS,
  MAX_CYCLE_LENGTH_DAYS,
  MAX_PERIOD_LENGTH_DAYS,
  MIN_CYCLE_LENGTH_DAYS,
  MIN_PERIOD_LENGTH_DAYS,
} from './patient-cycle.constants';

export {
  CYCLE_GAP_SAMPLE_SIZE,
  DEFAULT_CYCLE_LENGTH_DAYS,
  DEFAULT_PERIOD_LENGTH_DAYS,
  MAX_CYCLE_LENGTH_DAYS,
  MAX_PERIOD_LENGTH_DAYS,
  MIN_CYCLE_LENGTH_DAYS,
  MIN_PERIOD_LENGTH_DAYS,
};

export const DATE_KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export type DateRange = {
  start: Date;
  end: Date;
};

export type CyclePeriodInput = {
  startDate: Date;
  endDate: Date | null;
};

export type CycleStatus = {
  headline: string;
  cycleDay: number | null;
  daysUntilNext: number | null;
  nextPeriodStart: string | null;
  currentPeriodStart: string | null;
};

export function hospitalTodayKey(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: HOSPITAL_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function parseDateKey(value: string): Date {
  const match = DATE_KEY_RE.exec(value.trim());
  if (!match) {
    throw new Error(`Invalid date key: ${value}`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error(`Invalid calendar date: ${value}`);
  }
  return date;
}

export function isDateKey(value: string): boolean {
  try {
    parseDateKey(value);
    return true;
  } catch {
    return false;
  }
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function diffDays(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function monthRange(year: number, month: number): {
  start: Date;
  end: Date;
} {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0));
  return { start, end };
}

export function inclusiveEnd(period: CyclePeriodInput, openEnd: Date): Date {
  return period.endDate ?? openEnd;
}

export function periodLengthDays(start: Date, end: Date): number {
  return diffDays(start, end) + 1;
}

export function rangesOverlap(a: DateRange, b: DateRange): boolean {
  return a.start.getTime() <= b.end.getTime() &&
    b.start.getTime() <= a.end.getTime();
}

export function findOverlappingPeriod(
  candidate: DateRange,
  existing: Array<CyclePeriodInput & { id?: string }>,
  options?: { ignoreId?: string; openEnd?: Date },
): CyclePeriodInput | undefined {
  const openEnd = options?.openEnd ?? addDays(candidate.end, 3650);
  return existing.find((period) => {
    if (options?.ignoreId && period.id === options.ignoreId) {
      return false;
    }
    return rangesOverlap(candidate, {
      start: period.startDate,
      end: inclusiveEnd(period, openEnd),
    });
  });
}

export function autoCloseEndDate(openStart: Date, newStart: Date): Date {
  return addDays(newStart, -1);
}

export function canAutoCloseOpenPeriod(
  openStart: Date,
  newStart: Date,
): boolean {
  return newStart.getTime() > openStart.getTime();
}

export function averageCycleLengthDays(
  startsAscending: Date[],
  fallback = DEFAULT_CYCLE_LENGTH_DAYS,
): number {
  const clampedFallback = clamp(
    fallback,
    MIN_CYCLE_LENGTH_DAYS,
    MAX_CYCLE_LENGTH_DAYS,
  );
  if (startsAscending.length < 2) {
    return clampedFallback;
  }
  const gaps: number[] = [];
  for (let i = 1; i < startsAscending.length; i += 1) {
    gaps.push(diffDays(startsAscending[i - 1], startsAscending[i]));
  }
  const sample = gaps.slice(-CYCLE_GAP_SAMPLE_SIZE);
  const avg = Math.round(
    sample.reduce((sum, gap) => sum + gap, 0) / sample.length,
  );
  return clamp(avg, MIN_CYCLE_LENGTH_DAYS, MAX_CYCLE_LENGTH_DAYS);
}

export function predictedPeriodDays(options: {
  lastStart: Date;
  cycleLengthDays: number;
  periodLengthDays: number;
  rangeStart: Date;
  rangeEnd: Date;
  loggedRanges: DateRange[];
}): string[] {
  const cycleLength = clamp(
    options.cycleLengthDays,
    MIN_CYCLE_LENGTH_DAYS,
    MAX_CYCLE_LENGTH_DAYS,
  );
  const periodLength = clamp(
    options.periodLengthDays,
    MIN_PERIOD_LENGTH_DAYS,
    MAX_PERIOD_LENGTH_DAYS,
  );
  const days: string[] = [];
  let start = addDays(options.lastStart, cycleLength);
  let guard = 0;
  while (start.getTime() < options.rangeStart.getTime() && guard < 48) {
    start = addDays(start, cycleLength);
    guard += 1;
  }
  guard = 0;
  while (start.getTime() <= options.rangeEnd.getTime() && guard < 48) {
    for (let offset = 0; offset < periodLength; offset += 1) {
      const day = addDays(start, offset);
      if (
        day.getTime() < options.rangeStart.getTime() ||
        day.getTime() > options.rangeEnd.getTime()
      ) {
        continue;
      }
      const logged = options.loggedRanges.some(
        (range) =>
          day.getTime() >= range.start.getTime() &&
          day.getTime() <= range.end.getTime(),
      );
      if (!logged) {
        days.push(toDateKey(day));
      }
    }
    start = addDays(start, cycleLength);
    guard += 1;
  }
  return days;
}

export function buildCycleStatus(options: {
  today: Date;
  periods: CyclePeriodInput[];
  cycleLengthDays: number;
  periodLengthDays: number;
  pregnancyPaused: boolean;
}): CycleStatus {
  if (options.pregnancyPaused) {
    return {
      headline: 'Tracking paused during pregnancy',
      cycleDay: null,
      daysUntilNext: null,
      nextPeriodStart: null,
      currentPeriodStart: null,
    };
  }

  if (options.periods.length === 0) {
    return {
      headline: 'Log your last period to start tracking',
      cycleDay: null,
      daysUntilNext: null,
      nextPeriodStart: null,
      currentPeriodStart: null,
    };
  }

  const sorted = [...options.periods].sort(
    (a, b) => a.startDate.getTime() - b.startDate.getTime(),
  );
  const openEnd = options.today;
  const current = [...sorted].reverse().find((period) => {
    const end = inclusiveEnd(period, openEnd);
    return (
      options.today.getTime() >= period.startDate.getTime() &&
      options.today.getTime() <= end.getTime()
    );
  });

  if (current) {
    const cycleDay = diffDays(current.startDate, options.today) + 1;
    return {
      headline: `Period day ${cycleDay}`,
      cycleDay,
      daysUntilNext: null,
      nextPeriodStart: null,
      currentPeriodStart: toDateKey(current.startDate),
    };
  }

  const lastStart = sorted[sorted.length - 1].startDate;
  const cycleLength = averageCycleLengthDays(
    sorted.map((period) => period.startDate),
    options.cycleLengthDays,
  );
  let nextStart = addDays(lastStart, cycleLength);
  while (nextStart.getTime() < options.today.getTime()) {
    const nextNext = addDays(nextStart, cycleLength);
    if (nextNext.getTime() > options.today.getTime()) {
      break;
    }
    nextStart = nextNext;
  }
  const daysUntilNext = diffDays(options.today, nextStart);
  let headline: string;
  if (daysUntilNext === 0) {
    headline = 'Expected today';
  } else if (daysUntilNext === 1) {
    headline = 'Expected in 1 day';
  } else if (daysUntilNext > 1) {
    headline = `Expected in ${daysUntilNext} days`;
  } else if (daysUntilNext === -1) {
    headline = 'Expected 1 day ago';
  } else {
    headline = `Expected ${Math.abs(daysUntilNext)} days ago`;
  }

  return {
    headline,
    cycleDay: null,
    daysUntilNext,
    nextPeriodStart: toDateKey(nextStart),
    currentPeriodStart: null,
  };
}

export function defaultSettingsDto() {
  return {
    cycleLengthDays: DEFAULT_CYCLE_LENGTH_DAYS,
    periodLengthDays: DEFAULT_PERIOD_LENGTH_DAYS,
    isDefault: true as const,
  };
}
