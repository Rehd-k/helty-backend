/** Route guard tokens for purchases department staff. */
export const PURCHASES_ACCESS = [
  'PURCHASES',
  'PURCHASES_STORE',
  'PURCHASES_STAFF',
  'PURCHASES_HEAD',
  'SUPER_ADMIN',
  'NURSE',
  'PHYSICIAN',
  'LABORATORY',
  'RADIOLOGY',
  'OTHER',
] as const;

export const PURCHASES_HEAD_ACCESS = ['PURCHASES_HEAD', 'SUPER_ADMIN'] as const;
