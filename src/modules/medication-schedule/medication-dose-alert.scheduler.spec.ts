import { MedicationScheduleService } from './medication-schedule.service';
import { MedicationDoseAlertScheduler } from './medication-dose-alert.scheduler';

describe('MedicationDoseAlertScheduler', () => {
  it('runs alert sync when enabled', async () => {
    const scheduleService = {
      processActiveSchedulesForAlerts: jest
        .fn()
        .mockResolvedValue({ processed: 2, updated: 1 }),
    } as unknown as MedicationScheduleService;

    const scheduler = new MedicationDoseAlertScheduler(scheduleService);
    await scheduler.handleMedicationDoseAlerts();

    expect(scheduleService.processActiveSchedulesForAlerts).toHaveBeenCalled();
  });
});
