function stringifyAnswer(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) {
    const parts = value.map((item) => String(item).trim()).filter(Boolean);
    return parts.length ? parts.join(', ') : null;
  }
  if (typeof value === 'object') return null;
  const text = String(value).trim();
  return text || null;
}

/** Compiles one questionnaire section from persisted answersJson. */
export function extractSectionNarrative(
  answersJson: unknown,
  sectionId: string,
): string | null {
  if (!answersJson || typeof answersJson !== 'object' || Array.isArray(answersJson)) {
    return null;
  }
  const section = (answersJson as Record<string, unknown>)[sectionId];
  if (!section || typeof section !== 'object' || Array.isArray(section)) {
    return null;
  }
  const record = section as Record<string, unknown>;
  const parts: string[] = [];
  for (const [key, value] of Object.entries(record)) {
    if (key === 'other') continue;
    const display = stringifyAnswer(value);
    if (display) parts.push(`${key}: ${display}`);
  }
  const other = stringifyAnswer(record.other);
  if (other) parts.push(other);
  return parts.length ? parts.join('. ') : null;
}

export function composeOperativeNoteSummary(note: {
  narrative: string;
  additionalNotes?: string | null;
  answersJson: unknown;
}) {
  const extra = note.additionalNotes?.trim();
  const narrative = [note.narrative?.trim(), extra].filter(Boolean).join('\n\n');
  return {
    operativeNotes: narrative || null,
    findings: extractSectionNarrative(note.answersJson, 'findings'),
    complications: extractSectionNarrative(note.answersJson, 'complications'),
  };
}
