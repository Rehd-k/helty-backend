import { Prisma } from '@prisma/client';

/** Normalize name parts into a single lowercase search string (spaces collapsed). */
export function normalizePatientSearchName(
  firstName?: string | null,
  otherName?: string | null,
  surname?: string | null,
): string {
  return [firstName, otherName, surname]
    .map((p) => (p ?? '').trim().toLowerCase())
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function nameContains(token: string): Prisma.StringFilter {
  return { contains: token, mode: 'insensitive' };
}

/**
 * Prisma where clause for patient name search.
 * - Single token: OR across firstName, otherName, surname, searchName
 * - Multi-token: searchName contains full query OR token-split AND across name fields
 */
export function buildPatientNameSearchWhere(
  q: string,
): Prisma.PatientWhereInput {
  const trimmed = q.trim();
  if (!trimmed) {
    return {};
  }

  const tokens = trimmed.split(/\s+/).filter(Boolean);
  const normalizedQuery = trimmed.toLowerCase().replace(/\s+/g, ' ');

  if (tokens.length === 1) {
    const needle = nameContains(tokens[0]);
    return {
      OR: [
        { firstName: needle },
        { otherName: needle },
        { surname: needle },
        { searchName: needle },
      ],
    };
  }

  const or: Prisma.PatientWhereInput[] = [
    { searchName: nameContains(normalizedQuery) },
  ];

  if (tokens.length === 2) {
    const [a, b] = tokens;
    or.push(
      { AND: [{ firstName: nameContains(a) }, { surname: nameContains(b) }] },
      { AND: [{ firstName: nameContains(b) }, { surname: nameContains(a) }] },
      { AND: [{ firstName: nameContains(a) }, { otherName: nameContains(b) }] },
      { AND: [{ otherName: nameContains(a) }, { surname: nameContains(b) }] },
    );
  } else {
    // 3+ tokens: match first / middle / last against firstName / otherName / surname
    const first = tokens[0];
    const last = tokens[tokens.length - 1];
    const middle = tokens.slice(1, -1).join(' ');
    or.push({
      AND: [
        { firstName: nameContains(first) },
        { otherName: nameContains(middle) },
        { surname: nameContains(last) },
      ],
    });
    or.push({
      AND: [
        { firstName: nameContains(first) },
        { surname: nameContains(last) },
      ],
    });
  }

  return { OR: or };
}
