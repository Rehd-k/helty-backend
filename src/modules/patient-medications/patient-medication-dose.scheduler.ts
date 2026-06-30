import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { HOSPITAL_TIMEZONE } from '../../common/utils/datetime';
import { PatientMedicationDoseGeneratorService } from './patient-medication-dose.generator';

const CRON_ENABLED =
  process.env.PATIENT_MEDICATION_DOSE_CRON_ENABLED?.trim().toLowerCase() !==
  'false';

@Injectable()
export class PatientMedicationDoseScheduler {
  private readonly logger = new Logger(PatientMedicationDoseScheduler.name);

  constructor(
    private readonly doseGenerator: PatientMedicationDoseGeneratorService,
  ) {}

  /** Runs daily at 06:00 in hospital timezone. */
  @Cron('0 6 * * *', {
    name: 'patient-medication-dose-extension',
    timeZone: HOSPITAL_TIMEZONE,
  })
  async handleDoseExtension(): Promise<void> {
    if (!CRON_ENABLED) return;

    this.logger.log('Starting patient medication dose extension');
    try {
      await this.doseGenerator.extendActivePrescriptionDoses();
    } catch (err) {
      this.logger.error(
        `Patient medication dose extension failed: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }
}
