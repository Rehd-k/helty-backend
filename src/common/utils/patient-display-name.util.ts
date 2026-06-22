export type PatientNameFields = {
  title?: string | null;
  firstName?: string | null;
  otherName?: string | null;
  surname?: string | null;
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

export const patientNameFieldsSelect = {
  id: true,
  patientId: true,
  title: true,
  firstName: true,
  otherName: true,
  surname: true,
} as const;
