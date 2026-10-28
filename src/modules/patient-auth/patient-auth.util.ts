import { HOSPITAL_TIMEZONE } from '../../common/utils/datetime';
import { normalizePhoneForTermii } from '../sms/termii-phone.util';
import { PatientAuthRecord } from './patient-auth.constants';

/** Stored phone formats that should hit the same patient (0803…, +234…, 234…). */
export function phoneLookupVariants(phone: string): string[] {
  const trimmed = phone.trim();
  if (!trimmed) return [];
  const variants = new Set<string>([trimmed]);
  const normalized = normalizePhoneForTermii(trimmed);
  if (normalized) {
    variants.add(normalized);
    variants.add(`+${normalized}`);
    if (normalized.startsWith('234') && normalized.length > 3) {
      variants.add(`0${normalized.slice(3)}`);
    }
  }
  return [...variants];
}

export function phonesMatch(
  stored: string | null | undefined,
  input: string,
): boolean {
  if (!stored?.trim() || !input.trim()) return false;
  const left = normalizePhoneForTermii(stored);
  const right = normalizePhoneForTermii(input);
  if (left && right) return left === right;
  return stored.trim() === input.trim();
}

export function toCalendarDateString(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: HOSPITAL_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function dobMatches(stored: Date, inputIsoDate: string): boolean {
  return toCalendarDateString(stored) === inputIsoDate.trim();
}

export function toPatientPortalDto(patient: PatientAuthRecord) {
  const { hmoProvider, status: _status, ...rest } = patient;
  return {
    id: rest.id,
    patientId: rest.patientId,
    cardNo: rest.cardNo,
    title: rest.title,
    surname: rest.surname,
    firstName: rest.firstName,
    otherName: rest.otherName,
    dob: rest.dob,
    gender: rest.gender,
    email: rest.email,
    phoneNumber: rest.phoneNumber,
    addressOfResidence: rest.addressOfResidence,
    hmo: rest.hmo ?? hmoProvider?.name ?? null,
    avatarUrl: rest.avatarUrl ?? null,
  };
}
