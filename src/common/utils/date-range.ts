export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function parseDateOrNull(input?: string | null): Date | null {
  if (input === undefined || input === null) return null;

  const trimmed = String(input).trim();
  if (!trimmed) return null;

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

export function parseDateRange(
  fromDate?: string | null,
  toDate?: string | null,
): { from: Date; to: Date } {
  const now = new Date();

  const parsedFrom = parseDateOrNull(fromDate);
  const parsedTo = parseDateOrNull(toDate);

  return {
    from: startOfDay(parsedFrom ?? now),
    to: endOfDay(parsedTo ?? now),
  };
}
