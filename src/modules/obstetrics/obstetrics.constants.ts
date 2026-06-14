export const GENOTYPE_OPTIONS = ['AA', 'AS', 'SS', 'AC', 'SC'] as const;

export const BLOOD_GROUP_OPTIONS = [
  'A+',
  'A-',
  'B+',
  'B-',
  'AB+',
  'AB-',
  'O+',
  'O-',
] as const;

export const SEROLOGY_RESULT_OPTIONS = [
  'Negative',
  'Positive',
  'Indeterminate',
] as const;

export const URINE_DIPSTICK_OPTIONS = [
  'Negative',
  'Trace',
  '1+',
  '2+',
  '3+',
] as const;

export const FETAL_DESCENT_OPTIONS = ['1/5', '2/5', '3/5', '4/5', '5/5'] as const;
