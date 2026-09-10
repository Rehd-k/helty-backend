import { AccountType, StaffRole } from '@prisma/client';
import {
  HEAD_ROLE_BY_ACCOUNT_TYPE,
  headedAccountTypeForRole,
  isDepartmentHeadRole,
  isHospitalWideInventoryRole,
  usesGenericDepartmentRoster,
} from './department-head.constants';

describe('department-head constants', () => {
  it('maps every operational account type to a head role', () => {
    expect(HEAD_ROLE_BY_ACCOUNT_TYPE[AccountType.PHYSICIAN]).toBe(
      StaffRole.PHYSICIAN_HEAD,
    );
    expect(HEAD_ROLE_BY_ACCOUNT_TYPE[AccountType.NURSE]).toBe(StaffRole.MATRON);
    expect(HEAD_ROLE_BY_ACCOUNT_TYPE[AccountType.JANITOR]).toBe(
      StaffRole.JANITOR_HEAD,
    );
    expect(HEAD_ROLE_BY_ACCOUNT_TYPE[AccountType.MEDICAL_RECORDS]).toBe(
      StaffRole.MEDICAL_RECORDS_HEAD,
    );
  });

  it('does not treat CMD or CMAC as department heads', () => {
    expect(isDepartmentHeadRole(StaffRole.CMD, AccountType.CMD)).toBe(false);
    expect(isDepartmentHeadRole(StaffRole.CMAC, AccountType.CMAC)).toBe(false);
    expect(isHospitalWideInventoryRole({ accountType: AccountType.CMD })).toBe(
      true,
    );
    expect(isHospitalWideInventoryRole({ accountType: AccountType.CMAC })).toBe(
      true,
    );
    expect(
      isHospitalWideInventoryRole({
        accountType: 'DA',
        staffRole: 'DIRECTOR_OF_ADMIN',
      }),
    ).toBe(true);
  });

  it('recognizes existing heads', () => {
    expect(
      isDepartmentHeadRole(StaffRole.LAB_HEAD, AccountType.LABORATORY),
    ).toBe(true);
    expect(headedAccountTypeForRole(StaffRole.PHARMACY_HEAD)).toBe(
      AccountType.PHARMACY,
    );
  });

  it('skips generic roster for nursing and janitor', () => {
    expect(usesGenericDepartmentRoster(AccountType.NURSE)).toBe(false);
    expect(usesGenericDepartmentRoster(AccountType.JANITOR)).toBe(false);
    expect(usesGenericDepartmentRoster(AccountType.PHYSICIAN)).toBe(true);
  });
});
