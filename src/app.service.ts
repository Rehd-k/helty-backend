import { Injectable } from '@nestjs/common';
import {
  formatHospitalDateTimeDisplay,
  formatHospitalDateTimeLocal,
  HOSPITAL_TIMEZONE,
} from './common/utils/datetime';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Hello World!';
  }

  getServerDateTime(): {
    iso: string;
    isoLocal: string;
    displayLocal: string;
    timezone: string;
    unixMs: number;
  } {
    const now = new Date();
    return {
      iso: now.toISOString(),
      isoLocal: formatHospitalDateTimeLocal(now),
      displayLocal: formatHospitalDateTimeDisplay(now),
      timezone: HOSPITAL_TIMEZONE,
      unixMs: now.getTime(),
    };
  }
}
