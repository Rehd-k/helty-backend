import { Injectable, Logger } from '@nestjs/common';
import {
  formatHospitalDateTimeDisplay,
  formatHospitalDateTimeLocal,
  HOSPITAL_TIMEZONE,
} from './common/utils/datetime';

const IMSH_MIN_APP_VERSION = /^\d+\.\d+\.\d+$/;

/** Oldest IMSH Patient build still allowed, or undefined when every build is allowed. */
export function readImshMinAppVersion(
  raw: string | undefined = process.env.IMSH_MIN_APP_VERSION,
): string | undefined {
  const trimmed = raw?.trim() ?? '';
  if (!trimmed) return undefined;
  if (!IMSH_MIN_APP_VERSION.test(trimmed)) return undefined;
  return trimmed;
}

@Injectable()
export class AppService {
  private readonly log = new Logger(AppService.name);
  private loggedInvalidMinAppVersion = false;

  getHello(): string {
    return 'Hello World!';
  }

  getServerDateTime(): {
    iso: string;
    isoLocal: string;
    displayLocal: string;
    timezone: string;
    unixMs: number;
    minAppVersion?: string;
  } {
    const now = new Date();
    const minAppVersion = this.minAppVersion();
    return {
      iso: now.toISOString(),
      isoLocal: formatHospitalDateTimeLocal(now),
      displayLocal: formatHospitalDateTimeDisplay(now),
      timezone: HOSPITAL_TIMEZONE,
      unixMs: now.getTime(),
      ...(minAppVersion ? { minAppVersion } : {}),
    };
  }

  private minAppVersion(): string | undefined {
    const raw = process.env.IMSH_MIN_APP_VERSION?.trim() ?? '';
    const parsed = readImshMinAppVersion(raw);
    if (raw && !parsed && !this.loggedInvalidMinAppVersion) {
      this.loggedInvalidMinAppVersion = true;
      this.log.warn(
        'IMSH_MIN_APP_VERSION must be x.y.z (for example 0.2.0). The store update requirement is ignored.',
      );
    }
    return parsed;
  }
}
