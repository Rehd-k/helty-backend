import {
  AppointmentNotificationChannel,
  AppointmentNotificationKind,
  AppointmentNotificationStatus,
} from '@prisma/client';

export interface AppointmentNotificationContext {
  appointmentId: string;
  patientId: string;
  patientName: string;
  appointmentDate: Date;
  previousDate?: Date;
  email?: string | null;
  phoneNumber?: string | null;
}

export interface PersistedNotificationAttempt {
  id: string;
  channel: AppointmentNotificationChannel;
  kind: AppointmentNotificationKind;
  status: AppointmentNotificationStatus;
}

export const APPOINTMENT_REMINDER_TIMEZONE =
  process.env.APPOINTMENT_REMINDER_TIMEZONE?.trim() || 'Africa/Lagos';

export const REMINDER_ELIGIBLE_STATUSES = [
  'scheduled',
  'SCHEDULED',
  'rescheduled',
  'RESCHEDULED',
] as const;
