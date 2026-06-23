import {
  AdmissionAlertType,
  MedicationScheduleStatus,
  RxDurationUnit,
} from '@prisma/client';

export type MedicationDoseScheduleApi = {
  scheduleStartedAt: string | null;
  courseEndsAt: string | null;
  nextDueAt: string | null;
  lastAdministeredAt: string | null;
  doseSequenceNumber: number;
  scheduleStatus: MedicationScheduleStatus;
  dosesPerDay: string | null;
  frequencyIntervalHours: string | null;
  durationValue: number | null;
  durationUnit: RxDurationUnit | null;
  beyondDurationConsentAt: string | null;
  beyondDurationConsentById: string | null;
  beyondDurationConsentNote: string | null;
};

export type MedicationDoseScheduleItemApi = {
  medicationOrderId: string;
  drugName: string;
  dose: string | null;
  frequency: string | null;
  duration: string | null;
  administrationStatus: 'ACTIVE' | 'STOPPED';
  doseSchedule: MedicationDoseScheduleApi;
};

export type ParsedFrequency = {
  dosesPerDay: number;
  frequencyIntervalHours: number;
  isIntervalBased: boolean;
};

export type ParsedDuration = {
  durationValue: number;
  durationUnit: RxDurationUnit;
};

export const MEDICATION_ALERT_TYPES = [
  AdmissionAlertType.MEDICATION_DOSE_DUE,
  AdmissionAlertType.MEDICATION_DOSE_OVERDUE,
  AdmissionAlertType.MEDICATION_COURSE_EXPIRED,
] as const;
