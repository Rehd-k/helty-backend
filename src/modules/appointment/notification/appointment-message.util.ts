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
  channel: 'EMAIL' | 'SMS';
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
}): { subject: string; text: string; sms: string } {
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
      };
    default:
      return {
        subject: `Appointment update – ${params.hospitalName}`,
        text: `Dear ${name},\n\nYou have an appointment update at ${params.hospitalName} on ${when}.`,
        sms: `${params.hospitalName}: Appointment update for ${when}.`,
      };
  }
}

export function formatPatientName(patient: {
  firstName?: string | null;
  surname?: string | null;
}): string {
  return [patient.firstName, patient.surname].filter(Boolean).join(' ');
}

export function isCancelledStatus(status: string | null | undefined): boolean {
  return status?.trim().toLowerCase() === 'cancelled';
}

export function isReminderEligibleStatus(
  status: string | null | undefined,
): boolean {
  const normalized = status?.trim().toLowerCase();
  return normalized === 'scheduled' || normalized === 'rescheduled';
}
