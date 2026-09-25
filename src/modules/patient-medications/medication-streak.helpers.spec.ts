import { PatientMedicationDoseStatus } from '@prisma/client';
import {
  buildDayVerdictMap,
  computeStreakFromDayMap,
  isWithinUnmarkGrace,
  shiftHospitalDateString,
  statusAfterUnmark,
  streakAnchorDate,
  verdictForStatuses,
} from './medication-streak.helpers';

describe('medication streak helpers', () => {
  it('verdicts perfect / imperfect / empty', () => {
    expect(verdictForStatuses([PatientMedicationDoseStatus.TAKEN])).toBe(
      'perfect',
    );
    expect(
      verdictForStatuses([
        PatientMedicationDoseStatus.TAKEN,
        PatientMedicationDoseStatus.MISSED,
      ]),
    ).toBe('imperfect');
    expect(verdictForStatuses([PatientMedicationDoseStatus.SKIPPED])).toBe(
      'empty',
    );
  });

  it('counts consecutive perfect days and bridges one imperfect with a shield', () => {
    const dayMap = new Map([
      ['2026-09-25', 'perfect' as const],
      ['2026-09-24', 'imperfect' as const],
      ['2026-09-23', 'perfect' as const],
      ['2026-09-22', 'perfect' as const],
    ]);

    const withShield = computeStreakFromDayMap({
      dayMap,
      anchorDate: '2026-09-25',
      shieldsRemaining: 1,
      previousLongest: 0,
    });
    expect(withShield.currentStreak).toBe(3);
    expect(withShield.shieldsRemaining).toBe(0);

    const without = computeStreakFromDayMap({
      dayMap,
      anchorDate: '2026-09-25',
      shieldsRemaining: 0,
      previousLongest: 0,
    });
    expect(without.currentStreak).toBe(1);
  });

  it('respects forced bridge dates without consuming inventory', () => {
    const dayMap = new Map([
      ['2026-09-25', 'perfect' as const],
      ['2026-09-24', 'imperfect' as const],
      ['2026-09-23', 'perfect' as const],
    ]);
    const result = computeStreakFromDayMap({
      dayMap,
      anchorDate: '2026-09-25',
      shieldsRemaining: 0,
      previousLongest: 5,
      forcedBridgeDates: ['2026-09-24'],
    });
    expect(result.currentStreak).toBe(2);
    expect(result.shieldsRemaining).toBe(0);
    expect(result.longestStreak).toBe(5);
  });

  it('anchors on yesterday when today is incomplete', () => {
    expect(streakAnchorDate('2026-09-25', 'imperfect')).toBe('2026-09-24');
    expect(streakAnchorDate('2026-09-25', 'perfect')).toBe('2026-09-25');
  });

  it('builds day map from dose rows', () => {
    const map = buildDayVerdictMap([
      {
        scheduledAt: new Date('2026-09-25T08:00:00.000+01:00'),
        status: PatientMedicationDoseStatus.TAKEN,
      },
      {
        scheduledAt: new Date('2026-09-25T20:00:00.000+01:00'),
        status: PatientMedicationDoseStatus.UPCOMING,
      },
    ]);
    expect(map.get('2026-09-25')).toBe('imperfect');
  });

  it('enforces unmark grace and status after unmark', () => {
    const now = new Date('2026-09-25T12:00:00.000Z');
    expect(
      isWithinUnmarkGrace(new Date('2026-09-25T11:59:00.000Z'), now),
    ).toBe(true);
    expect(
      isWithinUnmarkGrace(new Date('2026-09-25T11:50:00.000Z'), now),
    ).toBe(false);

    expect(
      statusAfterUnmark(new Date('2026-09-25T12:10:00.000Z'), now),
    ).toBe(PatientMedicationDoseStatus.UPCOMING);
    expect(
      statusAfterUnmark(new Date('2026-09-25T10:00:00.000Z'), now),
    ).toBe(PatientMedicationDoseStatus.MISSED);
  });

  it('shifts hospital date strings', () => {
    expect(shiftHospitalDateString('2026-09-25', -1)).toBe('2026-09-24');
  });
});
