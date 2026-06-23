import {
  MedicationAdministrationLifecycleStatus,
  MedicationScheduleStatus,
  RxDurationUnit,
} from '@prisma/client';
import {
  addDuration,
  computeNextDueAt,
  durationToMs,
  parseDuration,
  parseFrequency,
} from './rx-schedule.utils';

describe('rx-schedule.utils', () => {
  describe('parseFrequency', () => {
    it('parses BD as twice daily', () => {
      const parsed = parseFrequency('Twice daily (BD / BID)');
      expect(parsed.dosesPerDay).toBe(2);
      expect(parsed.frequencyIntervalHours).toBe(12);
      expect(parsed.isIntervalBased).toBe(false);
    });

    it('parses Q8H as interval-based', () => {
      const parsed = parseFrequency('Every 8 hours (Q8H)');
      expect(parsed.dosesPerDay).toBe(3);
      expect(parsed.frequencyIntervalHours).toBe(8);
      expect(parsed.isIntervalBased).toBe(true);
    });

    it('parses once weekly', () => {
      const parsed = parseFrequency('Once weekly');
      expect(parsed.dosesPerDay).toBeCloseTo(1 / 7);
      expect(parsed.frequencyIntervalHours).toBe(168);
    });
  });

  describe('parseDuration', () => {
    it('parses 7 days', () => {
      expect(parseDuration('7 days')).toEqual({
        durationValue: 7,
        durationUnit: RxDurationUnit.DAYS,
      });
    });

    it('parses 3 weeks case-insensitively', () => {
      expect(parseDuration('3 Weeks')).toEqual({
        durationValue: 3,
        durationUnit: RxDurationUnit.WEEKS,
      });
    });

    it('returns null for invalid duration', () => {
      expect(parseDuration('ongoing')).toBeNull();
    });
  });

  describe('computeNextDueAt', () => {
    const base = new Date('2026-06-23T08:00:00.000Z');

    it('BD: first dose 08:00 → next due 20:00', () => {
      const next = computeNextDueAt(base, parseFrequency('BD'));
      expect(next.toISOString()).toBe('2026-06-23T20:00:00.000Z');
    });

    it('Q8H: next due 8 hours after last GIVEN', () => {
      const next = computeNextDueAt(base, parseFrequency('Q8H'));
      expect(next.toISOString()).toBe('2026-06-23T16:00:00.000Z');
    });

    it('weekly: next due 7 days after last GIVEN', () => {
      const next = computeNextDueAt(base, parseFrequency('Once weekly'));
      expect(next.toISOString()).toBe('2026-06-30T08:00:00.000Z');
    });
  });

  describe('addDuration / durationToMs', () => {
    it('7-day course ends 7 days after anchor', () => {
      const start = new Date('2026-06-23T08:00:00.000Z');
      const end = addDuration(start, 7, RxDurationUnit.DAYS);
      expect(end.getTime() - start.getTime()).toBe(durationToMs(7, RxDurationUnit.DAYS));
    });
  });
});
