export const PORTAL_APPOINTMENT_STATUS = {
  REQUESTED: 'REQUESTED',
  CONFIRMED: 'CONFIRMED',
  PENDING: 'PENDING',
  CANCELLED: 'CANCELLED',
  COMPLETED: 'COMPLETED',
} as const;

export type PortalAppointmentStatus =
  (typeof PORTAL_APPOINTMENT_STATUS)[keyof typeof PORTAL_APPOINTMENT_STATUS];

export const APPOINTMENT_LIST_FILTER = {
  UPCOMING: 'UPCOMING',
  PAST: 'PAST',
  PENDING: 'PENDING',
} as const;

export type AppointmentListFilter =
  (typeof APPOINTMENT_LIST_FILTER)[keyof typeof APPOINTMENT_LIST_FILTER];

export const CONSULTATION_RESULT_STATUS = {
  NORMAL: 'NORMAL',
  COMPLETED: 'COMPLETED',
  ABNORMAL: 'ABNORMAL',
  PENDING: 'PENDING',
} as const;

export type ConsultationResultStatus =
  (typeof CONSULTATION_RESULT_STATUS)[keyof typeof CONSULTATION_RESULT_STATUS];

/** Raw DB status values grouped by portal status (case-insensitive reads). */
export const RAW_CONFIRMED_STATUSES = [
  'scheduled',
  'SCHEDULED',
  'rescheduled',
  'RESCHEDULED',
  'CONFIRMED',
] as const;

export const RAW_PENDING_STATUSES = ['pending', 'PENDING'] as const;

export const RAW_REQUESTED_STATUSES = ['requested', 'REQUESTED'] as const;

export const RAW_CANCELLED_STATUSES = ['cancelled', 'CANCELLED'] as const;

export const RAW_COMPLETED_STATUSES = [
  'completed',
  'COMPLETED',
  'no_show',
  'NO_SHOW',
] as const;

export const MIN_HOURS_BEFORE_CHANGE = 24;

export const SLOT_START_HOUR = 8;
export const SLOT_END_HOUR = 17;
export const SLOT_DURATION_MINUTES = 30;

export const PATIENT_PORTAL_SYSTEM_STAFF_ID_ENV = 'PATIENT_PORTAL_SYSTEM_STAFF_ID';

export const APPOINTMENT_INCLUDE = {
  staff: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      medicalSpecialty: true,
      department: { select: { name: true } },
    },
  },
} as const;
