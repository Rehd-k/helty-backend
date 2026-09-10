import { accountTypeTokenMatches } from './access.guard';

describe('accountTypeTokenMatches department heads', () => {
  it('lets FRONT_DESK_HEAD through FRONTDESK and FRONT_DESK tokens', () => {
    const user = {
      accountType: 'FRONT_DESK',
      staffRole: 'FRONT_DESK_HEAD',
    };
    expect(accountTypeTokenMatches('FRONTDESK', user)).toBe(true);
    expect(accountTypeTokenMatches('FRONT_DESK', user)).toBe(true);
  });

  it('lets MEDICAL_RECORDS_HEAD through MEDICAL_RECORDS', () => {
    expect(
      accountTypeTokenMatches('MEDICAL_RECORDS', {
        accountType: 'MEDICAL_RECORDS',
        staffRole: 'MEDICAL_RECORDS_HEAD',
      }),
    ).toBe(true);
  });

  it('treats HOUSE_OFFICER as INPATIENT_DOCTOR', () => {
    expect(
      accountTypeTokenMatches('INPATIENT_DOCTOR', {
        accountType: 'PHYSICIAN',
        staffRole: 'HOUSE_OFFICER',
      }),
    ).toBe(true);
  });

  it('matches JANITOR account type', () => {
    expect(
      accountTypeTokenMatches('JANITOR', {
        accountType: 'JANITOR',
        staffRole: 'JANITOR_HEAD',
      }),
    ).toBe(true);
  });
});
