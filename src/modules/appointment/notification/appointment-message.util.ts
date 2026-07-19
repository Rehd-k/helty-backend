import { AppointmentNotificationKind } from '@prisma/client';
import { APPOINTMENT_REMINDER_TIMEZONE } from './appointment-notification.types';

export function getLagosDateBucket(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: APPOINTMENT_REMINDER_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function getLagosDayBounds(reference: Date = new Date()): {
  from: Date;
  to: Date;
} {
  const day = getLagosDateBucket(reference);
  return {
    from: new Date(`${day}T00:00:00+01:00`),
    to: new Date(`${day}T23:59:59.999+01:00`),
  };
}

/** Calendar-day bounds in Lagos offset by `dayOffset` from `reference` (e.g. 1 = tomorrow). */
export function getLagosDayBoundsOffset(
  reference: Date = new Date(),
  dayOffset: number,
): { from: Date; to: Date; dateBucket: string } {
  const day = getLagosDateBucket(reference);
  const [y, m, d] = day.split('-').map(Number);
  const shifted = new Date(Date.UTC(y, m - 1, d + dayOffset, 12, 0, 0));
  const dateBucket = getLagosDateBucket(shifted);
  const bounds = getLagosDayBounds(shifted);
  return { ...bounds, dateBucket };
}

export function formatAppointmentDateTime(
  date: Date,
  timezone = APPOINTMENT_REMINDER_TIMEZONE,
): string {
  return new Intl.DateTimeFormat('en-NG', {
    timeZone: timezone,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

export function buildIdempotencyKey(params: {
  appointmentId: string;
  kind: AppointmentNotificationKind;
  channel: 'EMAIL' | 'SMS' | 'PUSH';
  dateBucket?: string;
  eventMarker?: string;
}): string {
  const parts = [
    params.appointmentId,
    params.kind,
    params.channel,
    params.dateBucket ?? params.eventMarker ?? 'once',
  ];
  return parts.join(':');
}

export function buildAppointmentMessages(params: {
  kind: AppointmentNotificationKind;
  patientName: string;
  appointmentDate: Date;
  previousDate?: Date;
  hospitalName: string;
}): { subject: string; text: string; sms: string; pushTitle: string; pushBody: string } {
  const when = formatAppointmentDateTime(params.appointmentDate);
  const name = params.patientName.trim() || 'Patient';

  switch (params.kind) {
    case 'CREATED':
      return {
        subject: `Appointment confirmed – ${params.hospitalName}`,
        text:
          `Dear ${name},\n\n` +
          `Your appointment at ${params.hospitalName} has been scheduled for ${when}.\n\n` +
          `Please arrive on time. Contact the hospital if you need to reschedule.\n\n` +
          `Thank you.`,
        sms: `${params.hospitalName}: Appointment confirmed for ${when}. Please arrive on time.`,
        pushTitle: 'Appointment confirmed',
        pushBody: `Your appointment at ${params.hospitalName} is scheduled for ${when}.`,
      };
    case 'RESCHEDULED': {
      const prev = params.previousDate
        ? formatAppointmentDateTime(params.previousDate)
        : 'your previous slot';
      return {
        subject: `Appointment rescheduled – ${params.hospitalName}`,
        text:
          `Dear ${name},\n\n` +
          `Your appointment at ${params.hospitalName} has been moved from ${prev} to ${when}.\n\n` +
          `Please contact the hospital if this time does not work for you.\n\n` +
          `Thank you.`,
        sms: `${params.hospitalName}: Appointment rescheduled to ${when}.`,
        pushTitle: 'Appointment rescheduled',
        pushBody: `Your appointment at ${params.hospitalName} was moved to ${when}.`,
      };
    }
    case 'CANCELLED':
      return {
        subject: `Appointment cancelled – ${params.hospitalName}`,
        text:
          `Dear ${name},\n\n` +
          `Your appointment at ${params.hospitalName} scheduled for ${when} has been cancelled.\n\n` +
          `Contact the hospital to book a new appointment if needed.\n\n` +
          `Thank you.`,
        sms: `${params.hospitalName}: Your appointment on ${when} has been cancelled.`,
        pushTitle: 'Appointment cancelled',
        pushBody: `Your appointment at ${params.hospitalName} on ${when} has been cancelled.`,
      };
    case 'REMINDER_DAY_OF':
      return {
        subject: `Appointment reminder – today at ${params.hospitalName}`,
        text:
          `Dear ${name},\n\n` +
          `This is a reminder that you have an appointment today at ${params.hospitalName} on ${when}.\n\n` +
          `Please arrive on time.\n\n` +
          `Thank you.`,
        sms: `${params.hospitalName}: Reminder – you have an appointment today at ${when}.`,
        pushTitle: 'Appointment today',
        pushBody: `Reminder: your appointment at ${params.hospitalName} is today at ${when}.`,
      };
    case 'REMINDER_DAY_BEFORE':
      return {
        subject: `Appointment reminder – tomorrow at ${params.hospitalName}`,
        text:
          `Dear ${name},\n\n` +
          `This is a reminder that you have an appointment tomorrow at ${params.hospitalName} on ${when}.\n\n` +
          `Please arrive on time.\n\n` +
          `Thank you.`,
        sms: `${params.hospitalName}: Reminder – you have an appointment tomorrow at ${when}.`,
        pushTitle: 'Appointment tomorrow',
        pushBody: `Reminder: your appointment at ${params.hospitalName} is tomorrow at ${when}.`,
      };
    default:
      return {
        subject: `Appointment update – ${params.hospitalName}`,
        text: `Dear ${name},\n\nYou have an appointment update at ${params.hospitalName} on ${when}.`,
        sms: `${params.hospitalName}: Appointment update for ${when}.`,
        pushTitle: 'Appointment update',
        pushBody: `You have an appointment update at ${params.hospitalName} on ${when}.`,
      };
  }
}

export { formatPatientDisplayName as formatPatientName } from '../../../common/utils/patient-display-name.util';

export function isCancelledStatus(status: string | null | undefined): boolean {
  const normalized = status?.trim().toLowerCase();
  return normalized === 'cancelled' || normalized === 'canceled';
}

export function isReminderEligibleStatus(
  status: string | null | undefined,
): boolean {
  const normalized = status?.trim().toLowerCase();
  return (
    normalized === 'scheduled' ||
    normalized === 'rescheduled' ||
    normalized === 'confirmed' ||
    normalized === 'pending'
  );
}
