export type PatientNameFields = {
  title?: string | null;
  firstName?: string | null;
  otherName?: string | null;
  surname?: string | null;
};

export type PatientNameDto = {
  title: string | null;
  firstName: string | null;
  otherName: string | null;
  surname: string | null;
  displayName: string;
};

/** Display name: optional title, then firstName, otherName, surname. */
export function formatPatientDisplayName(p: PatientNameFields): string {
  const nameParts = [p.firstName, p.otherName, p.surname].filter(Boolean);
  const name = nameParts.join(' ').trim();
  if (p.title?.trim()) {
    const withTitle = `${p.title.trim()} ${name}`.trim();
    return withTitle || 'Unknown';
  }
  return name || 'Unknown';
}

export function toPatientNameDto(p: PatientNameFields): PatientNameDto {
  return {
    title: p.title ?? null,
    firstName: p.firstName ?? null,
    otherName: p.otherName ?? null,
    surname: p.surname ?? null,
    displayName: formatPatientDisplayName(p),
  };
}

export type PatientNameLegacyKey = 'patientName' | 'name';

/** Structured name fields plus a legacy display string key for existing API shapes. */
export function toPatientNameWithLegacyKey<K extends PatientNameLegacyKey>(
  p: PatientNameFields,
  key: K,
): PatientNameDto & Record<K, string | null> {
  const dto = toPatientNameDto(p);
  const display =
    dto.displayName === 'Unknown' ? null : dto.displayName;
  return { ...dto, [key]: display } as PatientNameDto & Record<K, string | null>;
}

export const patientNameOnlySelect = {
  title: true,
  firstName: true,
  otherName: true,
  surname: true,
} as const;

export const patientNameFieldsSelect = {
  id: true,
  patientId: true,
  ...patientNameOnlySelect,
  gender: true,
  dob: true,
} as const;
