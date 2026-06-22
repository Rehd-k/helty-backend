import {
  CLINICAL_ACCOUNT_TYPES,
  CLINICAL_READ_ACCESS,
} from './clinical-access.constants';
import { accountTypeTokenMatches } from '../guards/access.guard';

describe('CLINICAL_READ_ACCESS', () => {
  it('includes all seven clinical account types plus SUPER_ADMIN', () => {
    expect(CLINICAL_ACCOUNT_TYPES).toEqual([
      'DIALYSIS',
      'THEATRE',
      'NURSE',
      'PHYSICIAN',
      'LABORATORY',
      'RADIOLOGY',
      'PHARMACY',
    ]);
    expect(CLINICAL_READ_ACCESS).toContain('SUPER_ADMIN');
    expect(CLINICAL_READ_ACCESS).toHaveLength(
      CLINICAL_ACCOUNT_TYPES.length + 1,
    );
  });

  it.each(CLINICAL_ACCOUNT_TYPES.map((accountType) => [accountType]))(
    'grants read access to %s account type',
    (accountType) => {
      const allowed = CLINICAL_READ_ACCESS.some((token) =>
        accountTypeTokenMatches(token, { accountType }),
      );
      expect(allowed).toBe(true);
    },
  );

  it('does not grant read access to non-clinical account types', () => {
    for (const accountType of ['BILLING', 'FRONT_DESK', 'ACCOUNTING']) {
      const allowed = CLINICAL_READ_ACCESS.some((token) =>
        accountTypeTokenMatches(token, { accountType }),
      );
      expect(allowed).toBe(false);
    }
  });
});
