/** Must match seeded `ServiceCategory.name` (see REF_Categories.csv). */
export const RADIOLOGY_BILLING_CATEGORY = 'Radiology & Imaging';

export const LAB_BILLING_CATEGORIES = [
  'Laboratory',
  'Laboratory Tests',
] as const;

export const DIALYSIS_BILLING_CATEGORIES = [
  'Dialysis',
  'Dialysis Services',
] as const;

export const CONSULTATION_BILLING_CATEGORY = 'Consultations & Reviews';

/** Paid consultation lines may fund this many completed OPD encounters. */
export const CONSULTATION_CREDIT_MAX_VISITS = 2;

/** Days after payment during which consultation credit remains valid. */
export const CONSULTATION_CREDIT_VALIDITY_DAYS = 14;

/** Service categories allowed when billing encounter procedures via proceduresJson. */
export const PROCEDURE_BILLING_CATEGORIES = [
  'Therapy & Rehabilitation',
  'Physiotherapy',
  'Surgical Procedures',
  'General Procedures',
  'Cardiology Procedures',
  'Orthopaedics',
] as const;
