import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { HOSPITAL_TIMEZONE } from '../../common/utils/datetime';
import { DbBackupService } from './db-backup.service';

const BACKUP_ENABLED =
  process.env.DB_BACKUP_ENABLED?.trim().toLowerCase() !== 'false';

@Injectable()
export class DbBackupScheduler {
  private readonly logger = new Logger(DbBackupScheduler.name);

  constructor(private readonly dbBackupService: DbBackupService) {}

  /** Runs daily at 23:59 in the hospital timezone. */
  @Cron('59 23 * * *', {
    name: 'daily-db-backup',
    timeZone: HOSPITAL_TIMEZONE,
  })
  async handleDailyBackup(): Promise<void> {
    if (!BACKUP_ENABLED) {
      return;
    }

    this.logger.log('Starting nightly database backup');
    try {
      const result = await this.dbBackupService.createBackup('scheduled');
      this.logger.log(
        `Nightly database backup finished: ${result.filename} (${result.sizeBytes} bytes)`,
      );
    } catch (err) {
      this.logger.error(
        `Nightly database backup failed: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }
}
