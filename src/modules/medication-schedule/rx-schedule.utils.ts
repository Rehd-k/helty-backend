import { RxDurationUnit } from '@prisma/client';
import { ParsedDuration, ParsedFrequency } from './medication-schedule.types';

const MS_PER_HOUR = 60 * 60 * 1000;
const MS_PER_DAY = 24 * MS_PER_HOUR;

const FREQUENCY_PATTERNS: Array<{
  test: RegExp;
  dosesPerDay: number;
  frequencyIntervalHours: number;
  isIntervalBased: boolean;
}> = [
  {
    test: /\b(once\s+daily|od\b|om\b|morning\s+only|at\s+bedtime|\bhs\b)/i,
    dosesPerDay: 1,
    frequencyIntervalHours: 24,
    isIntervalBased: false,
  },
  {
    test: /\b(twice\s+daily|\bbd\b|\bbid\b)/i,
    dosesPerDay: 2,
    frequencyIntervalHours: 12,
    isIntervalBased: false,
  },
  {
    test: /\b(three\s+times\s+daily|\btds\b|\btid\b)/i,
    dosesPerDay: 3,
    frequencyIntervalHours: 8,
    isIntervalBased: false,
  },
  {
    test: /\b(four\s+times\s+daily|\bqid\b)/i,
    dosesPerDay: 4,
    frequencyIntervalHours: 6,
    isIntervalBased: false,
  },
  {
    test: /\bfive\s+times\s+daily\b/i,
    dosesPerDay: 5,
    frequencyIntervalHours: 4.8,
    isIntervalBased: false,
  },
  {
    test: /\bq12h\b|every\s+12\s+hours?/i,
    dosesPerDay: 2,
    frequencyIntervalHours: 12,
    isIntervalBased: true,
  },
  {
    test: /\bq8h\b|every\s+8\s+hours?/i,
    dosesPerDay: 3,
    frequencyIntervalHours: 8,
    isIntervalBased: true,
  },
  {
    test: /\bq6h\b|every\s+6\s+hours?/i,
    dosesPerDay: 4,
    frequencyIntervalHours: 6,
    isIntervalBased: true,
  },
  {
    test: /\bq4h\b|every\s+4\s+hours?/i,
    dosesPerDay: 6,
    frequencyIntervalHours: 4,
    isIntervalBased: true,
  },
  {
    test: /\bonce\s+weekly\b/i,
    dosesPerDay: 1 / 7,
    frequencyIntervalHours: 168,
    isIntervalBased: false,
  },
  {
    test: /\btwice\s+weekly\b/i,
    dosesPerDay: 2 / 7,
    frequencyIntervalHours: 84,
    isIntervalBased: false,
  },
  {
    test: /\bthree\s+times\s+weekly\b/i,
    dosesPerDay: 3 / 7,
    frequencyIntervalHours: 56,
    isIntervalBased: false,
  },
  {
    test: /\bprn\b/i,
    dosesPerDay: 1,
    frequencyIntervalHours: 24,
    isIntervalBased: false,
  },
];

const DURATION_REGEX =
  /^(\d+)\s*(day|days|week|weeks|month|months|year|years|hour|hours)$/i;

const DURATION_UNIT_MAP: Record<string, RxDurationUnit> = {
  day: RxDurationUnit.DAYS,
  days: RxDurationUnit.DAYS,
  week: RxDurationUnit.WEEKS,
  weeks: RxDurationUnit.WEEKS,
  month: RxDurationUnit.MONTHS,
  months: RxDurationUnit.MONTHS,
  year: RxDurationUnit.YEARS,
  years: RxDurationUnit.YEARS,
  hour: RxDurationUnit.HOURS,
  hours: RxDurationUnit.HOURS,
};

export function parseFrequency(frequency: string | null | undefined): ParsedFrequency {
  const normalized = (frequency ?? '').trim();
  if (!normalized) {
    return { dosesPerDay: 1, frequencyIntervalHours: 24, isIntervalBased: false };
  }

  for (const pattern of FREQUENCY_PATTERNS) {
    if (pattern.test.test(normalized)) {
      return {
        dosesPerDay: pattern.dosesPerDay,
        frequencyIntervalHours: pattern.frequencyIntervalHours,
        isIntervalBased: pattern.isIntervalBased,
      };
    }
  }

  return { dosesPerDay: 1, frequencyIntervalHours: 24, isIntervalBased: false };
}

export function parseDuration(
  duration: string | null | undefined,
): ParsedDuration | null {
  const normalized = (duration ?? '').trim();
  if (!normalized) return null;

  const match = DURATION_REGEX.exec(normalized);
  if (!match) return null;

  const durationValue = Number.parseInt(match[1], 10);
  const unitKey = match[2].toLowerCase();
  const durationUnit = DURATION_UNIT_MAP[unitKey];
  if (!durationUnit || !Number.isFinite(durationValue) || durationValue <= 0) {
    return null;
  }

  return { durationValue, durationUnit };
}

export function durationToMs(
  durationValue: number,
  durationUnit: RxDurationUnit,
): number {
  switch (durationUnit) {
    case RxDurationUnit.HOURS:
      return durationValue * MS_PER_HOUR;
    case RxDurationUnit.DAYS:
      return durationValue * MS_PER_DAY;
    case RxDurationUnit.WEEKS:
      return durationValue * 7 * MS_PER_DAY;
    case RxDurationUnit.MONTHS:
      return durationValue * 30 * MS_PER_DAY;
    case RxDurationUnit.YEARS:
      return durationValue * 365 * MS_PER_DAY;
    default:
      return durationValue * MS_PER_DAY;
  }
}

export function addDuration(
  start: Date,
  durationValue: number,
  durationUnit: RxDurationUnit,
): Date {
  return new Date(start.getTime() + durationToMs(durationValue, durationUnit));
}

export function computeNextDueAt(
  lastGivenAt: Date,
  frequency: ParsedFrequency,
): Date {
  if (frequency.isIntervalBased) {
    return new Date(
      lastGivenAt.getTime() + frequency.frequencyIntervalHours * MS_PER_HOUR,
    );
  }

  if (frequency.dosesPerDay >= 1) {
    const intervalHours = 24 / frequency.dosesPerDay;
    return new Date(lastGivenAt.getTime() + intervalHours * MS_PER_HOUR);
  }

  if (frequency.dosesPerDay > 0 && frequency.dosesPerDay < 1) {
    const intervalDays = 7 / (frequency.dosesPerDay * 7);
    return new Date(lastGivenAt.getTime() + intervalDays * MS_PER_DAY);
  }

  return new Date(lastGivenAt.getTime() + MS_PER_DAY);
}
