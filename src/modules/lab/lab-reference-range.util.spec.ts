import { LabTestFieldType } from '@prisma/client';
import {
  evaluateReferenceRange,
  isValidReferenceRange,
  parseNumericResultValue,
  parseReferenceRange,
} from './lab-reference-range.util';

describe('lab-reference-range.util', () => {
  describe('parseReferenceRange', () => {
    it('parses closed intervals', () => {
      expect(parseReferenceRange('80-120')).toEqual({
        kind: 'interval',
        min: 80,
        max: 120,
      });
      expect(parseReferenceRange('80 - 120')).toEqual({
        kind: 'interval',
        min: 80,
        max: 120,
      });
      expect(parseReferenceRange('80–120')).toEqual({
        kind: 'interval',
        min: 80,
        max: 120,
      });
      expect(parseReferenceRange('1.2-3.4')).toEqual({
        kind: 'interval',
        min: 1.2,
        max: 3.4,
      });
    });

    it('parses threshold operators', () => {
      expect(parseReferenceRange('<1.2')).toEqual({ kind: 'lt', limit: 1.2 });
      expect(parseReferenceRange('< 1.2')).toEqual({ kind: 'lt', limit: 1.2 });
      expect(parseReferenceRange('<=1.2')).toEqual({ kind: 'lte', limit: 1.2 });
      expect(parseReferenceRange('≤1.2')).toEqual({ kind: 'lte', limit: 1.2 });
      expect(parseReferenceRange('>5')).toEqual({ kind: 'gt', limit: 5 });
      expect(parseReferenceRange('>=5')).toEqual({ kind: 'gte', limit: 5 });
      expect(parseReferenceRange('≥5')).toEqual({ kind: 'gte', limit: 5 });
    });

    it('returns null for invalid ranges', () => {
      expect(parseReferenceRange('')).toBeNull();
      expect(parseReferenceRange('abc')).toBeNull();
      expect(parseReferenceRange('120-80')).toBeNull();
      expect(parseReferenceRange(null)).toBeNull();
    });
  });

  describe('parseNumericResultValue', () => {
    it('reads leading number from value strings', () => {
      expect(parseNumericResultValue('130')).toBe(130);
      expect(parseNumericResultValue('1.3 mg/dL')).toBe(1.3);
      expect(parseNumericResultValue('  70 ')).toBe(70);
      expect(parseNumericResultValue('')).toBeNull();
      expect(parseNumericResultValue('negative')).toBeNull();
    });
  });

  describe('evaluateReferenceRange', () => {
    it('evaluates interval ranges', () => {
      expect(
        evaluateReferenceRange('70', '80-120', LabTestFieldType.NUMBER),
      ).toMatchObject({ inRange: false, flag: 'LOW', parsedValue: 70 });
      expect(
        evaluateReferenceRange('100', '80-120', LabTestFieldType.NUMBER),
      ).toMatchObject({ inRange: true, flag: null, parsedValue: 100 });
      expect(
        evaluateReferenceRange('130', '80-120', LabTestFieldType.NUMBER),
      ).toMatchObject({ inRange: false, flag: 'HIGH', parsedValue: 130 });
    });

    it('evaluates less-than ranges', () => {
      expect(
        evaluateReferenceRange('1.0', '<1.2', LabTestFieldType.NUMBER),
      ).toMatchObject({ inRange: true, flag: null });
      expect(
        evaluateReferenceRange('1.2', '<1.2', LabTestFieldType.NUMBER),
      ).toMatchObject({ inRange: false, flag: 'HIGH' });
      expect(
        evaluateReferenceRange('1.3', '<1.2', LabTestFieldType.NUMBER),
      ).toMatchObject({ inRange: false, flag: 'HIGH' });
    });

    it('evaluates greater-than ranges', () => {
      expect(
        evaluateReferenceRange('4', '>5', LabTestFieldType.NUMBER),
      ).toMatchObject({ inRange: false, flag: 'LOW' });
      expect(
        evaluateReferenceRange('6', '>5', LabTestFieldType.NUMBER),
      ).toMatchObject({ inRange: true, flag: null });
    });

    it('skips non-NUMBER fields and missing ranges', () => {
      expect(
        evaluateReferenceRange('130', '80-120', LabTestFieldType.TEXT),
      ).toMatchObject({ inRange: null, flag: null });
      expect(
        evaluateReferenceRange('130', null, LabTestFieldType.NUMBER),
      ).toMatchObject({ inRange: null, flag: null });
      expect(
        evaluateReferenceRange('130', 'invalid', LabTestFieldType.NUMBER),
      ).toMatchObject({ inRange: null, flag: null });
    });
  });

  describe('isValidReferenceRange', () => {
    it('accepts empty and valid ranges', () => {
      expect(isValidReferenceRange('')).toBe(true);
      expect(isValidReferenceRange(undefined)).toBe(true);
      expect(isValidReferenceRange('80-120')).toBe(true);
    });

    it('rejects invalid ranges', () => {
      expect(isValidReferenceRange('not-a-range')).toBe(false);
    });
  });
});
