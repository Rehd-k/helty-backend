import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { MedicationScheduleService } from './medication-schedule.service';

const CRON_ENABLED =
  process.env.MEDICATION_ALERT_CRON_ENABLED?.trim().toLowerCase() !== 'false';

@Injectable()
export class MedicationDoseAlertScheduler {
  private readonly logger = new Logger(MedicationDoseAlertScheduler.name);

  constructor(private readonly scheduleService: MedicationScheduleService) {}

  @Cron('*/5 * * * *', { name: 'medication-dose-alerts' })
  async handleMedicationDoseAlerts(): Promise<void> {
    if (!CRON_ENABLED) return;

    this.logger.log('Starting medication dose alert sync');
    try {
      const result = await this.scheduleService.processActiveSchedulesForAlerts();
      this.logger.log(
        `Medication dose alert sync finished: ${result.processed} schedule(s), ${result.updated} status update(s)`,
      );
    } catch (err) {
      this.logger.error(
        `Medication dose alert job failed: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }
}
