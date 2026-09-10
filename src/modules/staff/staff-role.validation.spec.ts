import { AccountType, StaffRole } from '@prisma/client';
import { validateStaffRolePairing } from './staff-role.validation';

describe('validateStaffRolePairing', () => {
  it('accepts PHYSICIAN_HEAD for PHYSICIAN', () => {
    expect(() =>
      validateStaffRolePairing({
        accountType: AccountType.PHYSICIAN,
        staffRole: StaffRole.PHYSICIAN_HEAD,
      }),
    ).not.toThrow();
  });

  it('rejects PHYSICIAN_HEAD for BILLING', () => {
    expect(() =>
      validateStaffRolePairing({
        accountType: AccountType.BILLING,
        staffRole: StaffRole.PHYSICIAN_HEAD,
      }),
    ).toThrow(/not valid for accountType/);
  });

  it('accepts JANITOR_HEAD for JANITOR', () => {
    expect(() =>
      validateStaffRolePairing({
        accountType: AccountType.JANITOR,
        staffRole: StaffRole.JANITOR_HEAD,
      }),
    ).not.toThrow();
  });

  it('accepts new medical records and front desk heads', () => {
    expect(() =>
      validateStaffRolePairing({
        accountType: AccountType.MEDICAL_RECORDS,
        staffRole: StaffRole.MEDICAL_RECORDS_HEAD,
      }),
    ).not.toThrow();
    expect(() =>
      validateStaffRolePairing({
        accountType: AccountType.FRONT_DESK,
        staffRole: StaffRole.FRONT_DESK_HEAD,
      }),
    ).not.toThrow();
  });
});
