import { HOSPITAL_TIMEZONE } from '../../common/utils/datetime';
import { PatientAuthRecord } from './patient-auth.constants';

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
