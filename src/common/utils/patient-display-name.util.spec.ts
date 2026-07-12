import {
  formatPatientDisplayName,
  toPatientNameDto,
  toPatientNameWithLegacyKey,
} from './patient-display-name.util';

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

describe('toPatientNameDto', () => {
  it('maps all fields and computes displayName', () => {
    expect(
      toPatientNameDto({
        title: 'Dr',
        firstName: 'Ada',
        otherName: 'Grace',
        surname: 'Okafor',
      }),
    ).toEqual({
      title: 'Dr',
      firstName: 'Ada',
      otherName: 'Grace',
      surname: 'Okafor',
      displayName: 'Dr Ada Grace Okafor',
      avatarUrl: null,
    });
  });

  it('nulls missing fields', () => {
    expect(toPatientNameDto({ firstName: 'Sam' })).toEqual({
      title: null,
      firstName: 'Sam',
      otherName: null,
      surname: null,
      displayName: 'Sam',
      avatarUrl: null,
    });
  });

  it('passes through avatarUrl when present', () => {
    expect(
      toPatientNameDto({
        firstName: 'Ada',
        surname: 'Okafor',
        avatarUrl: 'https://api.example.com/uploads/patients/uuid/avatar.jpg',
      }),
    ).toMatchObject({
      avatarUrl: 'https://api.example.com/uploads/patients/uuid/avatar.jpg',
      displayName: 'Ada Okafor',
    });
  });
});

describe('toPatientNameWithLegacyKey', () => {
  it('adds patientName key with null when unknown', () => {
    expect(toPatientNameWithLegacyKey({}, 'patientName')).toMatchObject({
      title: null,
      firstName: null,
      otherName: null,
      surname: null,
      displayName: 'Unknown',
      patientName: null,
    });
  });

  it('adds name key with display string', () => {
    expect(
      toPatientNameWithLegacyKey(
        { firstName: 'Jane', surname: 'Doe' },
        'name',
      ),
    ).toMatchObject({
      firstName: 'Jane',
      surname: 'Doe',
      displayName: 'Jane Doe',
      name: 'Jane Doe',
    });
  });
});
