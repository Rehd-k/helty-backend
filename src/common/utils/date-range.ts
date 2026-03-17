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

export function parseDateRange(
  fromDate: string,
  toDate: string,
): { from: Date; to: Date } {
  return {
    from: startOfDay(new Date(fromDate)),
    to: endOfDay(new Date(toDate)),
  };
}
