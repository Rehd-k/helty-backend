import { isDeviceVerificationExempt } from './patient-auth.constants';
import { dobMatches, phoneLookupVariants, phonesMatch, toCalendarDateString } from './patient-auth.util';

describe('patient-auth.util', () => {
  it('formats calendar dates in hospital timezone', () => {
    expect(toCalendarDateString(new Date('1990-05-15T00:00:00.000Z'))).toBe(
      '1990-05-15',
    );
    expect(toCalendarDateString(new Date('2026-05-11T23:00:00.000Z'))).toBe(
      '2026-05-12',
    );
  });

  it('matches dob by calendar day', () => {
    const stored = new Date('1990-05-15T00:00:00.000Z');
    expect(dobMatches(stored, '1990-05-15')).toBe(true);
    expect(dobMatches(stored, '1990-05-16')).toBe(false);
  });

  it('matches dob stored as local midnight Lagos time', () => {
    const stored = new Date('2026-05-11T23:00:00.000Z');
    expect(dobMatches(stored, '2026-05-12')).toBe(true);
    expect(dobMatches(stored, '2026-05-11')).toBe(false);
  });
});

describe('phone lookup', () => {
  it('treats local, international, and spaced numbers as the same phone', () => {
    const variants = phoneLookupVariants('+234 803 000 0000');
    expect(variants).toEqual(
      expect.arrayContaining(['+234 803 000 0000', '2348030000000', '+2348030000000', '08030000000']),
    );
    expect(phonesMatch('08030000000', '2348030000000')).toBe(true);
    expect(phonesMatch('08030000000', '08031111111')).toBe(false);
    expect(phonesMatch(null, '08030000000')).toBe(false);
  });
});

describe('isDeviceVerificationExempt', () => {
  it('matches the QA patient ID case-insensitively', () => {
    expect(isDeviceVerificationExempt('Q4CMEZM8')).toBe(true);
    expect(isDeviceVerificationExempt('q4cmezm8')).toBe(true);
    expect(isDeviceVerificationExempt('  Q4CMEZM8  ')).toBe(true);
  });

  it('does not exempt other patients', () => {
    expect(isDeviceVerificationExempt('AB12CD34')).toBe(false);
    expect(isDeviceVerificationExempt(null)).toBe(false);
    expect(isDeviceVerificationExempt('')).toBe(false);
  });
});
