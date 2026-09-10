import { AccountType, StaffRole } from '@prisma/client';

/** Account types that have a department head (excludes CMD, CMAC, SUPER_ADMIN). */
export const DEPARTMENT_HEAD_ACCOUNT_TYPES = [
  AccountType.BILLING,
  AccountType.ACCOUNTING,
  AccountType.PHARMACY,
  AccountType.NURSE,
  AccountType.PHYSICIAN,
  AccountType.LABORATORY,
  AccountType.RADIOLOGY,
  AccountType.STORE,
  AccountType.MEDICAL_RECORDS,
  AccountType.FRONT_DESK,
  AccountType.ICT,
  AccountType.HMO,
  AccountType.PURCHASES,
  AccountType.DIALYSIS,
  AccountType.THEATRE,
  AccountType.JANITOR,
] as const;

export type HeadedAccountType = (typeof DEPARTMENT_HEAD_ACCOUNT_TYPES)[number];

/** Canonical head StaffRole for each operational account type. */
export const HEAD_ROLE_BY_ACCOUNT_TYPE: Record<HeadedAccountType, StaffRole> = {
  [AccountType.BILLING]: StaffRole.BILLING_HEAD,
  [AccountType.ACCOUNTING]: StaffRole.ACCOUNT_HEAD,
  [AccountType.PHARMACY]: StaffRole.PHARMACY_HEAD,
  [AccountType.NURSE]: StaffRole.MATRON,
  [AccountType.PHYSICIAN]: StaffRole.PHYSICIAN_HEAD,
  [AccountType.LABORATORY]: StaffRole.LAB_HEAD,
  [AccountType.RADIOLOGY]: StaffRole.RADIOLOGY_HEAD,
  [AccountType.STORE]: StaffRole.HEAD_OF_STORE,
  [AccountType.MEDICAL_RECORDS]: StaffRole.MEDICAL_RECORDS_HEAD,
  [AccountType.FRONT_DESK]: StaffRole.FRONT_DESK_HEAD,
  [AccountType.ICT]: StaffRole.ICT_HEAD,
  [AccountType.HMO]: StaffRole.HMO_HEAD,
  [AccountType.PURCHASES]: StaffRole.PURCHASES_HEAD,
  [AccountType.DIALYSIS]: StaffRole.DIALYSIS_HEAD,
  [AccountType.THEATRE]: StaffRole.THEATRE_HEAD,
  [AccountType.JANITOR]: StaffRole.JANITOR_HEAD,
};

const HEAD_ROLES = new Set<StaffRole>(Object.values(HEAD_ROLE_BY_ACCOUNT_TYPE));

/** Legacy aliases accepted as department heads. */
const HEAD_ROLE_ALIASES: Record<string, StaffRole> = {
  ACCOUNTING_HEAD: StaffRole.ACCOUNT_HEAD,
  HEAD_NURSE: StaffRole.MATRON,
};

export function isHospitalWideInventoryRole(input: {
  accountType?: string | null;
  staffRole?: string | null;
}): boolean {
  const at = (input.accountType ?? '').toUpperCase().replace(/-/g, '_');
  const role = (input.staffRole ?? '').toUpperCase().replace(/-/g, '_');
  return (
    at === AccountType.CMD ||
    at === AccountType.CMAC ||
    at === AccountType.SUPER_ADMIN ||
    role === StaffRole.CMD ||
    role === StaffRole.CMAC ||
    role === StaffRole.SUPER_ADMIN ||
    // Director of Admin — coming soon; treat as hospital-wide when present.
    at === 'DA' ||
    at === 'DIRECTOR_OF_ADMIN' ||
    at === 'DIRECTOR_ADMIN' ||
    role === 'DA' ||
    role === 'DIRECTOR_OF_ADMIN' ||
    role === 'DIRECTOR_ADMIN'
  );
}

export function isOperationalInventoryDepartment(
  accountType?: string | null,
): accountType is HeadedAccountType {
  return (DEPARTMENT_HEAD_ACCOUNT_TYPES as readonly string[]).includes(
    accountType ?? '',
  );
}

export function normalizeHeadRole(staffRole?: string | null): StaffRole | null {
  if (!staffRole) return null;
  const key = staffRole.trim().toUpperCase().replace(/-/g, '_');
  if (key in HEAD_ROLE_ALIASES) return HEAD_ROLE_ALIASES[key];
  if ((HEAD_ROLES as Set<string>).has(key)) return key as StaffRole;
  return null;
}

export function isDepartmentHeadRole(
  staffRole?: string | null,
  accountType?: string | null,
): boolean {
  const role = normalizeHeadRole(staffRole);
  if (!role) return false;
  if (!accountType) return HEAD_ROLES.has(role);
  const expected =
    HEAD_ROLE_BY_ACCOUNT_TYPE[accountType as AccountType] ?? null;
  if (!expected) return false;
  return role === expected;
}

export function headedAccountTypeForRole(
  staffRole?: string | null,
  accountType?: string | null,
): AccountType | null {
  const role = normalizeHeadRole(staffRole);
  if (!role) return null;
  if (accountType && isDepartmentHeadRole(staffRole, accountType)) {
    return accountType as AccountType;
  }
  for (const [at, headRole] of Object.entries(HEAD_ROLE_BY_ACCOUNT_TYPE)) {
    if (headRole === role) return at as AccountType;
  }
  return null;
}

/** Generic department roster is not used for nursing (own roster) or janitor (worker shifts). */
export function usesGenericDepartmentRoster(accountType: AccountType): boolean {
  return (
    accountType !== AccountType.NURSE && accountType !== AccountType.JANITOR
  );
}

export const DEPARTMENT_HEAD_ACCESS = [
  ...Object.values(HEAD_ROLE_BY_ACCOUNT_TYPE),
  'ACCOUNTING_HEAD',
  'HEAD_NURSE',
  'SUPER_ADMIN',
  'CMD',
  'CMAC',
] as const;

export const HOUSEKEEPING_ACCESS = [
  'JANITOR',
  StaffRole.JANITOR_HEAD,
  'SUPER_ADMIN',
] as const;
