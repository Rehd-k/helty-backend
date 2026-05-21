/** Must match seeded `ServiceCategory.name` (see REF_Categories.csv). */
export const RADIOLOGY_BILLING_CATEGORY = 'Radiology & Imaging';

export const LAB_BILLING_CATEGORIES = [
  'Laboratory',
  'Laboratory Tests',
] as const;

export const CONSULTATION_BILLING_CATEGORY = 'Consultations & Reviews';

/** Service categories allowed when billing encounter procedures via proceduresJson. */
export const PROCEDURE_BILLING_CATEGORIES = [
  'Therapy & Rehabilitation',
  'Physiotherapy',
  'Surgical Procedures',
  'General Procedures',
  'Cardiology Procedures',
  'Orthopaedics',
] as const;
