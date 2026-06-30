import { dobMatches, toCalendarDateString } from './patient-auth.util';

describe('patient-auth.util', () => {
  it('formats calendar dates in UTC', () => {
    expect(toCalendarDateString(new Date('1990-05-15T00:00:00.000Z'))).toBe(
      '1990-05-15',
    );
  });

  it('matches dob by calendar day', () => {
    const stored = new Date('1990-05-15T00:00:00.000Z');
    expect(dobMatches(stored, '1990-05-15')).toBe(true);
    expect(dobMatches(stored, '1990-05-16')).toBe(false);
  });
});
