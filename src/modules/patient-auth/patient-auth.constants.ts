import { Prisma } from '@prisma/client';

export const PATIENT_ACCOUNT_TYPE = 'PATIENT' as const;

/** QA / demo hospital patient ID — devices are auto-approved, no frontdesk check. */
export const DEVICE_VERIFICATION_EXEMPT_PATIENT_ID = 'Q4CMEZM8';

export function isDeviceVerificationExempt(
  patientId?: string | null,
): boolean {
  if (!patientId) return false;
  return (
    patientId.trim().toUpperCase() === DEVICE_VERIFICATION_EXEMPT_PATIENT_ID
  );
}

export const PATIENT_AUTH_SELECT = {
  id: true,
  patientId: true,
  cardNo: true,
  title: true,
  surname: true,
  firstName: true,
  otherName: true,
  dob: true,
  gender: true,
  email: true,
  phoneNumber: true,
  addressOfResidence: true,
  hmo: true,
  status: true,
  avatarUrl: true,
  hmoProvider: {
    select: { name: true },
  },
} satisfies Prisma.PatientSelect;

export type PatientAuthRecord = Prisma.PatientGetPayload<{
  select: typeof PATIENT_AUTH_SELECT;
}>;
