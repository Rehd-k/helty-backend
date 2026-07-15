import { CLINICAL_READ_ACCESS } from '../../common/constants/clinical-access.constants';

/** Route guard tokens for dialysis department staff. */
export const DIALYSIS_ACCESS = [
  'DIALYSIS',
  'DIALYSIS_HEAD',
  'DIALYSIS_NURSE',
  'DIALYSIS_TECH',
  'DIALYSIS_RECEPTIONIST',
  'SUPER_ADMIN',
] as const;

/** Patient-care read access for dialysis sessions (all clinical departments). */
export const DIALYSIS_READ_ACCESS = [...CLINICAL_READ_ACCESS] as const;

export const DIALYSIS_CLINICAL_ACCESS = [
  'DIALYSIS_NURSE',
  'DIALYSIS_TECH',
  'DIALYSIS_HEAD',
  'SUPER_ADMIN',
] as const;

export const DIALYSIS_HEAD_ACCESS = ['DIALYSIS_HEAD', 'SUPER_ADMIN'] as const;

export function isDialysisHeadRole(staffRole?: string): boolean {
  return (
    staffRole === 'DIALYSIS_HEAD' ||
    staffRole === 'SUPER_ADMIN' ||
    staffRole === 'CMD'
  );
}
