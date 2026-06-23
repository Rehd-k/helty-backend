import {
  MedicationAdministrationLifecycleStatus,
  MedicationAdminStatus,
  MedicationScheduleStatus,
  Prisma,
  RxDurationUnit,
} from '@prisma/client';
import { MedicationScheduleService } from './medication-schedule.service';

function baseSchedule() {
  return {
    id: 'sched-1',
    medicationOrderId: 'order-1',
    scheduleStartedAt: null,
    courseEndsAt: null,
    nextDueAt: null,
    lastAdministeredAt: null,
    doseSequenceNumber: 0,
    scheduleStatus: MedicationScheduleStatus.NOT_STARTED,
    dosesPerDay: null,
    frequencyIntervalHours: null,
    durationValue: null,
    durationUnit: null,
    beyondDurationConsentAt: null,
    beyondDurationConsentById: null,
    beyondDurationConsentNote: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe('MedicationScheduleService', () => {
  const prisma = {} as never;
  const service = new MedicationScheduleService(prisma);

  it('recomputeScheduleStatus returns STOPPED when order stopped', () => {
    const status = service.recomputeScheduleStatus(
      new Date(),
      baseSchedule(),
      MedicationAdministrationLifecycleStatus.STOPPED,
    );
    expect(status).toBe(MedicationScheduleStatus.STOPPED);
  });

  it('recomputeScheduleStatus returns EXPIRED after courseEndsAt', () => {
    const now = new Date('2026-06-30T09:00:00.000Z');
    const status = service.recomputeScheduleStatus(
      now,
      {
        ...baseSchedule(),
        scheduleStartedAt: new Date('2026-06-23T08:00:00.000Z'),
        courseEndsAt: new Date('2026-06-30T08:00:00.000Z'),
        nextDueAt: new Date('2026-06-30T08:00:00.000Z'),
      },
      MedicationAdministrationLifecycleStatus.ACTIVE,
    );
    expect(status).toBe(MedicationScheduleStatus.EXPIRED);
  });

  it('first GIVEN anchors scheduleStartedAt and courseEndsAt', () => {
    const actualTime = new Date('2026-06-23T08:00:00.000Z');
    const result = service.buildScheduleUpdateFromAdministration({
      schedule: baseSchedule(),
      order: {
        frequency: 'Twice daily (BD / BID)',
        duration: '7 days',
        administrationStatus: MedicationAdministrationLifecycleStatus.ACTIVE,
      },
      status: MedicationAdminStatus.GIVEN,
      actualTime,
      now: actualTime,
    });

    expect(result.isFirstDose).toBe(true);
    expect(result.doseNumber).toBe(1);
    expect(result.scheduleData.scheduleStartedAt).toEqual(actualTime);
    expect(result.scheduleData.courseEndsAt).toEqual(
      new Date('2026-06-30T08:00:00.000Z'),
    );
    expect(result.scheduleData.nextDueAt).toEqual(
      new Date('2026-06-23T20:00:00.000Z'),
    );
  });

  it('MISSED does not advance nextDueAt', () => {
    const nextDueAt = new Date('2026-06-23T14:00:00.000Z');
    const result = service.buildScheduleUpdateFromAdministration({
      schedule: {
        ...baseSchedule(),
        scheduleStartedAt: new Date('2026-06-23T08:00:00.000Z'),
        nextDueAt,
        doseSequenceNumber: 1,
      },
      order: {
        frequency: 'BD',
        duration: '7 days',
        administrationStatus: MedicationAdministrationLifecycleStatus.ACTIVE,
      },
      status: MedicationAdminStatus.MISSED,
      actualTime: new Date('2026-06-23T14:30:00.000Z'),
      now: new Date('2026-06-23T14:30:00.000Z'),
    });

    expect(result.scheduleData.nextDueAt).toBeUndefined();
    expect(result.scheduleData.scheduleStatus).toBe(
      MedicationScheduleStatus.OVERDUE,
    );
  });

  it('maps Decimal fields to API strings', () => {
    const api = service.mapScheduleToApi({
      ...baseSchedule(),
      dosesPerDay: new Prisma.Decimal(2),
      frequencyIntervalHours: new Prisma.Decimal(12),
      durationValue: 7,
      durationUnit: RxDurationUnit.DAYS,
    });
    expect(api.dosesPerDay).toBe('2');
    expect(api.frequencyIntervalHours).toBe('12');
    expect(api.durationValue).toBe(7);
  });
});
