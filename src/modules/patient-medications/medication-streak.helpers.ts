import { PatientMedicationDoseStatus } from '@prisma/client';
import {
  getHospitalDateString,
  hospitalLocalToUtc,
} from './patient-medications.util';

/** Server-side undo window after marking taken (covers 5s client snackbar + latency). */
export const DOSE_UNMARK_GRACE_MS = 5 * 60 * 1000;

export type DayVerdict = 'perfect' | 'imperfect' | 'empty';

export type StreakSnapshot = {
  currentStreak: number;
  longestStreak: number;
  lastPerfectDate: string | null;
  shieldsRemaining: number;
  todayCompleted: boolean;
};

export function shiftHospitalDateString(dateStr: string, days: number): string {
  const start = hospitalLocalToUtc(dateStr, 12, 0);
  const shifted = new Date(start.getTime() + days * 24 * 60 * 60 * 1000);
  return getHospitalDateString(shifted);
}

export function verdictForStatuses(
  statuses: PatientMedicationDoseStatus[],
): DayVerdict {
  const actionable = statuses.filter(
    (status) => status !== PatientMedicationDoseStatus.SKIPPED,
  );
  if (actionable.length === 0) return 'empty';
  if (actionable.every((status) => status === PatientMedicationDoseStatus.TAKEN)) {
    return 'perfect';
  }
  return 'imperfect';
}

/**
 * Walk hospital days backward from `anchorDate` counting consecutive perfect days.
 * Empty days are skipped. Imperfect days in `forcedBridgeDates` always bridge;
 * additional imperfect days consume from `shieldsRemaining`.
 */
export function computeStreakFromDayMap(params: {
  dayMap: Map<string, DayVerdict>;
  anchorDate: string;
  shieldsRemaining: number;
  previousLongest: number;
  forcedBridgeDates?: Iterable<string>;
}): {
  currentStreak: number;
  longestStreak: number;
  lastPerfectDate: string | null;
  shieldsRemaining: number;
} {
  const forced = new Set(params.forcedBridgeDates ?? []);
  let streak = 0;
  let shields = params.shieldsRemaining;
  let lastPerfect: string | null = null;
  let cursor = params.anchorDate;

  for (let i = 0; i < 400; i++) {
    const verdict = params.dayMap.get(cursor) ?? 'empty';

    if (verdict === 'empty') {
      cursor = shiftHospitalDateString(cursor, -1);
      continue;
    }

    if (verdict === 'perfect') {
      streak += 1;
      if (!lastPerfect) lastPerfect = cursor;
      cursor = shiftHospitalDateString(cursor, -1);
      continue;
    }

    if (forced.has(cursor)) {
      cursor = shiftHospitalDateString(cursor, -1);
      continue;
    }

    if (shields > 0) {
      shields -= 1;
      cursor = shiftHospitalDateString(cursor, -1);
      continue;
    }
    break;
  }

  return {
    currentStreak: streak,
    longestStreak: Math.max(params.previousLongest, streak),
    lastPerfectDate: lastPerfect,
    shieldsRemaining: shields,
  };
}

/** Anchor: today if perfect; otherwise yesterday (today still in progress / empty). */
export function streakAnchorDate(
  todayKey: string,
  todayVerdict: DayVerdict,
): string {
  if (todayVerdict === 'perfect') return todayKey;
  return shiftHospitalDateString(todayKey, -1);
}

export function isWithinUnmarkGrace(
  takenAt: Date | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!takenAt) return false;
  return now.getTime() - takenAt.getTime() <= DOSE_UNMARK_GRACE_MS;
}

export function statusAfterUnmark(
  scheduledAt: Date,
  now: Date = new Date(),
): PatientMedicationDoseStatus {
  if (scheduledAt.getTime() > now.getTime() - 5 * 60 * 1000) {
    return PatientMedicationDoseStatus.UPCOMING;
  }
  return PatientMedicationDoseStatus.MISSED;
}

export function buildDayVerdictMap(
  doses: Array<{ scheduledAt: Date; status: PatientMedicationDoseStatus }>,
): Map<string, DayVerdict> {
  const byDay = new Map<string, PatientMedicationDoseStatus[]>();
  for (const dose of doses) {
    const key = getHospitalDateString(dose.scheduledAt);
    const list = byDay.get(key) ?? [];
    list.push(dose.status);
    byDay.set(key, list);
  }
  const dayMap = new Map<string, DayVerdict>();
  for (const [key, statuses] of byDay) {
    dayMap.set(key, verdictForStatuses(statuses));
  }
  return dayMap;
}
