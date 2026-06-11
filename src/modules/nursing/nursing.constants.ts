import { NursingUnit, StaffRole } from '@prisma/client';

/** All nursing staff roles (line + charge + matron). */
export const NURSING_STAFF_ROLES: readonly StaffRole[] = [
  StaffRole.MATRON,
  StaffRole.WARD_CHARGE_NURSE,
  StaffRole.ICU_CHARGE_NURSE,
  StaffRole.EMERGENCY_CHARGE_NURSE,
  StaffRole.OPD_CHARGE_NURSE,
  StaffRole.ONG_CHARGE_NURSE,
  StaffRole.INPATIENT_NURSE,
  StaffRole.OUTPATIENT_NURSE,
] as const;

/** Charge nurse + matron roles. */
export const NURSING_CHARGE_ROLES: readonly StaffRole[] = [
  StaffRole.MATRON,
  StaffRole.WARD_CHARGE_NURSE,
  StaffRole.ICU_CHARGE_NURSE,
  StaffRole.EMERGENCY_CHARGE_NURSE,
  StaffRole.OPD_CHARGE_NURSE,
  StaffRole.ONG_CHARGE_NURSE,
] as const;

/** Route guard tokens for any nursing staff (account type NURSE or explicit roles). */
export const NURSING_ACCESS = [
  'NURSE',
  ...NURSING_STAFF_ROLES,
  'SUPER_ADMIN',
] as const;

/** Route guard tokens for charge nurses and matron. */
export const NURSING_CHARGE_ACCESS = [
  ...NURSING_CHARGE_ROLES,
  'SUPER_ADMIN',
] as const;

export const MATRON_ACCESS = ['MATRON', 'SUPER_ADMIN'] as const;

/** Who may create/delete nurse-to-patient assignments (scoped in service). */
export const NURSING_ASSIGNMENT_ADMIN = [
  ...NURSING_CHARGE_ROLES,
  'SUPER_ADMIN',
] as const;

/** Inpatient clinical nursing read access (doctors + all nurses). */
export const INPATIENT_NURSING_READ_ACCESS = [
  ...NURSING_ACCESS,
  'INPATIENT_DOCTOR',
  'CONSULTANT',
] as const;

/** Inpatient clinical nursing write access. */
export const INPATIENT_NURSING_WRITE_ACCESS = [...NURSING_ACCESS] as const;

/** Assignment admin including physicians. */
export const NURSING_ASSIGNMENT_WITH_DOCTORS = [
  ...NURSING_ASSIGNMENT_ADMIN,
  'INPATIENT_DOCTOR',
  'CONSULTANT',
] as const;

export const CHARGE_ROLE_TO_UNIT: Partial<Record<StaffRole, NursingUnit>> = {
  [StaffRole.WARD_CHARGE_NURSE]: NursingUnit.INPATIENT_WARD,
  [StaffRole.ICU_CHARGE_NURSE]: NursingUnit.ICU,
  [StaffRole.EMERGENCY_CHARGE_NURSE]: NursingUnit.EMERGENCY,
  [StaffRole.OPD_CHARGE_NURSE]: NursingUnit.OPD,
  [StaffRole.ONG_CHARGE_NURSE]: NursingUnit.ONG,
};

export function isMatronRole(staffRole?: string): boolean {
  return staffRole === StaffRole.MATRON || staffRole === StaffRole.SUPER_ADMIN;
}

export function isChargeNurseRole(staffRole?: string): boolean {
  if (!staffRole) return false;
  return (
    staffRole !== StaffRole.MATRON &&
    NURSING_CHARGE_ROLES.includes(staffRole as StaffRole)
  );
}

export function isNursingChargeOrMatron(staffRole?: string): boolean {
  return isMatronRole(staffRole) || isChargeNurseRole(staffRole);
}

export function staffRoleToNursingUnit(
  staffRole?: string,
): NursingUnit | null {
  if (!staffRole) return null;
  return CHARGE_ROLE_TO_UNIT[staffRole as StaffRole] ?? null;
}

export const NURSING_ROLE_TITLES: Record<string, string> = {
  MATRON: 'Matron',
  WARD_CHARGE_NURSE: 'Ward Charge Nurse',
  ICU_CHARGE_NURSE: 'ICU Charge Nurse',
  EMERGENCY_CHARGE_NURSE: 'Emergency Charge Nurse',
  OPD_CHARGE_NURSE: 'OPD Charge Nurse',
  ONG_CHARGE_NURSE: 'O&G Charge Nurse',
  INPATIENT_NURSE: 'Inpatient Nurse',
  OUTPATIENT_NURSE: 'Outpatient Nurse',
};

export type NursingCapability =
  | 'view_hospital_dashboard'
  | 'view_unit_dashboard'
  | 'view_line_dashboard'
  | 'manage_shift_roster'
  | 'view_own_roster'
  | 'assign_inpatient_patients'
  | 'assign_outpatient_patients'
  | 'clinical_nursing_writes';

export function capabilitiesForStaffRole(
  staffRole?: string,
): NursingCapability[] {
  if (!staffRole) return [];

  if (isMatronRole(staffRole)) {
    return [
      'view_hospital_dashboard',
      'view_unit_dashboard',
      'manage_shift_roster',
      'view_own_roster',
      'assign_inpatient_patients',
      'assign_outpatient_patients',
      'clinical_nursing_writes',
    ];
  }

  if (isChargeNurseRole(staffRole)) {
    const unit = staffRoleToNursingUnit(staffRole);
    const caps: NursingCapability[] = [
      'view_unit_dashboard',
      'manage_shift_roster',
      'view_own_roster',
      'clinical_nursing_writes',
    ];
    if (
      unit === NursingUnit.INPATIENT_WARD ||
      unit === NursingUnit.ICU ||
      unit === NursingUnit.EMERGENCY ||
      unit === NursingUnit.ONG
    ) {
      caps.push('assign_inpatient_patients');
    }
    if (unit === NursingUnit.OPD || unit === NursingUnit.ONG) {
      caps.push('assign_outpatient_patients');
    }
    return caps;
  }

  if (
    staffRole === StaffRole.INPATIENT_NURSE ||
    staffRole === StaffRole.OUTPATIENT_NURSE
  ) {
    return ['view_line_dashboard', 'view_own_roster', 'clinical_nursing_writes'];
  }

  return ['clinical_nursing_writes'];
}

export function defaultDashboardRoute(staffRole?: string): string {
  if (isMatronRole(staffRole)) return '/nurses/dashboard/matron/overview';
  if (isChargeNurseRole(staffRole)) return '/nurses/dashboard/charge/overview';
  return '/nurses/dashboard/line/overview';
}
