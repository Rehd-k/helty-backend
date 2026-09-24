import { PatientMedicationDoseStatus } from '@prisma/client';
import { getDoseSlotHours } from './patient-medications.util';
import { parseFrequency } from '../medication-schedule/rx-schedule.utils';

describe('medication adherence schedule helpers', () => {
  it('parses BD frequency into two daily slots', () => {
    const parsed = parseFrequency('BD');
    expect(parsed.dosesPerDay).toBe(2);
    expect(getDoseSlotHours(parsed.dosesPerDay, false, parsed.frequencyIntervalHours)).toEqual([
      8, 20,
    ]);
  });

  it('parses q8h as interval-based', () => {
    const parsed = parseFrequency('q8h');
    expect(parsed.isIntervalBased).toBe(true);
    expect(parsed.frequencyIntervalHours).toBe(8);
  });

  it('keeps Taken / Missed / Upcoming statuses distinct', () => {
    expect(PatientMedicationDoseStatus.TAKEN).not.toBe(
      PatientMedicationDoseStatus.MISSED,
    );
    expect(PatientMedicationDoseStatus.UPCOMING).toBe('UPCOMING');
  });
});
