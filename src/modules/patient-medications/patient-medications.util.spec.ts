import { MedicationTimeOfDay } from '@prisma/client';
import {
  computeSupplyMetrics,
  deriveTimeOfDay,
  getDoseSlotHours,
  getHospitalDateString,
  hospitalLocalToUtc,
} from './patient-medications.util';
import { PrescriptionSupplyStatus } from './dto/medication-response.dto';

describe('patient-medications.util', () => {
  describe('deriveTimeOfDay', () => {
    it('returns MORNING for 05:00–11:59 hospital local', () => {
      const at8am = hospitalLocalToUtc('2026-06-28', 8);
      expect(deriveTimeOfDay(at8am)).toBe(MedicationTimeOfDay.MORNING);
    });

    it('returns AFTERNOON for 12:00–16:59 hospital local', () => {
      const at2pm = hospitalLocalToUtc('2026-06-28', 14);
      expect(deriveTimeOfDay(at2pm)).toBe(MedicationTimeOfDay.AFTERNOON);
    });

    it('returns EVENING for 17:00–04:59 hospital local', () => {
      const at8pm = hospitalLocalToUtc('2026-06-28', 20);
      expect(deriveTimeOfDay(at8pm)).toBe(MedicationTimeOfDay.EVENING);
    });
  });

  describe('getDoseSlotHours', () => {
    it('returns standard slots for common daily counts', () => {
      expect(getDoseSlotHours(1, false, 24)).toEqual([8]);
      expect(getDoseSlotHours(2, false, 12)).toEqual([8, 20]);
      expect(getDoseSlotHours(3, false, 8)).toEqual([8, 14, 20]);
      expect(getDoseSlotHours(4, false, 6)).toEqual([8, 12, 16, 20]);
    });

    it('returns interval-based slots anchored at 08:00', () => {
      expect(getDoseSlotHours(3, true, 8)).toEqual([8, 16]);
    });
  });

  describe('computeSupplyMetrics', () => {
    const now = new Date('2026-06-28T12:00:00.000Z');

    it('computes HEALTHY supply when plenty of units remain', () => {
      const result = computeSupplyMetrics(
        {
          id: 'rx-1',
          endDate: new Date('2026-12-31T00:00:00.000Z'),
          refillsAllowed: 3,
          items: [
            {
              id: 'item-1',
              dosage: '10mg',
              frequency: 'twice daily',
              instructions: null,
              quantityDispensed: 60,
              drug: { brandName: 'Lisinopril', genericName: null, strength: '10mg' },
              doseLogs: [{ id: 'd1' }],
            },
          ],
        },
        now,
      );

      expect(result.daysRemaining).toBe(29);
      expect(result.supplyProgress).toBeCloseTo(1 / 60);
      expect(result.supplyStatus).toBe(PrescriptionSupplyStatus.HEALTHY);
    });

    it('returns LOW when daysRemaining is 7 or less', () => {
      const result = computeSupplyMetrics(
        {
          id: 'rx-2',
          endDate: new Date('2026-12-31T00:00:00.000Z'),
          refillsAllowed: 0,
          items: [
            {
              id: 'item-2',
              dosage: '500mg',
              frequency: 'once daily',
              instructions: null,
              quantityDispensed: 10,
              drug: { brandName: 'Metformin', genericName: null, strength: '500mg' },
              doseLogs: Array.from({ length: 3 }, (_, i) => ({ id: `d${i}` })),
            },
          ],
        },
        now,
      );

      expect(result.daysRemaining).toBe(7);
      expect(result.supplyStatus).toBe(PrescriptionSupplyStatus.LOW);
    });

    it('returns EXPIRED when endDate is in the past', () => {
      const result = computeSupplyMetrics(
        {
          id: 'rx-3',
          endDate: new Date('2026-01-01T00:00:00.000Z'),
          refillsAllowed: 0,
          items: [
            {
              id: 'item-3',
              dosage: '20mg',
              frequency: 'once daily',
              instructions: null,
              quantityDispensed: 30,
              drug: { brandName: 'Atorvastatin', genericName: null, strength: '20mg' },
              doseLogs: [],
            },
          ],
        },
        now,
      );

      expect(result.supplyStatus).toBe(PrescriptionSupplyStatus.EXPIRED);
    });
  });

  describe('hospitalLocalToUtc', () => {
    it('builds ISO timestamps for Lagos offset', () => {
      const date = hospitalLocalToUtc('2026-06-28', 10);
      expect(getHospitalDateString(date)).toBe('2026-06-28');
      expect(deriveTimeOfDay(date)).toBe(MedicationTimeOfDay.MORNING);
    });
  });
});
