/** Route guard tokens for dialysis department staff. */
export const DIALYSIS_ACCESS = [
  'DIALYSIS',
  'DIALYSIS_HEAD',
  'DIALYSIS_NURSE',
  'DIALYSIS_TECH',
  'DIALYSIS_RECEPTIONIST',
  'SUPER_ADMIN',
] as const;

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
    staffRole === 'SUPER_ADMIN'
  );
}
