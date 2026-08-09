import { MIN_HOURS_BEFORE_CHANGE, PORTAL_APPOINTMENT_STATUS } from './patient-appointments.constants';
import { isUpcomingPortalStatus, toPortalStatus } from './patient-appointments.status';

export function canModifyAppointment(
  status: string,
  scheduledAt: Date,
  now: Date = new Date(),
): boolean {
  if (!isUpcomingPortalStatus(status)) {
    return false;
  }
  const cutoff = new Date(
    now.getTime() + MIN_HOURS_BEFORE_CHANGE * 60 * 60 * 1000,
  );
  return scheduledAt > cutoff;
}

export function canRescheduleAppointment(
  status: string,
  scheduledAt: Date,
  now?: Date,
): boolean {
  if (toPortalStatus(status) === PORTAL_APPOINTMENT_STATUS.REQUESTED) {
    return true;
  }
  return canModifyAppointment(status, scheduledAt, now);
}

export function canCancelAppointment(
  status: string,
  scheduledAt: Date,
  now?: Date,
): boolean {
  if (toPortalStatus(status) === PORTAL_APPOINTMENT_STATUS.REQUESTED) {
    return true;
  }
  return canModifyAppointment(status, scheduledAt, now);
}

export function isWritablePortalStatus(status: string): boolean {
  const portal = toPortalStatus(status);
  return portal !== 'COMPLETED' && portal !== 'CANCELLED';
}
