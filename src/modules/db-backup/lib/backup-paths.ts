import { join } from 'path';
import { HOSPITAL_TIMEZONE } from '../../../common/utils/datetime';

export const DB_BACKUP_DIR = join(process.cwd(), 'uploads', 'db-backups');

/** Hospital-local calendar parts for filenames. */
export function hospitalLocalParts(date = new Date()): {
  date: string;
  time: string;
} {
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
    parts.filter((p) => p.type !== 'literal').map((p) => [p.type, p.value]),
  );

  return {
    date: `${lookup.year}-${lookup.month}-${lookup.day}`,
    time: `${lookup.hour}${lookup.minute}${lookup.second}`,
  };
}

export function scheduledBackupFilename(date = new Date()): string {
  const { date: d } = hospitalLocalParts(date);
  return `backup-${d}.json.gz`;
}

export function manualBackupFilename(date = new Date()): string {
  const { date: d, time } = hospitalLocalParts(date);
  return `backup-${d}-${time}.json.gz`;
}

export function backupFilePath(filename: string): string {
  return join(DB_BACKUP_DIR, filename);
}
