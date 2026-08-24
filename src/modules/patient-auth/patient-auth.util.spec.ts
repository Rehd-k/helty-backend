import { isDeviceVerificationExempt } from './patient-auth.constants';
import { dobMatches, toCalendarDateString } from './patient-auth.util';

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
