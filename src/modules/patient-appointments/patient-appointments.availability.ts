import { HOSPITAL_TIMEZONE } from '../../common/utils/datetime';
import {
  SLOT_DURATION_MINUTES,
  SLOT_END_HOUR,
  SLOT_START_HOUR,
} from './patient-appointments.constants';

export type AvailabilitySlot = {
  scheduledAt: Date;
  available: boolean;
};

function lagosOffsetForDate(date: string): string {
  return HOSPITAL_TIMEZONE === 'Africa/Lagos' ? '+01:00' : '+00:00';
}

export function generateDaySlots(date: string): Date[] {
  const offset = lagosOffsetForDate(date);
  const slots: Date[] = [];

  for (let hour = SLOT_START_HOUR; hour < SLOT_END_HOUR; hour++) {
    for (const minute of [0, 30]) {
      const hh = String(hour).padStart(2, '0');
      const mm = String(minute).padStart(2, '0');
      slots.push(new Date(`${date}T${hh}:${mm}:00.000${offset}`));
    }
  }

  return slots;
}

export function slotsOverlap(
  slotStart: Date,
  appointmentDate: Date,
  durationMinutes = SLOT_DURATION_MINUTES,
): boolean {
  const slotEnd = new Date(slotStart.getTime() + durationMinutes * 60 * 1000);
  const apptEnd = new Date(
    appointmentDate.getTime() + durationMinutes * 60 * 1000,
  );
  return slotStart < apptEnd && appointmentDate < slotEnd;
}

export function buildAvailabilitySlots(params: {
  date: string;
  bookedAt: Date[];
  now?: Date;
}): AvailabilitySlot[] {
  const now = params.now ?? new Date();
  const slotStarts = generateDaySlots(params.date);

  return slotStarts.map((scheduledAt) => {
    const isPast = scheduledAt <= now;
    const isBooked = params.bookedAt.some((booked) =>
      slotsOverlap(scheduledAt, booked),
    );
    return {
      scheduledAt,
      available: !isPast && !isBooked,
    };
  });
}

export function isSlotAvailable(
  scheduledAt: Date,
  bookedAt: Date[],
  now: Date = new Date(),
): boolean {
  if (scheduledAt <= now) {
    return false;
  }
  return !bookedAt.some((booked) => slotsOverlap(scheduledAt, booked));
}
