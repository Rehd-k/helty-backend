export const PATIENT_BILLING_DUE_DAYS = Number(
  process.env.PATIENT_BILLING_DUE_DAYS ?? 14,
);

export const PATIENT_BILLING_CURRENCY = 'NGN';

export enum PatientChargeCategory {
  DAILY = 'DAILY',
  PHARMACY = 'PHARMACY',
  LAB = 'LAB',
  SUPPLIES = 'SUPPLIES',
  OTHER = 'OTHER',
}

export const CHARGE_CATEGORY_ORDER: PatientChargeCategory[] = [
  PatientChargeCategory.DAILY,
  PatientChargeCategory.PHARMACY,
  PatientChargeCategory.LAB,
  PatientChargeCategory.SUPPLIES,
  PatientChargeCategory.OTHER,
];

export const CHARGE_CATEGORY_LABELS: Record<PatientChargeCategory, string> = {
  [PatientChargeCategory.DAILY]: 'Daily Charge',
  [PatientChargeCategory.PHARMACY]: 'Pharmacy and Medications',
  [PatientChargeCategory.LAB]: 'Laboratory and Investigations',
  [PatientChargeCategory.SUPPLIES]: 'Supplies & Purchases',
  [PatientChargeCategory.OTHER]: 'Others',
};

export enum PatientBillType {
  INPATIENT = 'INPATIENT',
  OUTPATIENT = 'OUTPATIENT',
}
