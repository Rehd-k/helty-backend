/** All clinical department account types — shared read access across patient-care modules. */
export const CLINICAL_ACCOUNT_TYPES = [
  'DIALYSIS',
  'THEATRE',
  'NURSE',
  'PHYSICIAN',
  'LABORATORY',
  'RADIOLOGY',
  'PHARMACY',
] as const;

export const CLINICAL_READ_ACCESS = [
  ...CLINICAL_ACCOUNT_TYPES,
  'SUPER_ADMIN',
] as const;
