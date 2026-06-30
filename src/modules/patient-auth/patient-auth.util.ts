import { PatientAuthRecord } from './patient-auth.constants';

export function toCalendarDateString(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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
  };
}
