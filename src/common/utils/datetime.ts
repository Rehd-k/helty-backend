export const HOSPITAL_TIMEZONE =
  process.env.APPOINTMENT_REMINDER_TIMEZONE?.trim() || 'Africa/Lagos';

const LOCAL_TIMESTAMP_KEY =
  /(?:At|DateTime|Time|Date)$|^(?:from|to|asOf|date)$/;

const ISO_DATETIME_RE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?$/;

function pad(value: number, width = 2): string {
  return String(value).padStart(width, '0');
}

export function parseToDate(value: Date | string): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function isIsoDateTimeString(value: string): boolean {
  return ISO_DATETIME_RE.test(value);
}

export function shouldAddLocalTimestampField(key: string): boolean {
  if (key.endsWith('Local')) return false;
  return LOCAL_TIMESTAMP_KEY.test(key);
}

export function formatHospitalDateTimeLocal(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: HOSPITAL_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const lookup = Object.fromEntries(
    parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]),
  );

  const ms = pad(date.getMilliseconds(), 3);
  const offset = HOSPITAL_TIMEZONE === 'Africa/Lagos' ? '+01:00' : getTimezoneOffset(date);

  return `${lookup.year}-${lookup.month}-${lookup.day}T${lookup.hour}:${lookup.minute}:${lookup.second}.${ms}${offset}`;
}

function getTimezoneOffset(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: HOSPITAL_TIMEZONE,
    timeZoneName: 'longOffset',
  }).formatToParts(date);

  const offset = parts.find((part) => part.type === 'timeZoneName')?.value;
  if (!offset) return '+00:00';

  const match = offset.match(/GMT([+-]\d{1,2})(?::?(\d{2}))?/i);
  if (!match) return '+00:00';

  const hours = pad(Math.abs(Number(match[1])), 2);
  const sign = Number(match[1]) >= 0 ? '+' : '-';
  const minutes = pad(Number(match[2] ?? '0'), 2);
  return `${sign}${hours}:${minutes}`;
}

export function formatHospitalDateTimeDisplay(date: Date): string {
  return new Intl.DateTimeFormat('en-NG', {
    timeZone: HOSPITAL_TIMEZONE,
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

export function appendLocalTimestamps<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || value === undefined) {
    return value;
  }

  if (value instanceof Date) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => appendLocalTimestamps(item, seen)) as T;
  }

  if (typeof value !== 'object') {
    return value;
  }

  if (seen.has(value)) {
    return value;
  }
  seen.add(value);

  const record = value as Record<string, unknown>;
  const result: Record<string, unknown> = {};

  for (const [key, raw] of Object.entries(record)) {
    result[key] = appendLocalTimestamps(raw, seen);

    if (!shouldAddLocalTimestampField(key)) {
      continue;
    }

    const localKey = `${key}Local`;
    if (localKey in record) {
      continue;
    }

    const date =
      raw instanceof Date
        ? raw
        : typeof raw === 'string' && isIsoDateTimeString(raw)
          ? parseToDate(raw)
          : null;

    if (!date) {
      continue;
    }

    result[localKey] = formatHospitalDateTimeLocal(date);
  }

  return result as T;
}
