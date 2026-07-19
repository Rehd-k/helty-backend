import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AppointmentNotificationService } from './appointment-notification.service';
import { APPOINTMENT_REMINDER_TIMEZONE } from './appointment-notification.types';

@Injectable()
export class AppointmentReminderScheduler {
  private readonly logger = new Logger(AppointmentReminderScheduler.name);

  constructor(
    private readonly notificationService: AppointmentNotificationService,
  ) {}

  /** Runs daily at 06:00 in Africa/Lagos (or APPOINTMENT_REMINDER_TIMEZONE). */
  @Cron('0 6 * * *', {
    name: 'appointment-day-of-reminders',
    timeZone: APPOINTMENT_REMINDER_TIMEZONE,
  })
  async handleDayOfReminders(): Promise<void> {
    this.logger.log('Starting day-of appointment reminders');
    try {
      await this.notificationService.sendDayOfReminders(new Date());
    } catch (err) {
      this.logger.error(
        `Day-of reminder job failed: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  /** Runs daily at 06:00; notifies patients with appointments tomorrow. */
  @Cron('0 6 * * *', {
    name: 'appointment-day-before-reminders',
    timeZone: APPOINTMENT_REMINDER_TIMEZONE,
  })
  async handleDayBeforeReminders(): Promise<void> {
    this.logger.log('Starting day-before appointment reminders');
    try {
      await this.notificationService.sendDayBeforeReminders(new Date());
    } catch (err) {
      this.logger.error(
        `Day-before reminder job failed: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }
}
