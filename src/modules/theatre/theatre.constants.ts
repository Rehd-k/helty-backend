import { CLINICAL_READ_ACCESS } from '../../common/constants/clinical-access.constants';

/** Route guard tokens for theatre department staff. */
export const THEATRE_ACCESS = [
  'THEATRE',
  'THEATRE_HEAD',
  'THEATRE_NURSE',
  'THEATRE_SCRUB',
  'THEATRE_ANAESTHETIST',
  'THEATRE_RECEPTIONIST',
  'SUPER_ADMIN',
] as const;

export const THEATRE_CLINICAL_ACCESS = [
  'THEATRE_HEAD',
  'THEATRE_NURSE',
  'THEATRE_SCRUB',
  'THEATRE_ANAESTHETIST',
  'SUPER_ADMIN',
] as const;

export const THEATRE_HEAD_ACCESS = ['THEATRE_HEAD', 'SUPER_ADMIN'] as const;

export const THEATRE_BILLING_ACCESS = [
  'THEATRE_HEAD',
  'THEATRE_RECEPTIONIST',
  'SUPER_ADMIN',
] as const;

/** Patient-care read access for surgery requests and theatre cases. */
export const SURGERY_REQUEST_READ_ACCESS = [...CLINICAL_READ_ACCESS] as const;

export const THEATRE_CASE_READ_ACCESS = [...CLINICAL_READ_ACCESS] as const;

/** Doctors book surgery; theatre staff can also view/manage the queue. */
export const SURGERY_REQUEST_ACCESS = [
  'CONSULTANT',
  'INPATIENT_DOCTOR',
  'ONG',
  'THEATRE',
  'THEATRE_HEAD',
  'THEATRE_NURSE',
  'THEATRE_SCRUB',
  'THEATRE_ANAESTHETIST',
  'THEATRE_RECEPTIONIST',
  'SUPER_ADMIN',
] as const;

export function isTheatreHeadRole(staffRole?: string): boolean {
  return staffRole === 'THEATRE_HEAD' || staffRole === 'SUPER_ADMIN';
}
