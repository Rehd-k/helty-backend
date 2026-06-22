import { formatPatientDisplayName } from './patient-display-name.util';

describe('formatPatientDisplayName', () => {
  it('includes otherName between firstName and surname', () => {
    expect(
      formatPatientDisplayName({
        firstName: 'John',
        otherName: 'Michael',
        surname: 'Doe',
      }),
    ).toBe('John Michael Doe');
  });

  it('includes title when present', () => {
    expect(
      formatPatientDisplayName({
        title: 'Mr',
        firstName: 'Jane',
        otherName: 'Ann',
        surname: 'Smith',
      }),
    ).toBe('Mr Jane Ann Smith');
  });

  it('returns Unknown when all parts are empty', () => {
    expect(formatPatientDisplayName({})).toBe('Unknown');
  });
});
